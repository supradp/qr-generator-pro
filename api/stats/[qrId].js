// api/stats/[qrId].js
const { getStats } = require('../_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const { qrId } = req.query;
  const days = Number(req.query.days || 30);
  const tzOffset = Number(req.query.tz || 0);
  const stats = await getStats(qrId, { days, tzOffset });
  if (!stats) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json(stats);
};