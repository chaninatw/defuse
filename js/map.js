/* ===== CONFIG ===== */
const API_BASE = 'https://script.google.com/macros/s/AKfycbyIMQhvL2-3aXGVBlF6Br-7KgErcnQZus1eO07KdpbP48ainM5S3Z4dPSY-iVkYCW_o/exec';
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
    status: document.getElementById('status'),
    statsContainer: document.getElementById('statsContainer'),
};

let data = { items: [] };

/* ===== Totals ===== */
function computeTotals(items) {
    const valid = items.filter(b => b.status !== '');
    const defused = valid.filter(b => b.locked || b.status === 'Defused').length;
    const active = valid.length - defused;
    return { active, defused };
}

function renderTotals(items) {
    const { active, defused } = computeTotals(items);
    el.statsContainer.innerHTML = `
    <div class="totals">
      <div class="common red">
        <p>Active</p>
        <p style="font-size: 32px;">${active}</p>
      </div>
      <div class="common green">
        <p>Defused</p>
        <p style="font-size: 32px;">${defused}</p>
      </div>
    </div>
  `;
}

function renderRefreshedTime() {
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const elRefresh = document.getElementById('lastRefresh');
    if (elRefresh) elRefresh.innerHTML = 'Last updated: ' + now.toLocaleTimeString('en-US', options);
}

/* ===== Render ===== */
function render() {
    renderTotals(data.items);
    renderRefreshedTime();
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
setInterval(load, AUTO_REFRESH_MS);

/* ===== Countdown timer (15 min, starts on button press) ===== */
(function () {
    const DURATION_SEC = 15 * 60;
    const displayEl = document.getElementById('timerDisplay');
    const startBtn = document.getElementById('timerStartBtn');
    const resetBtn = document.getElementById('timerResetBtn');
    if (!displayEl || !startBtn || !resetBtn) return;

    let remaining = DURATION_SEC;
    let intervalId = null;

    function format(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function render() {
        displayEl.textContent = format(Math.max(remaining, 0));
        displayEl.classList.toggle('timer-warn', remaining <= 60 && remaining > 0);
        displayEl.classList.toggle('timer-up', remaining <= 0);
    }

    function tick() {
        remaining -= 1;
        if (remaining <= 0) {
            remaining = 0;
            stop();
        }
        render();
    }

    function start() {
        if (intervalId || remaining <= 0) return;
        intervalId = setInterval(tick, 1000);
        startBtn.textContent = 'Running…';
        startBtn.disabled = true;
    }

    function stop() {
        clearInterval(intervalId);
        intervalId = null;
        startBtn.disabled = remaining <= 0;
        startBtn.textContent = remaining <= 0 ? 'Time up' : 'Start';
    }

    function reset() {
        clearInterval(intervalId);
        intervalId = null;
        remaining = DURATION_SEC;
        startBtn.disabled = false;
        startBtn.textContent = 'Start';
        render();
    }

    startBtn.addEventListener('click', start);
    resetBtn.addEventListener('click', reset);
    render();
})();
