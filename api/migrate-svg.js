const QRCode = require('qrcode');
const { getAllQRs, updateQR } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const token = req.headers['x-api-key'] || req.query.key;
  if (!token || token !== (process.env.MIGRATE_KEY || '')) return res.status(401).json({ error: 'Unauthorized' });

  const list = await getAllQRs();
  let migrated = 0;
  for (const q of list) {
    if (!q.qr_image_svg && (q.short_url || q.original_url)) {
      const url = q.short_url || q.original_url;
      try {
        const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', width: 1024, margin: 2 });
        await updateQR(q.id, { qr_image_svg: svg });
        migrated++;
      } catch {}
    }
  }
  return res.status(200).json({ total: list.length, migrated });
};


