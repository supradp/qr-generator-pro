// api/generate.js
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { createQR } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { url, type = 'url', tracking = true, folder_id = null, page_config = null } = req.body || {};
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers.host;

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
      const record = await createQR({ id, original_url: page_config.title || 'Сторінка посилань', type: 'page', page_config, qr_image_png, qr_image_svg, tracking: Boolean(tracking), folder_id: folder_id || null });
      return res.status(201).json({ ...record, short_url: redirectUrl });
    }

    // Тип 'url' — поточна поведінка
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
    } catch (e) {
      return res.status(400).json({ error: 'Невірний URL' });
    }

    const id = uuidv4();
    const redirectUrl = `${proto}://${host}/redirect/${id}`;

    const qr_image_png = await QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H', width: 1024, margin: 2 });
    const qr_image_svg = await QRCode.toString(redirectUrl, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 });

    const record = await createQR({ id, original_url: url, type: 'url', qr_image_png, qr_image_svg, tracking: Boolean(tracking), folder_id: folder_id || null });

    return res.status(201).json({
      ...record,
      short_url: redirectUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};