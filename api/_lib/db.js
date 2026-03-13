const { Pool } = require('pg');

let pool = null;
let initPromise = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

async function initDB() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const p = getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id          TEXT PRIMARY KEY,
        original_url TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        scan_count  INTEGER NOT NULL DEFAULT 0,
        qr_image    TEXT,
        qr_image_png TEXT,
        qr_image_svg TEXT,
        tracking    BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS scans (
        id          TEXT PRIMARY KEY,
        qr_id       TEXT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
        scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_agent  TEXT,
        ip_address  TEXT,
        country     TEXT,
        region      TEXT,
        city        TEXT,
        referer     TEXT,
        device_type TEXT,
        os          TEXT,
        browser     TEXT,
        is_bot      BOOLEAN DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS idx_scans_qr_id      ON scans(qr_id);
      CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at);
    `);
  })();
  return initPromise;
}

module.exports = { getPool, initDB };
