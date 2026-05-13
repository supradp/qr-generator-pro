// api/me.js — returns current admin info if authenticated
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!requireAuth(req, res)) return;
  return res.status(200).json({ username: req.admin.sub });
};
