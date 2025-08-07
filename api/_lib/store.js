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

async function addScan({ qr_id, user_agent, ip_address }) {
  const redis = getRedis();
  const scan = {
    id: uuidv4(),
    qr_id,
    scanned_at: new Date().toISOString(),
    user_agent: user_agent || 'unknown',
    ip_address: ip_address || 'unknown',
  };

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

function dateKeyFromISO(iso) {
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ''; }
}

function buildDailySeries(scans, days = 30) {
  const result = [];
  const map = new Map();
  for (const s of scans) {
    const k = dateKeyFromISO(s.scanned_at);
    map.set(k, (map.get(k) || 0) + 1);
  }
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) || 0 });
  }
  return result;
}

async function getStats(qr_id, { days = 30 } = {}) {
  const redis = getRedis();
  if (redis) {
    const qr = await getQR(qr_id);
    if (!qr) return null;
    const raw = await redis.lrange(keyScans(qr_id), 0, -1);
    const scans = raw.map(s => JSON.parse(s));
    const unique_visitors = await redis.scard(keyUniques(qr_id));
    const series_daily = buildDailySeries(scans, days);
    return { ...qr, unique_visitors, scans, series_daily };
  }
  const qr = memory.qrs.get(qr_id);
  if (!qr) return null;
  const scans = memory.scans.get(qr_id) || [];
  const unique_visitors = (memory.uniques.get(qr_id) || new Set()).size;
  const series_daily = buildDailySeries(scans, days);
  return { ...qr, unique_visitors, scans, series_daily };
}

async function getGlobalStats({ days = 30 } = {}) {
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
  const series_daily = buildDailySeries(allScans, days);

  // топ-5 QR по числу сканов
  const top_qrs = qrs
    .slice()
    .sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))
    .slice(0, 5)
    .map(x => ({ id: x.id, scan_count: Number(x.scan_count || 0), original_url: x.original_url }));

  return { total_qrs, total_scans, total_unique_visitors, series_daily, top_qrs };
}

module.exports = {
  createQR,
  getQR,
  getAllQRs,
  deleteQR,
  addScan,
  getStats,
  getGlobalStats,
};