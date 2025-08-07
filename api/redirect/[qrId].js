// api/redirect/[qrId].js
const { getQR, addScan } = require('../_lib/store');

module.exports = async (req, res) => {
  // Параметр qrId из маршрута
  const { qrId } = req.query;

  // Достаём QR
  const qr = await getQR(qrId);
  if (!qr) return res.status(404).send('QR not found');

  const ua = req.headers['user-agent'] || 'unknown';
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (String(qr.tracking) !== 'false') {
    try { await addScan({ qr_id: qrId, user_agent: ua, ip_address: ip }); } catch (e) { console.error(e); }
  }

  // Редиректим на оригинальный URL
  res.setHeader('Location', qr.original_url);
  return res.status(302).end();
};