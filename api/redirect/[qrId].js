// api/redirect/[qrId].js
const { getQR, addScan } = require('../_lib/store');
const geoip = require('geoip-lite');

module.exports = async (req, res) => {
  // Параметр qrId из маршрута
  const { qrId } = req.query;

  // Достаём QR
  const qr = await getQR(qrId);
  if (!qr) return res.status(404).send('QR not found');

  const ua = req.headers['user-agent'] || 'unknown';
  const ipRaw = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ip = ipRaw && ipRaw.startsWith('::ffff:') ? ipRaw.slice(7) : ipRaw;
  let country = req.headers['x-vercel-ip-country'] || req.headers['x-upstash-country'] || '';
  let region = req.headers['x-vercel-ip-country-region'] || '';
  let city = req.headers['x-vercel-ip-city'] || '';

  // Fallback на локальную GeoIP, если заголовков нет
  if ((!country || !city || !region) && ip) {
    try {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = country || (geo.country || '');
        region = region || (geo.region || '');
        city = city || (geo.city || '');
      }
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
      :root{--bg:#0f1222;--panel:rgba(255,255,255,.06);--border:rgba(255,255,255,.15);--text:#e9ecff;--muted:#aab0d6}
      *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:var(--text);background:radial-gradient(1000px 600px at 10% 10%,rgba(102,126,234,.25),transparent),radial-gradient(800px 600px at 90% 70%,rgba(118,75,162,.25),transparent),linear-gradient(120deg,#0f1222,#1a1f35)}
      .wrap{max-width:760px;margin:16vh auto;padding:24px}
      .card{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:24px;backdrop-filter:blur(12px);box-shadow:0 10px 40px rgba(0,0,0,.25)}
      .title{font-size:24px;font-weight:700;margin:0 0 8px}
      .muted{color:var(--muted);margin:0 0 16px}
      .btn{display:inline-block;margin-top:12px;padding:12px 16px;border-radius:12px;border:1px solid var(--border);text-decoration:none;color:var(--text)}
      .link{color:#a9c1ff}
      .bar{height:10px;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:999px;overflow:hidden}
      .bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#667eea,#764ba2)}
      code{background:rgba(255,255,255,.07);padding:2px 6px;border-radius:8px}
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