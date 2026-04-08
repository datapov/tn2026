/**
 * TN 2021 Assembly Elections — V2 Map Application
 * Full-screen GeoJSON polygon map + dark sidebar (desktop) / bottom sheet (mobile)
 */

// ─── Data ───────────────────────────────────────────────────────────────────
const geojson = JSON.parse(document.getElementById('geo').textContent);
const sidebarData = JSON.parse(document.getElementById('sidebar-data').textContent);
const TN_BOUNDS = [[7.927, 76.084], [13.714, 80.497]];

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

// Indian number formatting
function indianFormat(n) {
  if (!n && n !== 0) return '—';
  n = parseInt(String(n).replace(/,/g, ''), 10);
  if (isNaN(n)) return '—';
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.push(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  parts.push(rest);
  return parts.reverse().join(',') + ',' + last3;
}

// ─── Build sidebar item lookup ──────────────────────────────────────────────
const dataByAc = {};
sidebarData.forEach(d => { dataByAc[d.ac] = d; });

// ─── Populate filter dropdowns ──────────────────────────────────────────────
const districts = [...new Set(sidebarData.map(d => d.district))].sort();
const distSelect = document.getElementById('district-filter');
if (distSelect) {
  districts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    distSelect.appendChild(opt);
  });
}

const partyCounts = {};
sidebarData.forEach(d => { partyCounts[d.party] = (partyCounts[d.party] || 0) + 1; });
const sortedParties = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);
const partySelect = document.getElementById('party-filter');
if (partySelect) {
  sortedParties.forEach(([p, count]) => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = `${p} (${count})`;
    partySelect.appendChild(opt);
  });
}

// ─── Initialize Map ─────────────────────────────────────────────────────────
const map = L.map('map', {
  zoomControl: true,
  minZoom: 7,
  maxZoom: 14,
  maxBounds: TN_BOUNDS,
  maxBoundsViscosity: 1.0,
  tap: true
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  bounds: TN_BOUNDS,
  noWrap: true
}).addTo(map);

let activeLayer = null;
const layerByAcNo = {};

// Style polygons by winning party color
function styleFor(feature) {
  const p = feature.properties;
  const color = p.PARTY_COLOR || '#888';
  return {
    fillColor: color,
    weight: 0.8,
    opacity: 1,
    color: '#1a1f2e',
    fillOpacity: 0.65
  };
}

// ─── GeoJSON Layer ──────────────────────────────────────────────────────────
const geoLayer = L.geoJSON(geojson, {
  style: styleFor,
  onEachFeature: (feature, layer) => {
    const p = feature.properties;
    layerByAcNo[p.AC_NO] = layer;

    // Tooltip
    const tooltipText = p.WINNER
      ? `${p.AC_NO}. ${p.CONST_NAME || p.AC_NAME} — ${p.WINNER_SHORT || ''}`
      : `${p.AC_NO}. ${p.AC_NAME}`;
    layer.bindTooltip(tooltipText, { sticky: true, className: 'ac-tooltip', direction: 'top' });

    // Desktop popup
    if (p.WINNER && p.WINNER !== 'Data unavailable') {
      const marginStr = p.MARGIN ? indianFormat(p.MARGIN) : '—';
      layer.bindPopup(`
        <div class="info-popup">
          <h3>${p.CONST_NAME || p.AC_NAME}</h3>
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px">AC #${p.AC_NO} · ${p.DIST_NAME}</div>
          <div class="pop-winner">
            <span class="pop-dot" style="background:${p.PARTY_COLOR}"></span>
            <span>
              <span class="pop-name">${p.WINNER}</span><br>
              <span class="pop-party">${p.WINNER_SHORT} · ${p.WINNER_PCT}% · Margin: ${marginStr}</span>
            </span>
          </div>
          <div class="pop-stats">
            <div class="pop-stat"><span class="pop-stat-val">${p.TURNOUT}%</span><span class="pop-stat-lbl">Turnout</span></div>
            <div class="pop-stat"><span class="pop-stat-val">${indianFormat(p.ELECTORS)}</span><span class="pop-stat-lbl">Electors</span></div>
            <div class="pop-stat"><span class="pop-stat-val">${p.TOTAL_CANDIDATES}</span><span class="pop-stat-lbl">Candidates</span></div>
          </div>
          ${p.PAGE_URL ? `<a class="pop-link" href="${p.PAGE_URL}">View Full Results →</a>` : ''}
        </div>
      `, { maxWidth: 280, minWidth: 220, closeButton: true });
    }

    // Interactions
    layer.on({
      mouseover: e => {
        if (e.target !== activeLayer && !isMobile()) {
          e.target.setStyle({ weight: 2.5, color: '#fff', fillOpacity: 0.88 });
          e.target.bringToFront();
        }
      },
      mouseout: e => {
        if (e.target !== activeLayer && !isMobile()) geoLayer.resetStyle(e.target);
      },
      click: e => selectConstituency(p.AC_NO, false)
    });
  }
}).addTo(map);

map.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });

// ─── Selection Logic ────────────────────────────────────────────────────────
function selectConstituency(acNo, fromList) {
  const layer = layerByAcNo[acNo];
  if (!layer) return;

  if (activeLayer) geoLayer.resetStyle(activeLayer);
  activeLayer = layer;
  layer.setStyle({ weight: 3, color: '#facc15', fillOpacity: 0.9 });
  layer.bringToFront();

  const p = layer.feature.properties;
  const d = dataByAc[acNo];

  if (isMobile()) {
    // Show bottom info card
    document.getElementById('ic-name').textContent = p.CONST_NAME || p.AC_NAME;
    document.getElementById('ic-dot').style.background = p.PARTY_COLOR || '#888';
    document.getElementById('ic-winner').textContent = p.WINNER || '—';
    document.getElementById('ic-party').textContent = p.WINNER_SHORT || '';
    document.getElementById('ic-pct').textContent = p.WINNER_PCT ? p.WINNER_PCT + '%' : '—';
    document.getElementById('ic-turnout').textContent = p.TURNOUT ? p.TURNOUT + '%' : '—';
    document.getElementById('ic-margin').textContent = p.MARGIN ? indianFormat(p.MARGIN) : '—';
    const link = document.getElementById('ic-link');
    if (p.PAGE_URL) { link.href = p.PAGE_URL; link.style.display = 'block'; }
    else { link.style.display = 'none'; }
    document.getElementById('info-card').classList.add('visible');
    setSheetState('collapsed');
    map.fitBounds(layer.getBounds(), { paddingTopLeft: [20, 90], paddingBottomRight: [20, 190], maxZoom: 12 });
  } else {
    if (fromList) map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 12 });
    layer.openPopup();
  }

  // Highlight in lists
  document.querySelectorAll('.item').forEach(el => {
    const match = Number(el.dataset.acNo) === acNo;
    el.classList.toggle('active', match);
    if (match && !isMobile()) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

// ─── List Rendering ─────────────────────────────────────────────────────────
const sorted = [...sidebarData].sort((a, b) => a.ac - b.ac);

function buildItem(d) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.acNo = d.ac;
  div.innerHTML = `
    <span class="ac-badge" style="background:${d.color}">${d.ac}</span>
    <span class="item-info">
      <div class="item-name">${d.name}</div>
      <div class="item-winner">${d.winner}<span class="party-tag" style="background:${d.color}">${d.party}</span></div>
      <div class="item-meta">${d.district} · ${d.pct}% · Turnout: ${d.turnout}%</div>
    </span>
  `;
  div.addEventListener('click', () => selectConstituency(d.ac, true));
  return div;
}

function renderLists(filter, districtVal, partyVal) {
  filter = (filter || '').trim().toLowerCase();
  districtVal = districtVal || '';
  partyVal = partyVal || '';

  const desktopList = document.getElementById('list');
  const mobileList = document.getElementById('sheet-list');
  if (desktopList) desktopList.innerHTML = '';
  if (mobileList) mobileList.innerHTML = '';

  let n = 0;
  sorted.forEach(d => {
    // Text search
    if (filter) {
      const hay = `${d.name} ${d.district} ${d.winner} ${d.party} ${d.partyFull}`.toLowerCase();
      if (!hay.includes(filter)) return;
    }
    // District filter
    if (districtVal && d.district !== districtVal) return;
    // Party filter
    if (partyVal && d.party !== partyVal) return;

    n++;
    if (desktopList) desktopList.appendChild(buildItem(d));
    if (mobileList) mobileList.appendChild(buildItem(d));
  });

  const countEl = document.getElementById('count');
  if (countEl) countEl.textContent = `${n} of ${sorted.length} constituencies`;

  const sheetTitle = document.getElementById('sheet-title');
  if (sheetTitle) {
    sheetTitle.textContent = (filter || districtVal || partyVal)
      ? `${n} of ${sorted.length} constituencies`
      : 'All 234 Constituencies';
  }

  // Also highlight/filter map polygons
  geoLayer.eachLayer(layer => {
    const p = layer.feature.properties;
    const acData = dataByAc[p.AC_NO];
    if (!acData) { layer.setStyle({ fillOpacity: 0.15 }); return; }

    let visible = true;
    if (filter) {
      const hay = `${acData.name} ${acData.district} ${acData.winner} ${acData.party} ${acData.partyFull}`.toLowerCase();
      if (!hay.includes(filter)) visible = false;
    }
    if (districtVal && acData.district !== districtVal) visible = false;
    if (partyVal && acData.party !== partyVal) visible = false;

    if (visible) {
      geoLayer.resetStyle(layer);
    } else {
      layer.setStyle({ fillOpacity: 0.08, weight: 0.3, color: '#333' });
    }
  });
}

// Wire up search inputs
const desktopSearch = document.getElementById('search');
if (desktopSearch) {
  desktopSearch.addEventListener('input', () => {
    renderLists(desktopSearch.value,
      distSelect ? distSelect.value : '',
      partySelect ? partySelect.value : '');
  });
}

if (distSelect) {
  distSelect.addEventListener('change', () => {
    renderLists(desktopSearch ? desktopSearch.value : '',
      distSelect.value,
      partySelect ? partySelect.value : '');
  });
}
if (partySelect) {
  partySelect.addEventListener('change', () => {
    renderLists(desktopSearch ? desktopSearch.value : '',
      distSelect ? distSelect.value : '',
      partySelect.value);
  });
}

const mobileSearchInput = document.getElementById('mobile-search-input');
if (mobileSearchInput) {
  mobileSearchInput.addEventListener('input', e => {
    renderLists(e.target.value, '', '');
    if (e.target.value.trim()) setSheetState('full');
  });
}

// Initial render
renderLists();

// ─── Mobile Bottom Sheet ────────────────────────────────────────────────────
const sheet = document.getElementById('sheet');

function setSheetState(state) {
  if (!sheet) return;
  sheet.classList.remove('collapsed', 'peek', 'full');
  sheet.classList.add(state);
}

const listToggle = document.getElementById('list-toggle');
if (listToggle) {
  listToggle.addEventListener('click', () => {
    if (sheet.classList.contains('full')) setSheetState('collapsed');
    else setSheetState('full');
  });
}

// Drag handle
const handle = document.getElementById('sheet-handle');
let dragStart = null, sheetStartTop = null;

function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

if (handle) {
  handle.addEventListener('touchstart', startDrag, { passive: false });
  handle.addEventListener('mousedown', startDrag);
}

function startDrag(e) {
  e.preventDefault();
  dragStart = getY(e);
  sheetStartTop = sheet.getBoundingClientRect().top;
  sheet.style.transition = 'none';
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', endDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(e) {
  if (dragStart === null) return;
  e.preventDefault();
  const dy = getY(e) - dragStart;
  const newTop = Math.max(0, sheetStartTop + dy);
  sheet.style.transform = `translateY(${newTop - (window.innerHeight - sheet.offsetHeight)}px)`;
}

function endDrag() {
  if (dragStart === null) return;
  sheet.style.transition = '';
  sheet.style.transform = '';
  const finalTop = sheet.getBoundingClientRect().top;
  const winH = window.innerHeight;
  const sheetH = sheet.offsetHeight;
  const dists = [
    { state: 'full', d: Math.abs(finalTop - (winH - sheetH)) },
    { state: 'peek', d: Math.abs(finalTop - (winH - 68)) },
    { state: 'collapsed', d: Math.abs(finalTop - winH) },
  ];
  dists.sort((a, b) => a.d - b.d);
  setSheetState(dists[0].state);
  dragStart = null;
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
}

// Mobile info card close
const infoCardClose = document.getElementById('info-card-close');
if (infoCardClose) {
  infoCardClose.addEventListener('click', () => {
    document.getElementById('info-card').classList.remove('visible');
    if (activeLayer) { geoLayer.resetStyle(activeLayer); activeLayer = null; }
  });
}

// Show peek sheet on mobile
if (isMobile()) {
  setTimeout(() => setSheetState('peek'), 400);
}

// Re-fit map on orientation change
window.addEventListener('resize', () => {
  setTimeout(() => map.invalidateSize(), 200);
});
