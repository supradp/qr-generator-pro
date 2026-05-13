// api/login.js
const { checkCredentials, signToken, setAuthCookie } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Введіть логін та пароль' });

  if (!checkCredentials(username, password)) {
    // Same delay regardless of whether user exists to prevent user enumeration
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error: 'Невірний логін або пароль' });
  }

  const token = signToken({ sub: username });
  setAuthCookie(res, token);
  return res.status(200).json({ ok: true });
};
