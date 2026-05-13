// public/app.js
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

// ── Page builder constants ──────────────────────────────────────
const PLATFORM_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
  telegram: 'Telegram',   whatsapp: 'WhatsApp', facebook: 'Facebook',
  twitter: 'Twitter / X', linkedin: 'LinkedIn', viber: 'Viber',
  github: 'GitHub',       pinterest: 'Pinterest', website: 'Вебсайт',
  custom: 'Інше…',
};
let pageLinkCounter = 0;

function buildPlatformOptions(selected = 'instagram') {
  return Object.entries(PLATFORM_LABELS)
    .map(([v, l]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`)
    .join('');
}

function addPageLinkItem(platform = 'instagram') {
  const container = $('#pageLinks');
  if (!container) return;
  const idx = pageLinkCounter++;
  const item = document.createElement('div');
  item.className = 'page-link-item';
  item.dataset.idx = idx;
  item.innerHTML = `
    <div class="page-link-top">
      <select class="field-input field-select platform-sel" style="font-size:.78rem">
        ${buildPlatformOptions(platform)}
      </select>
      <button type="button" class="page-link-del" title="Видалити"><i data-lucide="trash-2"></i></button>
    </div>
    <input type="text"  class="field-input link-label-inp" placeholder="Мітка кнопки" value="${escapeHtml(PLATFORM_LABELS[platform] || '')}">
    <input type="url"   class="field-input link-url-inp"   placeholder="https://…">
  `;
  const sel = item.querySelector('.platform-sel');
  const labelInp = item.querySelector('.link-label-inp');
  sel?.addEventListener('change', () => {
    if (!labelInp.dataset.edited) labelInp.value = PLATFORM_LABELS[sel.value] || '';
  });
  labelInp?.addEventListener('input', () => { labelInp.dataset.edited = '1'; });
  item.querySelector('.page-link-del')?.addEventListener('click', () => item.remove());
  container.appendChild(item);
  lucideInit();
}

function collectPageConfig() {
  const links = [];
  $all('#pageLinks .page-link-item').forEach(item => {
    const platform = item.querySelector('.platform-sel')?.value || 'custom';
    const label    = item.querySelector('.link-label-inp')?.value.trim() || '';
    const url      = item.querySelector('.link-url-inp')?.value.trim() || '';
    if (url) links.push({ platform, label, url });
  });
  return {
    title:        $('#pageTitle')?.value.trim()    || '',
    subtitle:     $('#pageSubtitle')?.value.trim() || '',
    logo_url:     $('#pageLogoUrl')?.value.trim()  || '',
    bg_color:     $('#pageBgColor')?.value         || '#09090B',
    accent_color: $('#pageAccentColor')?.value     || '#00FF88',
    links,
  };
}

// Folder state
let allFolders = [];
let currentFolderId = ''; // '' = show all

const toast = (msg) => {
  const box = $('#toast');
  $('#toastMsg').textContent = msg;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 2500);
};

function lucideInit(){ if (window.lucide) window.lucide.createIcons(); }

// ── Global 401 interceptor ──────────────────────────────────────
const _origFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  if (res.status === 401 && !args[0]?.toString().includes('/api/auth')) {
    window.location.href = '/login.html';
  }
  return res;
};

// ── Auth check — redirect to login if not authenticated ─────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth');
    if (res.status === 401) { window.location.href = '/login.html'; return false; }
  } catch { window.location.href = '/login.html'; return false; }
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!await checkAuth()) return;
  lucideInit();
  if (window.Chart) {
    Chart.defaults.color = '#666666';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 10;
  }

  // Logout
  $('#logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    window.location.href = '/login.html';
  });

  // QR type toggle
  $all('.qr-type-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      $('#qrType').value = type;
      $all('.qr-type-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isPage = type === 'page';
      $('#urlTypeSection')?.classList.toggle('hidden', isPage);
      $('#pageTypeSection')?.classList.toggle('hidden', !isPage);
      const urlInput = $('#url');
      if (urlInput) urlInput.required = !isPage;
      if (isPage && !$('#pageLinks .page-link-item')) addPageLinkItem();
    });
  });

  // Page builder: add first link item on init (hidden until page mode)
  addPageLinkItem('instagram');
  $('#addPageLink')?.addEventListener('click', () => addPageLinkItem());

  // Авто-фокус на поле URL
  setTimeout(() => $('#url')?.focus(), 150);

  // Кнопка очищення URL + інлайн-помилки
  const urlInput = $('#url');
  const urlClear = $('#urlClear');
  const urlError = $('#urlError');
  urlInput?.addEventListener('input', () => {
    urlClear?.classList.toggle('hidden', !urlInput.value);
    urlError?.classList.add('hidden');
  });
  urlClear?.addEventListener('click', () => {
    urlInput.value = '';
    urlClear.classList.add('hidden');
    urlError?.classList.add('hidden');
    urlInput.focus();
  });

  // Мобільне меню (гамбургер)
  const burger = $('#burger');
  const mobileNav = $('#mobileNav');
  burger?.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileNav?.classList.toggle('hidden');
  });
  $all('#mobileNav .mnav-link').forEach(a => a.addEventListener('click', () => {
    burger?.classList.remove('open');
    mobileNav?.classList.add('hidden');
  }));

  // Кнопка "Новий QR"
  $('#newQr')?.addEventListener('click', () => {
    $('#result').classList.add('hidden');
    urlInput.value = '';
    urlClear?.classList.add('hidden');
    urlInput.focus();
  });

  // Плавна прокрутка
  $all('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = document.querySelector(id);
    if (el){ e.preventDefault(); el.scrollIntoView({ behavior:'smooth' }); }
  }));

  // Папки: ініціалізація вкладок
  $('#addFolderBtn')?.addEventListener('click', () => {
    $('#folderCreateRow')?.classList.remove('hidden');
    $('#folderNameInput')?.focus();
  });
  $('#folderCreateCancel')?.addEventListener('click', hideFolderCreate);
  $('#folderCreateConfirm')?.addEventListener('click', submitNewFolder);
  $('#folderNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNewFolder();
    if (e.key === 'Escape') hideFolderCreate();
  });

  loadFolders();

  // Генерація
  $('#generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = $('#qrType').value || 'url';
    const tracking = $('#tracking').checked;
    const folder_id = $('#qrFolder')?.value || null;

    let body;
    if (type === 'page') {
      const cfg = collectPageConfig();
      if (!cfg.title) { toast('Введіть назву компанії'); $('#pageTitle')?.focus(); return; }
      if (!cfg.links.length) { toast('Додайте хоча б одне посилання з URL'); return; }
      body = { type: 'page', page_config: cfg, tracking, folder_id: folder_id || null };
    } else {
      const url = $('#url').value.trim();
      try { new URL(url); } catch {
        if (urlError) { urlError.textContent = 'Введіть коректний URL (починається з https://)'; urlError.classList.remove('hidden'); }
        urlInput?.focus();
        return;
      }
      body = { url, tracking, folder_id: folder_id || null };
    }

    const btn = e.submitter; const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Створення…';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка');

      $('#qrImage').src = data.qr_image_png || data.qr_image;
      $('#shortUrl').href = data.short_url;
      $('#shortUrl').textContent = data.short_url;
      if (data.qr_image_svg) {
        const svgBlob = new Blob([data.qr_image_svg], { type: 'image/svg+xml' });
        $('#downloadSvg').href = URL.createObjectURL(svgBlob);
      } else {
        $('#downloadSvg').removeAttribute('href');
      }
      $('#result').classList.remove('hidden');
      setTimeout(() => $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
      toast(type === 'page' ? 'Сторінку посилань створено' : 'QR-код створено');
      loadList();
    } catch (err) { toast(err.message); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  });

  $('#copyLink').addEventListener('click', async () => {
    const link = $('#shortUrl').href;
    await navigator.clipboard.writeText(link);
    const btn = $('#copyLink');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check"></i> СКОПІЙОВАНО';
    lucideInit();
    setTimeout(() => { btn.innerHTML = orig; lucideInit(); }, 2200);
    toast('Посилання скопійовано');
  });

  $('#refresh').addEventListener('click', loadFolders);
  $('#closeDetails').addEventListener('click', () => {
    $('#details').classList.add('hidden');
    document.getElementById('list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
  // loadList is called by loadFolders after folders are fetched
});


// ====== Папки ======
function hideFolderCreate() {
  $('#folderCreateRow')?.classList.add('hidden');
  if ($('#folderNameInput')) $('#folderNameInput').value = '';
}

async function submitNewFolder() {
  const input = $('#folderNameInput');
  const name = input?.value?.trim();
  if (!name) { input?.focus(); return; }
  try {
    const res = await fetch('/api/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка');
    hideFolderCreate();
    await loadFolders();
    toast(`Папку «${name}» створено`);
  } catch (err) { toast(err.message); }
}

async function loadFolders() {
  try {
    const res = await fetch('/api/folders');
    allFolders = await res.json();
  } catch { allFolders = []; }
  renderFolderTabs();
  populateFolderSelects();
  loadList();
}

function renderFolderTabs() {
  const bar = $('#folderBar');
  if (!bar) return;

  // Remove existing dynamic tabs (keep first "Всі" and last "+ Нова папка")
  bar.querySelectorAll('.folder-tab-dynamic').forEach(el => el.remove());

  const addBtn = $('#addFolderBtn');

  allFolders.forEach(f => {
    const tab = document.createElement('button');
    tab.className = 'folder-tab folder-tab-dynamic' + (currentFolderId === f.id ? ' active' : '');
    tab.setAttribute('data-folder-id', f.id);
    tab.innerHTML = `<i data-lucide="folder"></i> ${escapeHtml(f.name)} <button class="folder-tab-del" data-folder-del="${f.id}" title="Видалити папку"><i data-lucide="x"></i></button>`;
    bar.insertBefore(tab, addBtn);
  });

  // Update "Всі" active state
  const allTab = bar.querySelector('[data-folder-id=""]');
  if (allTab) allTab.classList.toggle('active', currentFolderId === '');

  lucideInit();

  // Tab click delegation
  bar.onclick = (e) => {
    const delBtn = e.target.closest('[data-folder-del]');
    if (delBtn) { e.stopPropagation(); onDeleteFolder(delBtn.getAttribute('data-folder-del')); return; }
    const tab = e.target.closest('.folder-tab[data-folder-id]');
    if (!tab || tab.id === 'addFolderBtn') return;
    currentFolderId = tab.getAttribute('data-folder-id');
    bar.querySelectorAll('.folder-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadList();
  };
}

function populateFolderSelects() {
  const sel = $('#qrFolder');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— Без папки —</option>';
  allFolders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    if (f.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function onDeleteFolder(folderId) {
  const folder = allFolders.find(f => f.id === folderId);
  if (!folder) return;
  if (!confirm(`Видалити папку «${folder.name}»?\nQR-коди залишаться, але будуть поза папками.`)) return;
  const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
  if (res.status === 204) {
    if (currentFolderId === folderId) currentFolderId = '';
    await loadFolders();
    loadList();
    toast(`Папку «${folder.name}» видалено`);
  } else {
    const j = await res.json().catch(() => ({}));
    toast(j.error || 'Помилка видалення');
  }
}

async function moveQRToFolder(qrId, folderId) {
  const res = await fetch(`/api/qr-codes/${qrId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId || null }),
  });
  if (res.ok) {
    const folderName = folderId ? (allFolders.find(f => f.id === folderId)?.name || '') : '';
    toast(folderId ? `Переміщено до «${folderName}»` : 'Видалено з папки');
    loadList();
  } else {
    const j = await res.json().catch(() => ({}));
    toast(j.error || 'Помилка переміщення');
  }
}

async function loadList(){
  const tbody = $('#qrTable');
  const refreshBtn = $('#refresh');
  refreshBtn?.classList.add('loading');
  tbody.innerHTML = '<tr><td colspan="7" class="tbl-center"><div class="loading-dots"><span></span><span></span><span></span></div></td></tr>';
  try {
    const res = await fetch('/api/qr-codes');
    const allArr = await res.json();
    if (!Array.isArray(allArr)) throw new Error('Помилка завантаження');

    // Update "Всі" counter
    const countAllEl = $('#folderCountAll');
    if (countAllEl) countAllEl.textContent = allArr.length ? `(${allArr.length})` : '';

    // Filter by active folder
    const arr = currentFolderId
      ? allArr.filter(x => x.folder_id === currentFolderId)
      : allArr;

    if (arr.length === 0) {
      const msg = currentFolderId
        ? 'В ЦІЙ ПАПЦІ ЩЕ НЕМАЄ QR-КОДІВ'
        : 'QR-КОДІВ ЩЕ НЕМАЄ';
      tbody.innerHTML = `<tr><td colspan="7" class="tbl-center"><div class="empty-state"><i data-lucide="qr-code"></i><p>${msg}</p><a href="#create" class="ghost-btn"><i data-lucide="plus"></i> СТВОРИТИ ПЕРШИЙ</a></div></td></tr>`;
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
      const folderCell = x.folder_name
        ? `<span class="folder-badge"><i data-lucide="folder"></i> ${escapeHtml(x.folder_name)}</span>`
        : `<span class="folder-badge folder-badge-none">—</span>`;

      const folderOptions = allFolders.map(f =>
        `<option value="${f.id}" ${x.folder_id === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
      ).join('');

      const isPage = x.type === 'page';
      const urlCell = isPage
        ? `<span class="page-type-badge"><i data-lucide="layout" style="width:11px;height:11px"></i> СТОРІНКА</span> ${escapeHtml(x.original_url)}`
        : `<a href="${x.original_url}" target="_blank" title="${escapeHtml(x.original_url)}">${escapeHtml(x.original_url)}</a>`;

      return `<tr>
        <td><code>${x.id.slice(0,8)}</code></td>
        <td class="url-cell">${urlCell}</td>
        <td>${x.scan_count || 0}</td>
        <td>${uniques}</td>
        <td class="folder-cell">
          ${folderCell}
          <select class="folder-move-sel" data-qr-id="${x.id}">
            <option value="">— Без папки —</option>
            ${folderOptions}
          </select>
        </td>
        <td><span class="status ${String(x.tracking)!=='false'?'on':''}">${String(x.tracking)!=='false'?'Відстежується':'Без трекінгу'}</span></td>
        <td class="actions">
          <button class="btn btn-ghost" data-act="stats" data-id="${x.id}"><i data-lucide="bar-chart-3"></i> Статистика</button>
          <a class="btn btn-ghost" href="/redirect/${x.id}" target="_blank"><i data-lucide="${isPage?'layout':'link'}"></i> ${isPage?'Переглянути':'Відкрити'}</a>
          ${x.qr_image_svg ? `<a class="btn btn-ghost" href="${svgHref}" download="qr-${x.id}.svg"><i data-lucide="download"></i> SVG</a>` : ''}
          <button class="btn btn-ghost" data-act="delete" data-id="${x.id}"><i data-lucide="trash-2"></i> Видалити</button>
        </td>
      </tr>`;
    }));

    tbody.innerHTML = rows.join('');
    lucideInit();

    // Move-to-folder select
    tbody.querySelectorAll('.folder-move-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        moveQRToFolder(sel.getAttribute('data-qr-id'), sel.value);
      });
    });

    // Delegation for buttons
    tbody.addEventListener('click', async (e)=>{
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'delete') return onDelete(id);
      if (act === 'stats') return openStats(id);
    }, { once: true });

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="tbl-center"><div class="empty-state"><p>ПОМИЛКА ЗАВАНТАЖЕННЯ</p></div></td></tr>';
  } finally {
    refreshBtn?.classList.remove('loading');
    lucideInit();
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
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
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
  const refreshBtn = document.getElementById('refreshGlobal');
  refreshBtn?.classList.add('loading');
  const days = Number(document.getElementById('period')?.value || 30);
  const tz = Number(document.getElementById('timezone')?.value || 0);
  try {
    const data = await (await fetch(`/api/stats-global?days=${days}&tz=${tz}`)).json();
    $('#globalKpi').innerHTML = `
      <div class="pill"><strong>QR УСЬОГО</strong>${data.total_qrs}</div>
      <div class="pill"><strong>СКАНУВАНЬ УСЬОГО</strong>${data.total_scans}</div>
      <div class="pill"><strong>УНІКАЛЬНІ</strong>${data.total_unique_visitors}</div>
    `;
    drawDailyChart('chartGlobalDaily', data.series_daily, 'Сканування за днями');
    drawBarChart('chartTopQrs', data.top_qrs.map(x=>({ label:x.id.slice(0,6), value:x.scan_count })), 'Топ QR');
    drawBarChart('chartCountries', (data.breakdowns?.countries||[]), 'Країни');
    drawBarChart('chartRegions', (data.breakdowns?.regions||[]), 'Регіони');
    drawBarChart('chartDevices', (data.breakdowns?.devices||[]), 'Пристрої');
    // Оновлюємо лічильники в hero-bar
    const hkpiQr = document.getElementById('hkpiQr');
    const hkpiScans = document.getElementById('hkpiScans');
    const hkpiUniq = document.getElementById('hkpiUniq');
    if (hkpiQr) hkpiQr.textContent = data.total_qrs;
    if (hkpiScans) hkpiScans.textContent = data.total_scans;
    if (hkpiUniq) hkpiUniq.textContent = data.total_unique_visitors;
    lucideInit();
  } catch(e) {
    $('#globalKpi').innerHTML = '<div class="pill pill-sm" style="grid-column:1/-1"><strong>ПОМИЛКА</strong>Не вдалося завантажити статистику</div>';
  } finally {
    refreshBtn?.classList.remove('loading');
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
