// api/_lib/store.js
// Унифицированный слой работы с данными: Redis (если есть) или in-memory Map
const { getRedis } = require('./redis');
const { v4: uuidv4 } = require('uuid');

const memory = {
  qrs: new Map(), // id → { id, original_url, created_at, scan_count, qr_image, tracking }
  scans: new Map(), // qrId → [ { id, qr_id, scanned_at, user_agent, ip_address } ]
  uniques: new Map(), // qrId → Set(uniqueKey)
  ids: new Set(),
};

function keyQR(id) { return `qr:${id}`; }
function keyScans(id) { return `qr:${id}:scans`; }
function keyUniques(id) { return `qr:${id}:uniques`; }
function keyAllIds() { return 'qr:ids'; }

async function createQR({ id = uuidv4(), original_url, qr_image, qr_image_png, qr_image_svg, tracking = true }) {
  const created_at = new Date().toISOString();
  // qr_image: для обратной совместимости (PNG)
  const data = {
    id,
    original_url,
    created_at,
    scan_count: 0,
    qr_image: qr_image || qr_image_png || null,
    qr_image_png: qr_image_png || qr_image || null,
    qr_image_svg: qr_image_svg || null,
    tracking,
  };

  const redis = getRedis();
  if (redis) {
    await redis.hset(keyQR(id), data);
    try { await redis.sadd(keyAllIds(), id); } catch {}
  } else {
    memory.qrs.set(id, data);
    memory.ids.add(id);
  }
  return data;
}

async function updateQR(id, patch) {
  const redis = getRedis();
  if (redis) {
    await redis.hset(keyQR(id), patch);
    const data = await redis.hgetall(keyQR(id));
    return Object.keys(data).length ? { ...data, scan_count: Number(data.scan_count) } : null;
  } else {
    const existing = memory.qrs.get(id);
    if (!existing) return null;
    const next = { ...existing, ...patch };
    memory.qrs.set(id, next);
    return next;
  }
}

async function getQR(id) {
  const redis = getRedis();
  if (redis) {
    const data = await redis.hgetall(keyQR(id));
    return Object.keys(data).length ? { ...data, scan_count: Number(data.scan_count) } : null;
  }
  return memory.qrs.get(id) || null;
}

async function getAllQRs() {
  const redis = getRedis();
  if (redis) {
    // Быстрый путь: поддерживаемый всеми вариантами (в т.ч. Upstash REST)
    let ids = [];
    try { ids = await redis.smembers(keyAllIds()); } catch { ids = []; }

    // Фолбэк: если индекс пуст, пробуем SCAN (на обычном Redis)
    if ((!ids || ids.length === 0) && typeof redis.scan === 'function') {
      let cursor = '0';
      const set = new Set();
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', 'qr:*', 'COUNT', 100);
        cursor = next;
        keys.forEach(k => { const p = k.split(':'); if (p.length === 2) set.add(p[1]); });
      } while (cursor !== '0');
      ids = Array.from(set);
    }

    const result = [];
    for (const id of ids) {
      const data = await redis.hgetall(keyQR(id));
      if (Object.keys(data).length) result.push({ ...data, scan_count: Number(data.scan_count) });
    }
    // Новые сверху
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return Array.from(memory.qrs.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function deleteQR(id) {
  const redis = getRedis();
  if (redis) {
    await redis.del(keyQR(id), keyScans(id), keyUniques(id));
    try { await redis.srem(keyAllIds(), id); } catch {}
  } else {
    memory.qrs.delete(id);
    memory.scans.delete(id);
    memory.uniques.delete(id);
    memory.ids.delete(id);
  }
}

function parseUserAgent(ua = '') {
  const s = ua.toLowerCase();
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|vkshare|whatsapp|telegram/i.test(ua);
  const device_type = isBot ? 'bot' : /mobile|iphone|android|blackberry|iemobile|opera mini/i.test(ua) ? 'mobile' : /ipad|tablet/i.test(ua) ? 'tablet' : 'desktop';
  let os = 'other';
  if (/windows nt/i.test(ua)) os = 'windows';
  else if (/mac os x/i.test(ua)) os = 'macos';
  else if (/android/i.test(ua)) os = 'android';
  else if (/ios|iphone|ipad|ipod/i.test(ua)) os = 'ios';
  else if (/linux/i.test(ua)) os = 'linux';

  let browser = 'other';
  if (/edg\//i.test(ua)) browser = 'edge';
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'safari';
  else if (/firefox\//i.test(ua)) browser = 'firefox';
  else if (/opera|opr\//i.test(ua)) browser = 'opera';

  return { device_type, os, browser, is_bot: isBot };
}

async function addScan({ qr_id, user_agent, ip_address, country, region, city, referer }) {
  const redis = getRedis();
  const scan = {
    id: uuidv4(),
    qr_id,
    scanned_at: new Date().toISOString(),
    user_agent: user_agent || 'unknown',
    ip_address: ip_address || 'unknown',
    country: country || 'unknown',
    region: region || 'unknown',
    city: city || 'unknown',
    referer: referer || '',
  };

  Object.assign(scan, parseUserAgent(scan.user_agent));

  const uniqueKey = `${scan.ip_address}|${scan.user_agent}`;

  if (redis) {
    // История сканов — как JSON-строки в Redis List
    await redis.lpush(keyScans(qr_id), JSON.stringify(scan));
    // Счетчики
    await redis.hincrby(keyQR(qr_id), 'scan_count', 1);
    // Уникальные посетители — Redis Set
    await redis.sadd(keyUniques(qr_id), uniqueKey);
  } else {
    const list = memory.scans.get(qr_id) || [];
    list.unshift(scan); // новые сверху
    memory.scans.set(qr_id, list);
    // инкремент
    const qr = memory.qrs.get(qr_id);
    if (qr) qr.scan_count = (qr.scan_count || 0) + 1;
    const set = memory.uniques.get(qr_id) || new Set();
    set.add(uniqueKey);
    memory.uniques.set(qr_id, set);
  }
  return scan;
}

function shiftDateByOffset(d, tzOffsetMinutes) {
  if (!Number.isFinite(tzOffsetMinutes)) return d;
  return new Date(d.getTime() - tzOffsetMinutes * 60000);
}

function dateKeyFromISO(iso, tzOffsetMinutes) {
  try {
    const d = new Date(iso);
    const local = shiftDateByOffset(d, tzOffsetMinutes || 0);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
      .toISOString().slice(0, 10);
  } catch { return ''; }
}

function buildDailySeries(scans, days = 30, tzOffsetMinutes = 0) {
  const result = [];
  const map = new Map();
  for (const s of scans) {
    const k = dateKeyFromISO(s.scanned_at, tzOffsetMinutes);
    map.set(k, (map.get(k) || 0) + 1);
  }
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const base = shiftDateByOffset(today, tzOffsetMinutes || 0);
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) || 0 });
  }
  return result;
}

async function getStats(qr_id, { days = 30, tzOffset = 0 } = {}) {
  const redis = getRedis();
  if (redis) {
    const qr = await getQR(qr_id);
    if (!qr) return null;
    const raw = await redis.lrange(keyScans(qr_id), 0, -1);
    const scans = raw.map(s => JSON.parse(s));
    const unique_visitors = await redis.scard(keyUniques(qr_id));
    const series_daily = buildDailySeries(scans, days, tzOffset);
    const breakdowns = buildBreakdowns(scans, tzOffset);
    return { ...qr, unique_visitors, scans, series_daily, breakdowns };
  }
  const qr = memory.qrs.get(qr_id);
  if (!qr) return null;
  const scans = memory.scans.get(qr_id) || [];
  const unique_visitors = (memory.uniques.get(qr_id) || new Set()).size;
  const series_daily = buildDailySeries(scans, days, tzOffset);
  const breakdowns = buildBreakdowns(scans, tzOffset);
  return { ...qr, unique_visitors, scans, series_daily, breakdowns };
}

async function getGlobalStats({ days = 30, tzOffset = 0 } = {}) {
  const redis = getRedis();
  let qrs = [];
  let allScans = [];
  const uniqueAll = new Set();

  if (redis) {
    qrs = await getAllQRs();
    for (const qr of qrs) {
      const raw = await redis.lrange(keyScans(qr.id), 0, -1);
      const scans = raw.map(s => JSON.parse(s));
      allScans.push(...scans);
      try {
        const members = await redis.smembers(keyUniques(qr.id));
        members.forEach(m => uniqueAll.add(m));
      } catch {}
    }
  } else {
    qrs = Array.from(memory.qrs.values());
    for (const [qrId, list] of memory.scans.entries()) {
      allScans.push(...list);
    }
    for (const set of memory.uniques.values()) {
      set.forEach(v => uniqueAll.add(v));
    }
  }

  const total_qrs = qrs.length;
  const total_scans = allScans.length;
  const total_unique_visitors = uniqueAll.size;
  const series_daily = buildDailySeries(allScans, days, tzOffset);

  // топ-5 QR по числу сканов
  const top_qrs = qrs
    .slice()
    .sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))
    .slice(0, 5)
    .map(x => ({ id: x.id, scan_count: Number(x.scan_count || 0), original_url: x.original_url }));

  const breakdowns = buildBreakdowns(allScans, tzOffset);

  return { total_qrs, total_scans, total_unique_visitors, series_daily, top_qrs, breakdowns };
}

function aggregateCounts(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it) || 'unknown';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildBreakdowns(scans, tzOffsetMinutes = 0) {
  const byCountry = aggregateCounts(scans, s => (s.country || '').toUpperCase());
  const byCity = aggregateCounts(scans, s => s.city || '');
  const byDevice = aggregateCounts(scans, s => s.device_type || '');
  const byOS = aggregateCounts(scans, s => s.os || '');
  const byBrowser = aggregateCounts(scans, s => s.browser || '');
  const byHour = aggregateCounts(scans, s => {
    try { const d = shiftDateByOffset(new Date(s.scanned_at), tzOffsetMinutes || 0); return String(d.getHours()).padStart(2, '0'); } catch { return ''; }
  });
  const byWeekday = aggregateCounts(scans, s => {
    try { const d = shiftDateByOffset(new Date(s.scanned_at), tzOffsetMinutes || 0); return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()]; } catch { return ''; }
  });
  return {
    countries: byCountry.slice(0, 10),
    cities: byCity.slice(0, 10),
    devices: byDevice,
    os: byOS,
    browsers: byBrowser,
    hours: byHour,
    weekdays: byWeekday,
  };
}

module.exports = {
  createQR,
  getQR,
  getAllQRs,
  deleteQR,
  addScan,
  getStats,
  getGlobalStats,
  updateQR,
};