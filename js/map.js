/* ===== CONFIG ===== */
const API_BASE = 'https://script.google.com/macros/s/AKfycbyIMQhvL2-3aXGVBlF6Br-7KgErcnQZus1eO07KdpbP48ainM5S3Z4dPSY-iVkYCW_o/exec';
const FLOORPLAN_URL = 'KVIS_map.png?v=2';
const AUTO_REFRESH_MS = 5000;
/* ================== */

function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
        const cb = 'cb_' + Math.random().toString(36).slice(2);
        const qs = new URLSearchParams({ ...params, action, callback: cb }).toString();
        const url = API_BASE + (API_BASE.includes('?') ? '&' : '?') + qs;
        const s = document.createElement('script');
        s.src = url; s.async = true;
        window[cb] = (data) => { cleanup(); resolve(data); };
        s.onerror = () => { cleanup(); reject(new Error('JSONP load error')); };
        function cleanup() { try { delete window[cb]; } catch (_) { } s.remove(); }
        document.head.appendChild(s);
    });
}

const el = {
    container: document.getElementById('container'),
    pins: document.getElementById('pinsLayer'),
    floorImg: document.getElementById('floorImage'),
    zoneSel: document.getElementById('zoneSel'),
    statusSel: document.getElementById('statusSel'),
    search: document.getElementById('searchBox'),
    status: document.getElementById('status'),
    refresh: document.getElementById('refreshBtn'),
    statsContainer: document.getElementById('statsContainer'),
};

let data = { items: [] };

function badge(status) {
    const cls = (status === 'Defused') ? 'defused' : 'active';
    return `<span class="badge ${cls}">${status}</span>`;
}
function pinHTML(b) {
    const left = (b.x != null) ? b.x : 50, top = (b.y != null) ? b.y : 50;
    const defused = b.locked || (b.status === 'Defused');
    const extra = defused ? ' defX faded' : '';
    return `<div class="pin${extra}" style="left:${left}%; top:${top}%;">
    <div class="id">${b.id}</div>
    <div class="zone">${b.zone || ''}</div>
    <div>${badge(defused ? 'Defused' : (b.status || 'Active'))}</div>
  </div>`;
}
function tileHTML(b) {
    return `<div class="tile">
    <div class="id">${b.id}</div>
    <div class="zone">${b.name || ''}${b.zone ? ' • ' + b.zone : ''}</div>
    <div style="margin-top:6px">${badge(b.locked ? 'Defused' : b.status || 'Active')}${b.group ? ' — Group ' + b.group : ''}</div>
  </div>`;
}

function uniqueZones(items) {
    const z = Array.from(new Set(items.map(i => (i.zone || '').toString().trim()).filter(Boolean))).sort();
    const counts = computeStatsByZone(items);
    el.statsContainer.innerHTML = z.map(v => `<div class="zone-stats-container">
        <p style="font-size: 16px; font-weight: 800;">${v}</p>
        <div class="zone-stats">
            <div class="panel common red">
                <p>Active</p>
                <p style="font-size: 24px;">${counts[v].Active}</p>
            </div>
            <div class="panel common green">
                <p">Defused</p>
                <p style="font-size: 24px;">${counts[v].Defused}</p>
            </div>
        </div>
    </div>`).join('');
}
function applyFilters(items) {
    const z = el.zoneSel?.value.trim();
    const s = el.statusSel?.value.trim();
    const q = el.search?.value.trim().toLowerCase();
    return items.filter(b => {
        if (z && String(b.zone || '') !== z) return false;
        const st = (b.locked || b.status === 'Defused') ? 'Defused' : (b.status || 'Active');
        if (s && st !== s) return false;
        if (q && !(String(b.id || '').toLowerCase().includes(q) || String(b.name || '').toLowerCase().includes(q))) return false;
        return true;
    });
}

/* ===== Scoreboard helpers ===== */
function groupKey(v) {
    const s = String(v ?? '').trim();
    return (/^[1-8]$/).test(s) ? s : '-';
}
function computeDefusedByGroup(items) {
    const validItems = items.filter(b => b.status !== "");
    const defused = validItems.filter(b => b.locked || b.status === 'Defused');
    const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0 };
    defused.forEach(b => {
        const g = groupKey(b.group);
        if (counts[g] != null) counts[g] += 1;
    });
    return { counts, total: defused.length, remaining: validItems.length - defused.length };
}
function computeStatsByZone(items) {
    let counts = {};
    items.forEach(b => {
        if (b.status === '') return;
        const g = b.zone;
        const d = (b.status === 'Defused') ? 1 : 0;
        if (counts[g] != null) counts[g][b.status] += 1;
        else counts = { ...counts, [g]: { Active: 1 - d, Defused: d } }
    });
    return counts;
}
function renderScoreboard(allItems) {
    const elSB = document.getElementById('scoreboard');
    if (!elSB) return;
    const { counts, total, remaining } = computeDefusedByGroup(allItems);
    const rows = [];
    for (let g = 1; g <= 8; g++) {
        rows.push(`<div class="sb-item">
      <span class="g">Group ${g}</span>
      <span class="c">${counts[String(g)]}</span>
    </div>`);
    }
    elSB.innerHTML = `
    <div class="sb-head">
      <div>Scoreboard</div>
      <div>Defused: <strong>${total}</strong> • Remaining: <strong>${remaining}</strong></div>
    </div>
    <div class="sb-grid">${rows.join('')}</div>
  `;
}
function renderRefreshedTime() {
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    document.getElementById('lastRefresh').innerHTML = 'Last updated: ' + now.toLocaleDateString('en-US', options);
}

/* ===== Grid labels ===== */
function createGridLabels() {
    const grid = document.getElementById('gridOverlay');
    if (!grid) return;
    grid.querySelectorAll('.grid-label').forEach(n => n.remove());
    for (let i = 10; i <= 100; i += 10) {
        const lx = document.createElement('div');
        lx.className = 'grid-label'; lx.textContent = String(i);
        lx.style.left = `${i}%`; lx.style.top = `2%`; grid.appendChild(lx);
        const ly = document.createElement('div');
        ly.className = 'grid-label'; ly.textContent = String(i);
        ly.style.left = `2%`; ly.style.top = `${i}%`; grid.appendChild(ly);
    }
}

/* ===== Render ===== */
function render() {
    const items = applyFilters(data.items);
    uniqueZones(items);
    renderScoreboard(items);
    renderRefreshedTime();

    if (FLOORPLAN_URL && el.floorImg) el.floorImg.src = FLOORPLAN_URL;
    else el.container.className = 'panel grid';
}

/* ===== Load ===== */
async function load() {
    try {
        const res = await jsonp('list', {});
        if (!res || !res.ok) throw new Error(res && res.message || 'Load error');
        data = res;
        render();
    } catch (e) {
        el.status.textContent = '⚠️ ' + e.message;
    }
}

load();
// setInterval(load, AUTO_REFRESH_MS);