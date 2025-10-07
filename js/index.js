/* ====== CONFIG: paste your Apps Script /exec ====== */
const API_BASE = 'https://script.google.com/macros/s/AKfycbx9ENHOVLrkPJ_vdWsx01Wfu4AhvazkAZBz3IXZjTgojyukYu6xoWONX7edX1BQmc0S/exec';
/* ================================================== */

// JSONP helper (bypasses CORS)
function jsonp(path, params) {
    return new Promise((resolve, reject) => {
        const cb = 'cb_' + Math.random().toString(36).slice(2);
        const url = API_BASE + '?' + new URLSearchParams({ ...params, action: path, callback: cb }).toString();

        const s = document.createElement('script');
        window[cb] = (data) => { resolve(data); cleanup(); };
        s.onerror = () => { reject(new Error('JSONP load error')); cleanup(); };

        function cleanup() { try { delete window[cb]; } catch (_) { } s.remove(); }
        s.src = url;
        document.body.appendChild(s);
    });
}

const qs = new URLSearchParams(location.search);
const bombId = (qs.get('id') || '').trim();

const idEl = document.getElementById('bombId');
const msg = document.getElementById('msg');
const problemUrl = document.getElementById('openProblemUrl');
const btn = document.getElementById('btn');
const pass = document.getElementById('pass');
const grp = document.getElementById('group');

idEl.textContent = bombId || '—';

function setMsg(text, cls = 'msg') {
    msg.className = 'msg';
    if (cls) msg.classList.add(cls.replace('msg ', '').trim());
    msg.textContent = text;
}
function setLockedUI(on) {
    pass.disabled = on;
    grp.disabled = on;
    btn.disabled = on;
}
function setProblemUrl(url) {
    problemUrl.href = url;
}

async function load() {
    if (!bombId) { setMsg('⚠️ Missing bomb ID in URL.', 'msg err'); setLockedUI(true); return; }
    setMsg('Loading…', 'msg');
    try {
        const data = await jsonp('get', { id: bombId });
        if (!data.ok) { setMsg('⚠️ ' + (data.message || 'Error'), 'msg err'); return; }
        if (!data.found) { setMsg('❓ Bomb not found.', 'msg err'); setLockedUI(true); return; }
        if (data.locked) { setLockedUI(true); setMsg('🔒 Already defused by Group ' + (data.group || '—') + '.', 'msg warn'); return; }
        setProblemUrl(data.problemUrl);
        setLockedUI(false); setMsg('Ready.');
    } catch (e) {
        setMsg('⚠️ Network error: ' + e.message, 'msg err');
    }
}

async function defuse() {
    const g = (grp.value || '').trim();
    const v = (pass.value || '').trim();
    if (!g) { setMsg('⚠️ Please select a group (1–8).', 'msg err'); return; }
    if (!v) { setMsg('⚠️ Please enter a password.', 'msg err'); return; }

    setMsg('Checking…', 'msg');
    btn.disabled = true;

    try {
        const res = await jsonp('check', { id: bombId, password: v, group: g });
        setMsg(res.message || (res.ok ? 'OK' : 'Error'), res.ok ? 'msg ok' : 'msg err');
        if (res.locked) setLockedUI(true);
        else btn.disabled = false;
        // optional haptic on iPhone
        if (navigator.vibrate) navigator.vibrate(res.ok ? 20 : [40, 40, 40]);
    } catch (e) {
        setMsg('⚠️ Network error: ' + e.message, 'msg err');
        btn.disabled = false;
    }
}

btn.addEventListener('click', defuse);
pass.addEventListener('keydown', e => { if (e.key === 'Enter') defuse(); });

load();