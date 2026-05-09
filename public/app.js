// public/app.js
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

const toast = (msg) => {
  const box = $('#toast');
  $('#toastMsg').textContent = msg;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 2500);
};

function lucideInit(){ if (window.lucide) window.lucide.createIcons(); }

document.addEventListener('DOMContentLoaded', () => {
  lucideInit();
  if (window.Chart) {
    Chart.defaults.color = '#666666';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 10;
  }

  // Плавна прокрутка
  $all('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (el){ e.preventDefault(); el.scrollIntoView({ behavior:'smooth' }); }
  }));

  // Генерація
  $('#generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#url').value.trim();
    const tracking = $('#tracking').checked;

    try { new URL(url); } catch { return toast('Введіть коректний URL'); }

    const btn = e.submitter; const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Створення…';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tracking }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка');

      $('#qrImage').src = data.qr_image_png || data.qr_image;
      $('#shortUrl').href = data.short_url;
      $('#shortUrl').textContent = data.short_url;
      // $('#downloadPng').href = data.qr_image_png || data.qr_image; // PNG вимкнено
      // SVG як Blob URL
      if (data.qr_image_svg) {
        const svgBlob = new Blob([data.qr_image_svg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        $('#downloadSvg').href = svgUrl;
      } else {
        $('#downloadSvg').removeAttribute('href');
      }
      $('#result').classList.remove('hidden');
      toast('QR-код створено');
      loadList();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  });

  $('#copyLink').addEventListener('click', async () => {
    const link = $('#shortUrl').href; await navigator.clipboard.writeText(link); toast('Посилання скопійовано');
  });

  $('#refresh').addEventListener('click', loadList);
  $('#closeDetails').addEventListener('click', ()=> $('#details').classList.add('hidden'));
  // Вкладки в деталях
  $all('.tab-btn').forEach(btn=>btn.addEventListener('click', ()=>{
    $all('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.getAttribute('data-tab');
    $all('.tab-panel').forEach(p=>{
      p.classList.toggle('hidden', p.getAttribute('data-panel')!==tab);
    });
  }));
  $('#refreshGlobal').addEventListener('click', loadGlobal);
  const periodSel = document.getElementById('period');
  const tzSel = document.getElementById('timezone');
  // Часовий пояс за браузером
  if (tzSel) {
    const browserOffset = new Date().getTimezoneOffset();
    const zoneName = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local').replace('Kiev','Kyiv');
    if (![...tzSel.options].some(o => Number(o.value) === browserOffset)) {
      const label = `Локально (${zoneName})`;
      const opt = new Option(label, String(browserOffset), true, true);
      tzSel.add(opt, 0);
      tzSel.selectedIndex = 0;
    } else {
      tzSel.value = String(browserOffset);
    }
  }
  if (periodSel) periodSel.addEventListener('change', loadGlobal);
  if (tzSel) tzSel.addEventListener('change', loadGlobal);

  loadGlobal();
  loadList();
});

async function loadList(){
  const tbody = $('#qrTable');
  tbody.innerHTML = '<tr><td colspan="6">Завантаження…</td></tr>';
  try {
    const res = await fetch('/api/qr-codes');
    const arr = await res.json();
    if (!Array.isArray(arr)) throw new Error('Помилка завантаження');

    if (arr.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Поки немає QR-кодів</td></tr>';
      lucideInit();
      return;
    }

    const rows = await Promise.all(arr.map(async (x)=>{
      let uniques = 0;
      try {
        const st = await (await fetch(`/api/stats/${x.id}`)).json();
        uniques = st.unique_visitors || 0;
      } catch {}
      const svgHref = x.qr_image_svg ? `data:image/svg+xml;utf8,${encodeURIComponent(x.qr_image_svg)}` : '';
      return `<tr>
        <td><code>${x.id.slice(0,8)}</code></td>
        <td><a href="${x.original_url}" target="_blank">${escapeHtml(x.original_url)}</a></td>
        <td>${x.scan_count || 0}</td>
        <td>${uniques}</td>
        <td><span class="status ${String(x.tracking)!=='false'?'on':''}">${String(x.tracking)!=='false'?'Відстежується':'Без трекінгу'}</span></td>
        <td class="actions">
          <button class="btn btn-ghost" data-act="stats" data-id="${x.id}"><i data-lucide="bar-chart-3"></i> Статистика</button>
          <a class="btn btn-ghost" href="/redirect/${x.id}" target="_blank"><i data-lucide="link"></i> Відкрити</a>
          <!-- <a class=\"btn btn-ghost\" href=\"${x.qr_image_png || x.qr_image}\" download=\"qr-${x.id}.png\"><i data-lucide=\"download\"></i> PNG</a> -->
          ${x.qr_image_svg ? `<a class=\"btn btn-ghost\" href=\"${svgHref}\" download=\"qr-${x.id}.svg\"><i data-lucide=\"download\"></i> SVG</a>` : ''}
          <button class="btn btn-ghost" data-act="delete" data-id="${x.id}"><i data-lucide="trash-2"></i> Видалити</button>
        </td>
      </tr>`;
    }));

    tbody.innerHTML = rows.join('');
    lucideInit();

    // Delegation
    tbody.addEventListener('click', async (e)=>{
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'delete') return onDelete(id);
      if (act === 'stats') return openStats(id);
    }, { once: true });

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Помилка завантаження</td></tr>';
  }
}

async function onDelete(id){
  if (!confirm('Видалити QR-код і його статистику?')) return;
  const res = await fetch(`/api/qr-codes/${id}`, { method: 'DELETE' });
  if (res.status === 204) { toast('Видалено'); loadList(); }
  else { const j = await res.json().catch(()=>({})); toast(j.error||'Помилка видалення'); }
}

async function openStats(id){
  const panel = $('#details');
  panel.classList.remove('hidden');
  $('#statsMeta').innerHTML = 'Завантаження…';
  $('#scanTable').innerHTML = '';
  try {
    const days = Number(document.getElementById('period')?.value || 30);
    const tz = Number(document.getElementById('timezone')?.value || 0);
    const data = await (await fetch(`/api/stats/${id}?days=${days}&tz=${tz}`)).json();
    const meta = `
      <div class="pill pill-sm"><strong>ID</strong><code>${data.id.slice(0,12)}…</code></div>
      <div class="pill"><strong>УСЬОГО СКАНУВАНЬ</strong>${data.scan_count}</div>
      <div class="pill"><strong>УНІКАЛЬНІ</strong>${data.unique_visitors}</div>
      <div class="pill pill-sm" style="grid-column:1/-1"><strong>URL</strong><a href="${data.original_url}" target="_blank">${escapeHtml(data.original_url)}</a></div>
    `;
    $('#statsMeta').innerHTML = meta;

    drawDailyChart('chartDaily', data.series_daily, 'Сканування за днями');

    const agg = aggregateBy(data.scans||[], s => (s.user_agent||'unknown').split(' ').slice(0,1)[0]);
    drawBarChart('chartUA', agg, 'Топ User-Agent');
    drawBarChart('chartCountriesQR', (data.breakdowns?.countries||[]), 'Країни');
    drawBarChart('chartRegionsQR', (data.breakdowns?.regions||[]), 'Регіони');
    drawBarChart('chartDevicesQR', (data.breakdowns?.devices||[]), 'Пристрої');
    drawBarChart('chartOSQR', (data.breakdowns?.os||[]), 'ОС');
    drawBarChart('chartBrowsersQR', (data.breakdowns?.browsers||[]), 'Браузери');
    drawBarChart('chartHoursQR', (data.breakdowns?.hours||[]), 'Години');
    drawBarChart('chartWeekdaysQR', (data.breakdowns?.weekdays||[]), 'Дні тижня');

    const rows = (data.scans||[]).map(s=>`<tr>
      <td>${formatDate(s.scanned_at)}</td>
      <td>${(s.country||'').toString().toUpperCase()}</td>
      <td>${escapeHtml(s.region||'')}</td>
      <td>${escapeHtml(s.city||'')}</td>
      <td>${s.ip_address||''}</td>
      <td><small>${escapeHtml(s.user_agent||'')}</small></td>
    </tr>`).join('');
    $('#scanTable').innerHTML = rows || '<tr><td colspan="6">Сканувань поки немає</td></tr>';
  } catch (e) {
    $('#statsMeta').innerHTML = 'Помилка завантаження';
  }
}

function formatDate(iso){
  try { return new Date(iso).toLocaleString('uk-UA'); } catch { return iso; }
}
function escapeHtml(str=''){
  return str.replace(/[&<>\"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'
  })[c]);
}

// ====== Глобальна статистика ======
async function loadGlobal(){
  const days = Number(document.getElementById('period')?.value || 30);
  const tz = Number(document.getElementById('timezone')?.value || 0);
  try{
    const data = await (await fetch(`/api/stats-global?days=${days}&tz=${tz}`)).json();
    $('#globalKpi').innerHTML = `
      <div class="pill"><strong>QR УСЬОГО</strong>${data.total_qrs}</div>
      <div class="pill"><strong>СКАНУВАНЬ УСЬОГО</strong>${data.total_scans}</div>
      <div class="pill"><strong>УНІКАЛЬНІ</strong>${data.total_unique_visitors}</div>
    `;
    drawDailyChart('chartGlobalDaily', data.series_daily, 'Усі сканування за днями');
    drawBarChart('chartTopQrs', data.top_qrs.map(x=>({ label:x.id.slice(0,6), value:x.scan_count })), 'Топ QR за скануваннями');
    drawBarChart('chartCountries', (data.breakdowns?.countries||[]), 'Країни');
    drawBarChart('chartRegions', (data.breakdowns?.regions||[]), 'Регіони');
    drawBarChart('chartDevices', (data.breakdowns?.devices||[]), 'Пристрої');
    lucideInit();
  }catch(e){
    $('#globalKpi').innerHTML = 'Помилка завантаження';
  }
}

// ====== Допоміжні для графіків ======
let charts = {};
function ensureCtx(id){
  const el = document.getElementById(id);
  if (!el) return null;
  if (charts[id]) { charts[id].destroy(); charts[id] = null; }
  return el.getContext('2d');
}
function drawDailyChart(canvasId, series, label){
  const ctx = ensureCtx(canvasId); if (!ctx) return;
  const labels = series.map(x=>x.date);
  const data = series.map(x=>x.count);
  charts[canvasId] = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label, data, tension:.4, borderColor:'#00FF88', backgroundColor:'rgba(0,255,136,0.07)', fill:true, pointBackgroundColor:'#00FF88', pointRadius:3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(255,255,255,0.05)' } }, x:{ grid:{ color:'rgba(255,255,255,0.05)' } } } }
  });
}
function drawBarChart(canvasId, items, label){
  const ctx = ensureCtx(canvasId); if (!ctx) return;
  const labels = items.map(i=>i.label);
  const data = items.map(i=>i.value);
  charts[canvasId] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label, data, backgroundColor:'rgba(0,255,136,0.3)', borderColor:'#00FF88', borderWidth:1, borderRadius:3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 }, grid:{ color:'rgba(255,255,255,0.05)' } }, x:{ grid:{ color:'rgba(255,255,255,0.04)' } } } }
  });
}
function aggregateBy(arr, keyFn){
  const map = new Map();
  for(const x of arr){ const k = keyFn(x); map.set(k, (map.get(k)||0)+1); }
  return Array.from(map.entries())
    .map(([label, value])=>({ label, value }))
    .sort((a,b)=>b.value-a.value)
    .slice(0,10);
}
