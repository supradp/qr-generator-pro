// api/log-scan.js
// Доп. эндпоинт для ручного логирования (если нужен внешний вызов)
const { addScan, getQR } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { qr_id } = req.body || {};
  if (!qr_id) return res.status(400).json({ error: 'qr_id is required' });
  const qr = await getQR(qr_id);
  if (!qr) return res.status(404).json({ error: 'QR not found' });

  const ua = req.headers['user-agent'] || 'unknown';
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  const scan = await addScan({ qr_id, user_agent: ua, ip_address: ip });
  return res.status(201).json(scan);
};