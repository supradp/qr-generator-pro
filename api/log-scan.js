// api/log-scan.js
// Клиентский лог скана: определяем IP/гео на сервере, сохраняем скан
const { addScan, getQR } = require('./_lib/store');
const https = require('https');

async function fetchJSON(url){
  if (typeof fetch !== 'undefined'){
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('fetch failed');
    return resp.json();
  }
  return new Promise((resolve, reject)=>{
    const req = https.get(url, (res)=>{
      let data='';
      res.on('data', c=> data+=c);
      res.on('end', ()=>{ try{ resolve(JSON.parse(data||'{}')); } catch(e){ reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(2000, ()=>{ req.destroy(); reject(new Error('timeout')); });
  });
}

async function resolveGeo(ip){
  if (!ip) return {};
  try {
    const j = await fetchJSON(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const out = { country: j.country || j.country_code || '', region: j.region || j.region_code || j.region_name || '', city: j.city || '' };
    if (out.country || out.region || out.city) return out;
  } catch {}
  try {
    const j = await fetchJSON(`https://ipwho.is/${encodeURIComponent(ip)}?lang=en`);
    const out = { country: j.country_code || j.country || '', region: j.region || j.region_name || '', city: j.city || '' };
    if (out.country || out.region || out.city) return out;
  } catch {}
  return {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { qr_id } = req.body || {};
  if (!qr_id) return res.status(400).json({ error: 'qr_id is required' });
  const qr = await getQR(qr_id);
  if (!qr) return res.status(404).json({ error: 'QR not found' });

  const ua = req.headers['user-agent'] || 'unknown';
  const allowOverride = (process.env.ALLOW_IP_OVERRIDE === '1') || (process.env.NODE_ENV !== 'production');
  const ipOverride = allowOverride ? (req.query.__ip || '') : '';
  const ipRaw = (ipOverride || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ip = ipRaw && ipRaw.startsWith('::ffff:') ? ipRaw.slice(7) : ipRaw;

  let country = req.headers['x-vercel-ip-country'] || '';
  let region = req.headers['x-vercel-ip-country-region'] || '';
  let city = req.headers['x-vercel-ip-city'] || '';
  if ((!country || !city || !region) && ip) {
    try { const geo = await resolveGeo(ip); country = country || geo.country || ''; region = region || geo.region || ''; city = city || geo.city || ''; } catch {}
  }

  const scan = await addScan({ qr_id, user_agent: ua, ip_address: ip, country, region, city, referer: req.headers['referer'] || '' });
  return res.status(201).json(scan);
};