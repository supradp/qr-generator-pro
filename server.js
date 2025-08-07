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
    await addScan({ qr_id: req.params.qrId, user_agent: req.headers['user-agent'], ip_address: req.ip });
  }
  res.redirect(qr.original_url);
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