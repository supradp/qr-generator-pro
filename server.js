const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createQR, getAllQRs, getQR, deleteQR, addScan, getStats, getGlobalStats } = require('./api/_lib/store');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// Также отдаём статические файлы по префиксу /public, чтобы ссылки
// вида "/public/styles.css" и "/public/app.js" работали локально
app.use('/public', express.static(path.join(__dirname, 'public')));

app.post('/api/generate', async (req, res) => {
  const { url, tracking = true } = req.body || {};
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Неверный URL' });
  }
  const id = uuidv4();
  const redirectUrl = `${req.protocol}://${req.get('host')}/redirect/${id}`;
  const qr_image_png = await QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H', width: 1024, margin: 2 });
  const qr_image_svg = await QRCode.toString(redirectUrl, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 });
  const record = await createQR({ id, original_url: url, qr_image_png, qr_image_svg, tracking });
  res.status(201).json({ ...record, short_url: redirectUrl });
});

app.get('/redirect/:qrId', async (req, res) => {
  const qr = await getQR(req.params.qrId);
  if (!qr) return res.status(404).send('QR not found');
  if (String(qr.tracking) !== 'false') {
    await addScan({
      qr_id: req.params.qrId,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip,
      country: req.headers['x-vercel-ip-country'] || '',
      region: req.headers['x-vercel-ip-country-region'] || '',
      city: req.headers['x-vercel-ip-city'] || '',
      referer: req.headers['referer'] || '',
    });
  }
  // Отдаём промежуточную страницу
  const target = qr.original_url;
  const safeHref = String(target).replace(/"/g, '&quot;');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Перенаправление…</title><style>body{margin:0;font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0f1222;color:#e9ecff;display:flex;align-items:center;justify-content:center;min-height:100vh;background:radial-gradient(1000px 600px at 10% 10%,rgba(102,126,234,.25),transparent),radial-gradient(800px 600px at 90% 70%,rgba(118,75,162,.25),transparent),linear-gradient(120deg,#0f1222,#1a1f35)}.card{max-width:760px;margin:0 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:24px;backdrop-filter:blur(12px)}.btn{display:inline-block;margin-top:12px;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.15);text-decoration:none;color:inherit}.bar{height:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:999px;overflow:hidden}.bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#667eea,#764ba2)}</style></head><body><main class="card"><h1>Перенаправляем…</h1><p>Вы переходите на: <a href="${safeHref}">${safeHref}</a></p><div class="bar"><i id="p"></i></div><a class="btn" href="${safeHref}">Перейти сейчас</a></main><script>const href='${safeHref}';const el=document.getElementById('p');let x=0;const t=setInterval(()=>{x+=5;el.style.width=Math.min(x,100)+'%';if(x>=100){clearInterval(t);location.replace(href)}},50);</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/api/stats/:qrId', async (req, res) => {
  const days = Number(req.query.days || 30);
  const stats = await getStats(req.params.qrId, { days });
  if (!stats) return res.status(404).json({ error: 'Not found' });
  res.json(stats);
});

app.get('/api/stats-global', async (req, res) => {
  const days = Number(req.query.days || 30);
  const data = await getGlobalStats({ days });
  res.json(data);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));