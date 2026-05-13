require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createQR, getAllQRs, getQR, deleteQR, updateQR, addScan, getStats, getGlobalStats, createFolder, getAllFolders, deleteFolder } = require('./api/_lib/store');
const { initDB } = require('./api/_lib/db');
const { checkCredentials, signToken, setAuthCookie, clearAuthCookie, parseCookies, verifyToken, COOKIE_NAME } = require('./api/_lib/auth');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

// ── Auth helpers for Express ──────────────────────────────────
function authMiddleware(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function fetchJSON(url) {
  if (typeof fetch !== 'undefined') {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('fetch failed');
    return resp.json();
  }
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function resolveGeo(ip) {
  if (!ip) return {};
  try {
    const j = await fetchJSON(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const out = {
      country: j.country || j.country_code || '',
      region:  j.region  || j.region_code  || j.region_name || '',
      city:    j.city    || '',
    };
    if (out.country || out.region || out.city) return out;
  } catch {}
  try {
    const j = await fetchJSON(`https://ipwho.is/${encodeURIComponent(ip)}?lang=en`);
    const out = {
      country: j.country_code || j.country || '',
      region:  j.region       || j.region_name || '',
      city:    j.city         || '',
    };
    if (out.country || out.region || out.city) return out;
  } catch {}
  return {};
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ── Auth routes (public) ──────────────────────────────────────
app.get('/api/auth', (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ username: payload.sub });
});

app.post('/api/auth', async (req, res) => {
  const { action, username, password } = req.body || {};
  if (action === 'logout') {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  }
  if (action === 'login') {
    if (!username || !password) return res.status(400).json({ error: 'Введіть логін та пароль' });
    if (!checkCredentials(username, password)) {
      await new Promise(r => setTimeout(r, 400));
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }
    const token = signToken({ sub: username });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'Unknown action' });
});

// ── Protected API routes ──────────────────────────────────────
app.use('/api', authMiddleware);

app.get('/api/folders', async (req, res) => {
  res.json(await getAllFolders());
});

app.post('/api/folders', async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Назва папки обов\'язкова' });
  if (name.trim().length > 60) return res.status(400).json({ error: 'Назва надто довга' });
  const folder = await createFolder({ name });
  res.status(201).json(folder);
});

app.delete('/api/folders/:folderId', async (req, res) => {
  const folders = await getAllFolders();
  if (!folders.some(f => f.id === req.params.folderId)) return res.status(404).json({ error: 'Not found' });
  await deleteFolder(req.params.folderId);
  res.status(204).end();
});

app.post('/api/generate', async (req, res) => {
  const { url, type = 'url', tracking = true, folder_id = null, page_config = null } = req.body || {};
  const proto = req.protocol;
  const host  = req.get('host');

  if (type === 'page') {
    if (!page_config || !Array.isArray(page_config.links) || !page_config.links.length) {
      return res.status(400).json({ error: 'Додайте хоча б одне посилання' });
    }
    const id = uuidv4();
    const redirectUrl = `${proto}://${host}/redirect/${id}`;
    const [qr_image_png, qr_image_svg] = await Promise.all([
      QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H', width: 1024, margin: 2 }),
      QRCode.toString(redirectUrl, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 }),
    ]);
    const record = await createQR({ id, original_url: page_config.title || 'Сторінка посилань', type: 'page', page_config, qr_image_png, qr_image_svg, tracking, folder_id: folder_id || null });
    return res.status(201).json({ ...record, short_url: redirectUrl });
  }

  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Невірний URL' });
  }
  const id = uuidv4();
  const redirectUrl = `${proto}://${host}/redirect/${id}`;
  const qr_image_png = await QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H', width: 1024, margin: 2 });
  const qr_image_svg = await QRCode.toString(redirectUrl, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 });
  const record = await createQR({ id, original_url: url, type: 'url', qr_image_png, qr_image_svg, tracking, folder_id: folder_id || null });
  res.status(201).json({ ...record, short_url: redirectUrl });
});

app.get('/redirect/:qrId', async (req, res) => {
  const qr = await getQR(req.params.qrId);
  if (!qr) return res.status(404).send('QR not found');
  if (String(qr.tracking) !== 'false') {
    const allowOverride = (process.env.ALLOW_IP_OVERRIDE === '1') || (process.env.NODE_ENV !== 'production');
    const ipOverride = allowOverride ? (req.query.__ip || '') : '';
    const ipRaw = (ipOverride || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || '').split(',')[0].trim();
    const ip = ipRaw && ipRaw.startsWith('::ffff:') ? ipRaw.slice(7) : ipRaw;
    let country = req.headers['x-vercel-ip-country']        || '';
    let region  = req.headers['x-vercel-ip-country-region'] || '';
    let city    = req.headers['x-vercel-ip-city']           || '';
    if ((!country || !region || !city) && ip) {
      try {
        const geo = await resolveGeo(ip);
        country = country || geo.country || '';
        region  = region  || geo.region  || '';
        city    = city    || geo.city    || '';
      } catch {}
    }
    await addScan({
      qr_id:      req.params.qrId,
      user_agent: req.headers['user-agent'],
      ip_address: ip,
      country, region, city,
      referer: req.headers['referer'] || '',
    });
  }
  const target   = qr.original_url;
  const safeHref = String(target).replace(/"/g, '&quot;');
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Переспрямування…</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#1c1f22;color:#e8f5ec;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{max-width:760px;margin:0 16px;background:rgba(0,157,70,.07);border:1px solid rgba(0,157,70,.25);border-radius:20px;padding:28px;backdrop-filter:blur(12px)}.card h1{margin:0 0 12px;font-size:1.4rem}a{color:#009d46}.btn{display:inline-block;margin-top:14px;padding:12px 20px;border-radius:12px;border:1px solid rgba(0,157,70,.4);text-decoration:none;color:#e8f5ec;background:rgba(0,157,70,.12)}.bar{height:8px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden;margin:16px 0}.bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#009d46,#00c957);border-radius:999px}</style></head><body><main class="card"><h1>Переспрямовуємо…</h1><p>Перехід на: <a href="${safeHref}">${safeHref}</a></p><div class="bar"><i id="p"></i></div><a class="btn" href="${safeHref}">Перейти зараз</a></main><script>const el=document.getElementById('p');let x=0;const t=setInterval(()=>{x+=5;el.style.width=Math.min(x,100)+'%';if(x>=100){clearInterval(t);location.replace('${safeHref}')}},50);</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/api/stats/:qrId', async (req, res) => {
  const days = Number(req.query.days || 30);
  const tz   = Number(req.query.tz   || 0);
  const stats = await getStats(req.params.qrId, { days, tzOffset: tz });
  if (!stats) return res.status(404).json({ error: 'Not found' });
  res.json(stats);
});

app.get('/api/stats-global', async (req, res) => {
  const days = Number(req.query.days || 30);
  const tz   = Number(req.query.tz   || 0);
  res.json(await getGlobalStats({ days, tzOffset: tz }));
});

app.get('/api/qr-codes', async (req, res) => {
  res.json(await getAllQRs());
});

app.delete('/api/qr-codes/:qrId', async (req, res) => {
  const exists = await getQR(req.params.qrId);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  await deleteQR(req.params.qrId);
  res.status(204).end();
});

app.patch('/api/qr-codes/:qrId', async (req, res) => {
  const exists = await getQR(req.params.qrId);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  const { folder_id } = req.body || {};
  const updated = await updateQR(req.params.qrId, { folder_id: folder_id || null });
  res.json(updated);
});

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`MOTORNI QR server → http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Помилка підключення до PostgreSQL:', err.message);
    console.error('Перевірте DATABASE_URL у файлі .env');
    process.exit(1);
  });
