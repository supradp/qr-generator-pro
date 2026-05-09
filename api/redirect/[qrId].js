// api/redirect/[qrId].js
const { getQR, addScan } = require('../_lib/store');
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
  // 1) ipapi.co
  try {
    const j = await fetchJSON(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const out = {
      country: j.country || j.country_code || '',
      region: j.region || j.region_code || j.region_name || '',
      city: j.city || '',
    };
    if (out.country || out.region || out.city) return out;
  } catch {}
  // 2) ipwho.is
  try {
    const j = await fetchJSON(`https://ipwho.is/${encodeURIComponent(ip)}?lang=en`);
    const out = {
      country: j.country_code || j.country || '',
      region: j.region || j.region_name || '',
      city: j.city || '',
    };
    if (out.country || out.region || out.city) return out;
  } catch {}
  return {};
}

module.exports = async (req, res) => {
  // Параметр qrId з маршруту
  const { qrId } = req.query;

  // Отримуємо QR
  const qr = await getQR(qrId);
  if (!qr) return res.status(404).send('QR not found');

  const ua = req.headers['user-agent'] || 'unknown';
  const allowOverride = (process.env.ALLOW_IP_OVERRIDE === '1') || (process.env.NODE_ENV !== 'production');
  const ipOverride = allowOverride ? (req.query.__ip || '') : '';
  const ipRaw = (ipOverride || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ip = ipRaw && ipRaw.startsWith('::ffff:') ? ipRaw.slice(7) : ipRaw;
  let country = req.headers['x-vercel-ip-country'] || req.headers['x-upstash-country'] || '';
  let region = req.headers['x-vercel-ip-country-region'] || '';
  let city = req.headers['x-vercel-ip-city'] || '';

  // Fallback через ipapi.co, якщо немає заголовків
  if ((!country || !city || !region) && ip) {
    try {
      const geo = await resolveGeo(ip);
      country = country || geo.country || '';
      region = region || geo.region || '';
      city = city || geo.city || '';
    } catch {}
  }
  const referer = req.headers['referer'] || '';

  if (String(qr.tracking) !== 'false') {
    try { await addScan({ qr_id: qrId, user_agent: ua, ip_address: ip, country, region, city, referer }); } catch (e) { console.error(e); }
  }

  // Проміжна сторінка з авто-переходом
  const target = qr.original_url;
  const safeHref = String(target).replace(/"/g, '&quot;');
  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>MOTORNI — Перехід…</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'JetBrains Mono',monospace;
      background:#09090B;color:#E2E2E2;
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background-image:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);
      background-size:28px 28px;
    }
    .card{
      width:100%;max-width:520px;margin:24px;
      padding:36px;
      border:1px solid rgba(255,255,255,.07);
      border-radius:12px;
      background:#111115;
    }
    .brand{
      font-family:'Bebas Neue',sans-serif;
      font-size:.9rem;letter-spacing:6px;
      color:rgba(0,255,136,.45);
      display:flex;align-items:center;gap:10px;
      margin-bottom:36px;
    }
    .brand-sq{
      display:inline-block;width:16px;height:16px;
      border:2px solid rgba(0,255,136,.6);border-radius:3px;
      position:relative;flex-shrink:0;
    }
    .brand-sq::after{
      content:'';position:absolute;inset:3px;
      background:rgba(0,255,136,.6);border-radius:1px;
    }
    .eyebrow{
      font-size:.58rem;letter-spacing:4px;
      color:#00FF88;margin-bottom:14px;
    }
    .heading{
      font-family:'Bebas Neue',sans-serif;
      font-size:3rem;letter-spacing:8px;
      color:#E2E2E2;line-height:1;
      margin-bottom:32px;
    }
    .dest-label{
      font-size:.55rem;letter-spacing:3px;
      color:#555;margin-bottom:8px;
    }
    .dest-url{
      display:block;color:#00FF88;text-decoration:none;
      font-size:.78rem;word-break:break-all;line-height:1.6;
      margin-bottom:28px;
      padding:12px 14px;
      border:1px solid rgba(0,255,136,.15);
      border-radius:6px;
      background:rgba(0,255,136,.05);
      transition:border-color .2s;
    }
    .dest-url:hover{border-color:rgba(0,255,136,.4);}
    .track{
      height:2px;background:rgba(255,255,255,.06);
      border-radius:999px;overflow:hidden;margin-bottom:24px;
    }
    .fill{
      display:block;height:100%;width:0;
      background:#00FF88;border-radius:999px;
      box-shadow:0 0 8px rgba(0,255,136,.6);
    }
    .row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .go{
      display:inline-flex;align-items:center;gap:8px;
      padding:11px 20px;
      border:1px solid rgba(0,255,136,.3);border-radius:6px;
      text-decoration:none;color:#E2E2E2;
      font-size:.7rem;letter-spacing:2px;
      background:rgba(0,255,136,.08);
      transition:all .2s;white-space:nowrap;
    }
    .go:hover{border-color:#00FF88;color:#00FF88;}
    .countdown{
      font-size:.62rem;letter-spacing:2px;color:#444;
      text-align:right;white-space:nowrap;
    }
    .countdown span{color:#E2E2E2;font-size:.88rem;}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="brand-sq"></span>MOTORNI</div>
    <p class="eyebrow">QR CODE REDIRECT</p>
    <h1 class="heading">REDIRECTING…</h1>
    <p class="dest-label">DESTINATION</p>
    <a class="dest-url" href="${safeHref}">${safeHref}</a>
    <div class="track"><span class="fill" id="fill"></span></div>
    <div class="row">
      <a class="go" href="${safeHref}">ПЕРЕЙТИ ЗАРАЗ →</a>
      <div class="countdown">АВТО ЧЕРЕЗ <span id="cnt">3</span> С</div>
    </div>
  </div>
  <script>
    const href="${safeHref}";
    const fill=document.getElementById('fill');
    const cnt=document.getElementById('cnt');
    let p=0,s=3;
    const ti=setInterval(()=>{p+=100/60;fill.style.width=Math.min(p,100)+'%';},50);
    const si=setInterval(()=>{s--;cnt.textContent=s;if(s<=0){clearInterval(si);clearInterval(ti);location.replace(href);}},1000);
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};