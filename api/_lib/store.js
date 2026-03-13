const { getPool, initDB } = require('./db');
const { v4: uuidv4 } = require('uuid');

// ────────────────────────────────────────────────────────────
//  Утилиты разбора User-Agent
// ────────────────────────────────────────────────────────────
function parseUserAgent(ua = '') {
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|vkshare|whatsapp|telegram/i.test(ua);
  const device_type = isBot
    ? 'bot'
    : /mobile|iphone|android|blackberry|iemobile|opera mini/i.test(ua) ? 'mobile'
    : /ipad|tablet/i.test(ua) ? 'tablet'
    : 'desktop';

  let os = 'other';
  if (/windows nt/i.test(ua))              os = 'windows';
  else if (/mac os x/i.test(ua))           os = 'macos';
  else if (/android/i.test(ua))            os = 'android';
  else if (/ios|iphone|ipad|ipod/i.test(ua)) os = 'ios';
  else if (/linux/i.test(ua))              os = 'linux';

  let browser = 'other';
  if (/edg\//i.test(ua))                              browser = 'edge';
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'chrome';
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua))   browser = 'safari';
  else if (/firefox\//i.test(ua))                     browser = 'firefox';
  else if (/opera|opr\//i.test(ua))                   browser = 'opera';

  return { device_type, os, browser, is_bot: isBot };
}

// ────────────────────────────────────────────────────────────
//  Вспомогательные функции для серий / разбивок
// ────────────────────────────────────────────────────────────
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
  const map = new Map();
  for (const s of scans) {
    const k = dateKeyFromISO(s.scanned_at, tzOffsetMinutes);
    map.set(k, (map.get(k) || 0) + 1);
  }
  const result = [];
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

function aggregateCounts(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it) || 'unknown';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildBreakdowns(scans, tzOffsetMinutes = 0) {
  return {
    countries: aggregateCounts(scans, s => (s.country || '').toUpperCase()).slice(0, 10),
    regions:   aggregateCounts(scans, s => s.region || '').slice(0, 10),
    cities:    aggregateCounts(scans, s => s.city || '').slice(0, 10),
    devices:   aggregateCounts(scans, s => s.device_type || ''),
    os:        aggregateCounts(scans, s => s.os || ''),
    browsers:  aggregateCounts(scans, s => s.browser || ''),
    hours: aggregateCounts(scans, s => {
      try {
        const d = shiftDateByOffset(new Date(s.scanned_at), tzOffsetMinutes || 0);
        return String(d.getHours()).padStart(2, '0');
      } catch { return ''; }
    }),
    weekdays: aggregateCounts(scans, s => {
      try {
        const d = shiftDateByOffset(new Date(s.scanned_at), tzOffsetMinutes || 0);
        return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
      } catch { return ''; }
    }),
  };
}

// ────────────────────────────────────────────────────────────
//  Преобразование строк БД в объекты
// ────────────────────────────────────────────────────────────
function rowToQR(r) {
  if (!r) return null;
  return {
    ...r,
    scan_count: Number(r.scan_count || 0),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToScan(r) {
  if (!r) return null;
  return {
    ...r,
    scanned_at: r.scanned_at instanceof Date ? r.scanned_at.toISOString() : r.scanned_at,
  };
}

// ────────────────────────────────────────────────────────────
//  CRUD для QR-кодов
// ────────────────────────────────────────────────────────────
async function createQR({ id = uuidv4(), original_url, qr_image, qr_image_png, qr_image_svg, tracking = true }) {
  await initDB();
  const pool = getPool();
  const created_at = new Date().toISOString();
  const img    = qr_image || qr_image_png || null;
  const imgPng = qr_image_png || qr_image || null;
  await pool.query(
    `INSERT INTO qr_codes (id, original_url, created_at, scan_count, qr_image, qr_image_png, qr_image_svg, tracking)
     VALUES ($1, $2, $3, 0, $4, $5, $6, $7)`,
    [id, original_url, created_at, img, imgPng, qr_image_svg || null, tracking],
  );
  return { id, original_url, created_at, scan_count: 0, qr_image: img, qr_image_png: imgPng, qr_image_svg: qr_image_svg || null, tracking };
}

async function getQR(id) {
  await initDB();
  const { rows } = await getPool().query('SELECT * FROM qr_codes WHERE id = $1', [id]);
  return rows.length ? rowToQR(rows[0]) : null;
}

async function getAllQRs() {
  await initDB();
  const { rows } = await getPool().query('SELECT * FROM qr_codes ORDER BY created_at DESC');
  return rows.map(rowToQR);
}

async function updateQR(id, patch) {
  await initDB();
  const keys = Object.keys(patch);
  if (!keys.length) return getQR(id);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await getPool().query(`UPDATE qr_codes SET ${sets} WHERE id = $1`, [id, ...Object.values(patch)]);
  return getQR(id);
}

async function deleteQR(id) {
  await initDB();
  await getPool().query('DELETE FROM qr_codes WHERE id = $1', [id]);
}

// ────────────────────────────────────────────────────────────
//  Сканирования
// ────────────────────────────────────────────────────────────
async function addScan({ qr_id, user_agent, ip_address, country, region, city, referer }) {
  await initDB();
  const pool = getPool();
  const parsed = parseUserAgent(user_agent || '');
  const scan = {
    id:         uuidv4(),
    qr_id,
    scanned_at: new Date().toISOString(),
    user_agent:  user_agent  || 'unknown',
    ip_address:  ip_address  || 'unknown',
    country:     country     || 'unknown',
    region:      region      || 'unknown',
    city:        city        || 'unknown',
    referer:     referer     || '',
    ...parsed,
  };
  await pool.query(
    `INSERT INTO scans
       (id, qr_id, scanned_at, user_agent, ip_address, country, region, city, referer, device_type, os, browser, is_bot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [scan.id, qr_id, scan.scanned_at, scan.user_agent, scan.ip_address,
     scan.country, scan.region, scan.city, scan.referer,
     scan.device_type, scan.os, scan.browser, scan.is_bot],
  );
  await pool.query('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = $1', [qr_id]);
  return scan;
}

// ────────────────────────────────────────────────────────────
//  Статистика
// ────────────────────────────────────────────────────────────
async function getStats(qr_id, { days = 30, tzOffset = 0 } = {}) {
  await initDB();
  const pool = getPool();
  const qr = await getQR(qr_id);
  if (!qr) return null;

  const { rows }  = await pool.query('SELECT * FROM scans WHERE qr_id = $1 ORDER BY scanned_at DESC', [qr_id]);
  const scans = rows.map(rowToScan);

  const { rows: uRows } = await pool.query(
    `SELECT COUNT(DISTINCT ip_address || '|' || user_agent) AS count FROM scans WHERE qr_id = $1`,
    [qr_id],
  );
  const unique_visitors = Number(uRows[0].count);
  const series_daily = buildDailySeries(scans, days, tzOffset);
  const breakdowns   = buildBreakdowns(scans, tzOffset);
  return { ...qr, unique_visitors, scans, series_daily, breakdowns };
}

async function getGlobalStats({ days = 30, tzOffset = 0 } = {}) {
  await initDB();
  const pool = getPool();
  const qrs = await getAllQRs();

  const { rows }  = await pool.query('SELECT * FROM scans ORDER BY scanned_at DESC');
  const allScans = rows.map(rowToScan);

  const { rows: uRows } = await pool.query(
    `SELECT COUNT(DISTINCT ip_address || '|' || user_agent) AS count FROM scans`,
  );
  const total_unique_visitors = Number(uRows[0].count);
  const total_qrs   = qrs.length;
  const total_scans = allScans.length;
  const series_daily = buildDailySeries(allScans, days, tzOffset);
  const top_qrs = qrs
    .slice()
    .sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))
    .slice(0, 5)
    .map(x => ({ id: x.id, scan_count: Number(x.scan_count || 0), original_url: x.original_url }));
  const breakdowns = buildBreakdowns(allScans, tzOffset);
  return { total_qrs, total_scans, total_unique_visitors, series_daily, top_qrs, breakdowns };
}

module.exports = { createQR, getQR, getAllQRs, updateQR, deleteQR, addScan, getStats, getGlobalStats };
