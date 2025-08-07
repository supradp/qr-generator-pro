const { getGlobalStats } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const days = Number(req.query.days || 30);
  const data = await getGlobalStats({ days });
  return res.status(200).json(data);
};


