// api/qr-codes/[qrId].js
const { deleteQR, getQR, updateQR } = require('../_lib/store');
const { requireAuth } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { qrId } = req.query;

  if (req.method === 'DELETE') {
    const exists = await getQR(qrId);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    await deleteQR(qrId);
    return res.status(204).end();
  }

  if (req.method === 'PATCH') {
    const exists = await getQR(qrId);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    const { folder_id } = req.body || {};
    const updated = await updateQR(qrId, { folder_id: folder_id || null });
    return res.json(updated);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};