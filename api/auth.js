// api/auth.js — GET (me) / POST action=login|logout
const { checkCredentials, signToken, setAuthCookie, clearAuthCookie, requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  // GET /api/auth → check current session
  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    return res.status(200).json({ username: req.admin.sub });
  }

  if (req.method === 'POST') {
    const { action, username, password } = req.body || {};

    // POST /api/auth { action: 'logout' }
    if (action === 'logout') {
      clearAuthCookie(res);
      return res.status(200).json({ ok: true });
    }

    // POST /api/auth { action: 'login', username, password }
    if (action === 'login') {
      if (!username || !password) return res.status(400).json({ error: 'Введіть логін та пароль' });
      if (!checkCredentials(username, password)) {
        await new Promise(r => setTimeout(r, 400));
        return res.status(401).json({ error: 'Невірний логін або пароль' });
      }
      const token = signToken({ sub: username });
      setAuthCookie(res, token);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
