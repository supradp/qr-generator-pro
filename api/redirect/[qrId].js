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
  // Параметр qrId из маршрута
  const { qrId } = req.query;

  // Достаём QR
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

  // Fallback через ipapi.co, если заголовков нет
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

  // Промежуточная страница с авто-переходом
  const target = qr.original_url;
  const safeHref = String(target).replace(/"/g, '&quot;');
  const html = `<!doctype html>
  <html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Перенаправление…</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:#e8f5ec;background:#1c1f22}
      .wrap{max-width:760px;margin:16vh auto;padding:24px}
      .card{background:rgba(0,157,70,.07);border:1px solid rgba(0,157,70,.25);border-radius:20px;padding:28px;backdrop-filter:blur(12px);box-shadow:0 10px 40px rgba(0,0,0,.3)}
      .title{font-size:24px;font-weight:700;margin:0 0 8px}
      .muted{color:#7aaa85;margin:0 0 16px}
      .btn{display:inline-block;margin-top:14px;padding:12px 20px;border-radius:12px;border:1px solid rgba(0,157,70,.4);text-decoration:none;color:#e8f5ec;background:rgba(0,157,70,.12)}
      .link{color:#009d46}
      .bar{height:8px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden;margin:16px 0}
      .bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#009d46,#00c957);border-radius:999px}
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <h1 class="title">Перенаправляем…</h1>
        <p class="muted">Сейчас вы будете перенаправлены на: <br><a class="link" href="${safeHref}">${safeHref}</a></p>
        <div class="bar"><i id="prog"></i></div>
        <a class="btn" href="${safeHref}">Перейти сейчас</a>
      </section>
    </main>
    <script>
      const href = "${safeHref}";
      const bar = document.getElementById('prog');
      let x = 0; const int = setInterval(()=>{ x+=5; bar.style.width = Math.min(x,100)+"%"; if(x>=100){ clearInterval(int); location.replace(href); } }, 50);
    </script>
  </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};