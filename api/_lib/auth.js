// api/_lib/auth.js — JWT (Node crypto, no extra deps) + requireAuth helper
const crypto = require('crypto');

function getSecret() {
  return process.env.JWT_SECRET || 'motorni-dev-secret-change-in-production';
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload, ttlSec = 7 * 24 * 3600) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig    = b64url(crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = b64url(crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest());
  try {
    // Both are base64url of HMAC-SHA256 → always same length (43 chars)
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function checkCredentials(username, password) {
  const validUser = process.env.ADMIN_USERNAME || '';
  const validPass = process.env.ADMIN_PASSWORD || '';
  if (!validUser || !validPass) return false;
  // Timing-safe: hash both to equal-length buffers before comparing
  const h1 = crypto.createHash('sha256').update(`${username}:${password}`).digest();
  const h2 = crypto.createHash('sha256').update(`${validUser}:${validPass}`).digest();
  return crypto.timingSafeEqual(h1, h2);
}

function parseCookies(req) {
  const result = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const eq = part.indexOf('=');
    if (eq < 0) return;
    const k = decodeURIComponent(part.slice(0, eq).trim());
    const v = decodeURIComponent(part.slice(eq + 1).trim());
    result[k] = v;
  });
  return result;
}

const COOKIE_NAME = 'motorni_token';
const COOKIE_TTL  = 7 * 24 * 3600; // 7 days in seconds

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/${secure}; Max-Age=${COOKIE_TTL}`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

// Returns true if authenticated (and attaches payload to req.admin).
// Returns false and sends 401 if not.
function requireAuth(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  req.admin = payload;
  return true;
}

module.exports = { signToken, verifyToken, checkCredentials, parseCookies, setAuthCookie, clearAuthCookie, requireAuth, COOKIE_NAME };
