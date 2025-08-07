// api/qr-codes/[qrId].js
const { deleteQR, getQR } = require('../_lib/store');

module.exports = async (req, res) => {
  const { qrId } = req.query;
  if (req.method === 'DELETE') {
    const exists = await getQR(qrId);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    await deleteQR(qrId);
    return res.status(204).end();
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
};