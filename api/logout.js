// api/logout.js
const { clearAuthCookie } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
};
