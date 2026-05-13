// api/redirect/[qrId].js
const { getQR, addScan } = require('../_lib/store');
const https = require('https');

// ── Link-in-bio page generator ─────────────────────────────────
const PLATFORM_ICONS = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  tiktok:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.69a8.27 8.27 0 004.83 1.53V6.77a4.85 4.85 0 01-1.07-.08z"/></svg>`,
  youtube:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon fill="#fff" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>`,
  telegram:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
  whatsapp:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  facebook:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  twitter:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  linkedin:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  viber:     `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4.1C5.1.4.1 5.4 0 11.7c-.1 3.6 1.4 7 4.1 9.4v3.3L7.4 23c1.3.4 2.6.6 3.9.6 6.6 0 12-5.4 12-12S18 0 11.4 0zm3.2 16.2c-.5 1.3-2.4 2.4-3.5 2.5-.2 0-.5.1-.7.1-.8 0-1.6-.2-2.3-.5-2.7-1.1-5-3.6-5.8-6.5-.2-.6-.3-1.3-.2-1.9.1-1.3 1.2-2.9 2.5-3.4.5-.2.7 0 1 .5l1.6 3c.2.5 0 .8-.3 1.1-.3.2-.6.5-.5.9.4 1.6 1.9 3 3.5 3.4.4.1.7-.2.9-.5.3-.3.6-.5 1.1-.3l3 1.6c.5.3.6.5.5.9z"/></svg>`,
  github:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`,
  pinterest: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`,
  website:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  custom:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
};

const PLATFORM_COLORS = {
  instagram: '#E1306C', tiktok: '#010101', youtube: '#FF0000',
  telegram: '#2CA5E0',  whatsapp: '#25D366', facebook: '#1877F2',
  twitter: '#E2E8F0',   linkedin: '#0A66C2', viber: '#7360F2',
  github: '#aaa',       pinterest: '#E60023', website: '#888',
  custom: '#888',
};

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function generateLinkPageHTML(cfg) {
  const title      = esc(cfg.title || '');
  const subtitle   = esc(cfg.subtitle || '');
  const logoUrl    = esc(cfg.logo_url || '');
  const bgColor    = /^#[0-9a-fA-F]{3,8}$/.test(cfg.bg_color || '')     ? cfg.bg_color    : '#09090B';
  const accentColor= /^#[0-9a-fA-F]{3,8}$/.test(cfg.accent_color || '') ? cfg.accent_color: '#00FF88';
  const links      = Array.isArray(cfg.links) ? cfg.links : [];
  const initials   = (cfg.title || '?').slice(0,2).toUpperCase();

  const linksHtml = links.map(link => {
    const href    = esc(link.url || '#');
    const label   = esc(link.label || link.platform || '');
    const p       = (link.platform || 'custom').toLowerCase();
    const icon    = PLATFORM_ICONS[p] || PLATFORM_ICONS.custom;
    const color   = PLATFORM_COLORS[p] || accentColor;
    return `<a class="link-btn" href="${href}" target="_blank" rel="noopener noreferrer">
      <span class="link-icon" style="color:${color}">${icon}</span>
      <span class="link-label">${label}</span>
      <span class="link-arrow">→</span>
    </a>`;
  }).join('\n');

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'DM Sans',system-ui,sans-serif;
      background:${bgColor};
      min-height:100dvh;
      display:flex;flex-direction:column;align-items:center;
      padding:48px 20px 64px;
    }
    .container{width:100%;max-width:480px;display:flex;flex-direction:column;align-items:center;}
    .logo{
      width:96px;height:96px;border-radius:50%;object-fit:cover;
      border:3px solid rgba(255,255,255,.15);margin-bottom:18px;
    }
    .logo-fallback{
      width:96px;height:96px;border-radius:50%;
      background:rgba(255,255,255,.07);
      border:3px solid rgba(255,255,255,.15);
      display:flex;align-items:center;justify-content:center;
      font-family:'Bebas Neue',sans-serif;font-size:2.2rem;
      color:${accentColor};margin-bottom:18px;
    }
    h1{
      font-family:'Bebas Neue',sans-serif;font-size:2.4rem;
      letter-spacing:4px;color:#fff;text-align:center;margin-bottom:6px;
    }
    .subtitle{
      font-size:.9rem;color:rgba(255,255,255,.5);
      text-align:center;margin-bottom:32px;
    }
    .links{width:100%;display:flex;flex-direction:column;gap:10px;}
    .link-btn{
      display:flex;align-items:center;gap:14px;
      padding:15px 20px;border-radius:12px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.1);
      text-decoration:none;color:#fff;
      font-size:1rem;font-weight:500;
      transition:background .15s,border-color .15s,transform .15s;
      -webkit-tap-highlight-color:transparent;
    }
    .link-btn:active{background:rgba(255,255,255,.11);transform:scale(.98);}
    @media(hover:hover){.link-btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);transform:translateY(-1px);}}
    .link-icon{width:24px;height:24px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
    .link-icon svg{width:24px;height:24px;}
    .link-label{flex:1;}
    .link-arrow{color:rgba(255,255,255,.25);font-size:.85rem;}
    .footer{
      margin-top:40px;font-size:.65rem;letter-spacing:2px;
      color:rgba(255,255,255,.18);text-align:center;
    }
    .footer a{color:inherit;text-decoration:none;}
  </style>
</head>
<body>
  <div class="container">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="${title}" onerror="this.style.display='none';document.getElementById('lf').style.display='flex'">` : ''}
    <div class="logo-fallback" id="lf"${logoUrl ? ' style="display:none"' : ''}>${initials}</div>
    ${title ? `<h1>${title}</h1>` : ''}
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    <div class="links">
      ${linksHtml}
    </div>
    <p class="footer"><a href="/" target="_blank">MOTORNI QR</a></p>
  </div>
</body>
</html>`;
}

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

  // Сторінка посилань
  if (qr.type === 'page' && qr.page_config) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(generateLinkPageHTML(qr.page_config));
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