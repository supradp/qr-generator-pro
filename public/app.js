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

  // Плавная прокрутка
  $all('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (el){ e.preventDefault(); el.scrollIntoView({ behavior:'smooth' }); }
  }));

  // Генерация
  $('#generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#url').value.trim();
    const tracking = $('#tracking').checked;

    try { new URL(url); } catch { return toast('Введите корректный URL'); }

    const btn = e.submitter; const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Создание…';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tracking }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      $('#qrImage').src = data.qr_image_png || data.qr_image;
      $('#shortUrl').href = data.short_url;
      $('#shortUrl').textContent = data.short_url;
      // $('#downloadPng').href = data.qr_image_png || data.qr_image; // PNG отключён
      // SVG как Blob URL
      if (data.qr_image_svg) {
        const svgBlob = new Blob([data.qr_image_svg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        $('#downloadSvg').href = svgUrl;
      } else {
        $('#downloadSvg').removeAttribute('href');
      }
      $('#result').classList.remove('hidden');
      toast('QR-код создан');
      loadList();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  });

  $('#copyLink').addEventListener('click', async () => {
    const link = $('#shortUrl').href; await navigator.clipboard.writeText(link); toast('Ссылка скопирована');
  });

  $('#refresh').addEventListener('click', loadList);
  $('#closeDetails').addEventListener('click', ()=> $('#details').classList.add('hidden'));
  // Табы в деталях
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
  // Инициализация таймзоны по браузеру (Днепр/Украина → Europe/Kyiv)
  if (tzSel) {
    const browserOffset = new Date().getTimezoneOffset(); // например, -180 для Киев (летом)
    const zoneName = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local').replace('Kiev','Kyiv');
    // Если такого варианта нет в списке — добавим
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
  tbody.innerHTML = '<tr><td colspan="6">Загрузка…</td></tr>';
  try {
    const res = await fetch('/api/qr-codes');
    const arr = await res.json();
    if (!Array.isArray(arr)) throw new Error('Ошибка загрузки');

    if (arr.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Пока нет QR-кодов</td></tr>';
      lucideInit();
      return;
    }

    const rows = await Promise.all(arr.map(async (x)=>{
      // Для уникальных нужно дёрнуть stats (чтобы не хранить лишнее в списке)
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
        <td><span class="status ${String(x.tracking)!=='false'?'on':''}">${String(x.tracking)!=='false'?'Отслеживается':'Без трекинга'}</span></td>
        <td class="actions">
          <button class="btn btn-ghost" data-act="stats" data-id="${x.id}"><i data-lucide="bar-chart-3"></i> Статистика</button>
          <a class="btn btn-ghost" href="/redirect/${x.id}" target="_blank"><i data-lucide="link"></i> Открыть</a>
          <!-- <a class=\"btn btn-ghost\" href=\"${x.qr_image_png || x.qr_image}\" download=\"qr-${x.id}.png\"><i data-lucide=\"download\"></i> PNG</a> -->
          ${x.qr_image_svg ? `<a class=\"btn btn-ghost\" href=\"${svgHref}\" download=\"qr-${x.id}.svg\"><i data-lucide=\"download\"></i> SVG</a>` : ''}
          <button class="btn btn-ghost" data-act="delete" data-id="${x.id}"><i data-lucide="trash-2"></i> Удалить</button>
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
    tbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>';
  }
}

async function onDelete(id){
  if (!confirm('Удалить QR-код и его статистику?')) return;
  const res = await fetch(`/api/qr-codes/${id}`, { method: 'DELETE' });
  if (res.status === 204) { toast('Удалено'); loadList(); }
  else { const j = await res.json().catch(()=>({})); toast(j.error||'Ошибка удаления'); }
}

async function openStats(id){
  const panel = $('#details');
  panel.classList.remove('hidden');
  $('#statsMeta').innerHTML = 'Загрузка…';
  $('#scanTable').innerHTML = '';
  try {
    const days = Number(document.getElementById('period')?.value || 30);
    const tz = Number(document.getElementById('timezone')?.value || 0);
    const data = await (await fetch(`/api/stats/${id}?days=${days}&tz=${tz}`)).json();
    const meta = `
      <div class="pill"><strong>ID:</strong> ${data.id}</div>
      <div class="pill"><strong>Всего сканов:</strong> ${data.scan_count}</div>
      <div class="pill"><strong>Уникальные посетители:</strong> ${data.unique_visitors}</div>
      <div class="pill" style="grid-column:1/-1"><strong>Оригинальный URL:</strong> <a href="${data.original_url}" target="_blank">${escapeHtml(data.original_url)}</a></div>
    `;
    $('#statsMeta').innerHTML = meta;

    // График по дням
    drawDailyChart('chartDaily', data.series_daily, 'Сканы по дням');

    // Диаграмма по User-Agent
    const agg = aggregateBy(data.scans||[], s => (s.user_agent||'unknown').split(' ').slice(0,1)[0]);
    drawBarChart('chartUA', agg, 'Топ User-Agent');
    drawBarChart('chartCountriesQR', (data.breakdowns?.countries||[]), 'Страны');
    drawBarChart('chartRegionsQR', (data.breakdowns?.regions||[]), 'Регионы');
    drawBarChart('chartDevicesQR', (data.breakdowns?.devices||[]), 'Устройства');
    drawBarChart('chartOSQR', (data.breakdowns?.os||[]), 'ОС');
    drawBarChart('chartBrowsersQR', (data.breakdowns?.browsers||[]), 'Браузеры');
    drawBarChart('chartHoursQR', (data.breakdowns?.hours||[]), 'Часы');
    drawBarChart('chartWeekdaysQR', (data.breakdowns?.weekdays||[]), 'Дни недели');

    const rows = (data.scans||[]).map(s=>`<tr>
      <td>${formatDate(s.scanned_at)}</td>
      <td>${(s.country||'').toString().toUpperCase()}</td>
      <td>${escapeHtml(s.region||'')}</td>
      <td>${escapeHtml(s.city||'')}</td>
      <td>${s.ip_address||''}</td>
      <td><small>${escapeHtml(s.user_agent||'')}</small></td>
    </tr>`).join('');
    $('#scanTable').innerHTML = rows || '<tr><td colspan="6">Сканов пока нет</td></tr>';
  } catch (e) {
    $('#statsMeta').innerHTML = 'Ошибка загрузки';
  }
}

function formatDate(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function escapeHtml(str=''){
  return str.replace(/[&<>\"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'
  })[c]);
}

// ====== Глобальная статистика ======
async function loadGlobal(){
  const days = Number(document.getElementById('period')?.value || 30);
  const tz = Number(document.getElementById('timezone')?.value || 0);
  try{
    const data = await (await fetch(`/api/stats-global?days=${days}&tz=${tz}`)).json();
    $('#globalKpi').innerHTML = `
      <div class="pill"><strong>QR всего:</strong> ${data.total_qrs}</div>
      <div class="pill"><strong>Сканы всего:</strong> ${data.total_scans}</div>
      <div class="pill"><strong>Уникальные посетители:</strong> ${data.total_unique_visitors}</div>
    `;
    drawDailyChart('chartGlobalDaily', data.series_daily, 'Все сканы по дням');
    // Топ QR
    drawBarChart('chartTopQrs', data.top_qrs.map(x=>({ label:x.id.slice(0,6), value:x.scan_count })), 'Топ QR по сканам');
    drawBarChart('chartCountries', (data.breakdowns?.countries||[]), 'Страны');
    drawBarChart('chartRegions', (data.breakdowns?.regions||[]), 'Регионы');
    drawBarChart('chartDevices', (data.breakdowns?.devices||[]), 'Устройства');
    lucideInit();
  }catch(e){
    $('#globalKpi').innerHTML = 'Ошибка загрузки';
  }
}

// ====== helpers для графиков ======
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
    data:{ labels, datasets:[{ label, data, tension:.3, borderColor:'#4facfe', backgroundColor:'rgba(79,172,254,.15)', fill:true }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
  });
}
function drawBarChart(canvasId, items, label){
  const ctx = ensureCtx(canvasId); if (!ctx) return;
  const labels = items.map(i=>i.label);
  const data = items.map(i=>i.value);
  charts[canvasId] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label, data, backgroundColor:'rgba(102,126,234,.6)', borderColor:'#667eea' }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
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