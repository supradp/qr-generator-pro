const { getAllQRs } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const list = await getAllQRs();
    return res.status(200).json(list);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};


