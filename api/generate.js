// api/generate.js
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { createQR } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { url, tracking = true } = req.body || {};

    // Валидация URL
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
    } catch (e) {
      return res.status(400).json({ error: 'Неверный URL' });
    }

    const id = uuidv4();
    const redirectUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/redirect/${id}`;

    // Генерируем QR в двух форматах
    const qr_image_png = await QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H', width: 1024, margin: 2 });
    const qr_image_svg = await QRCode.toString(redirectUrl, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 });

    const record = await createQR({ id, original_url: url, qr_image_png, qr_image_svg, tracking: Boolean(tracking) });

    return res.status(201).json({
      ...record,
      short_url: redirectUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};