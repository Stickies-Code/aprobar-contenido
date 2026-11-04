(() => {
const WEEKS = window.WEEKS || [];
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const MONTHS = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };
const longDate = d => { const [n, m] = String(d).split(' '); return `${n} de ${MONTHS[m] || m}`; };

let week = WEEKS[WEEKS.length - 1];
const fromHash = location.hash.slice(1);
if (WEEKS.find(w => w.id === fromHash)) week = WEEKS.find(w => w.id === fromHash);
else if (WEEKS.find(w => w.id === store.get('crisWeek'))) week = WEEKS.find(w => w.id === store.get('crisWeek'));

const state = { reviews: {}, ok: false };
let myName = store.get('crisName') || '';

const fmtDate = iso => { try { return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const statusOf = r => r ? (r.status || (r.approved ? 'ok' : '')) : '';
function notice(msg) { const n = $('#notice'); n.textContent = msg || ''; n.hidden = !msg; }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json' } });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { status: r.status });
  return j;
}

// Nombre de quien revisa (se pide una vez)
let pendingAction = null;
function askName(then) { pendingAction = then || null; $('#nameInput').value = myName; $('#nameModal').hidden = false; setTimeout(() => $('#nameInput').focus(), 30); }
$('#nameForm').addEventListener('submit', e => {
  e.preventDefault(); const v = $('#nameInput').value.trim().slice(0, 40); if (!v) return;
  myName = v; store.set('crisName', v); $('#nameModal').hidden = true;
  const a = pendingAction; pendingAction = null; if (a) a();
});
$('#nameCancel').addEventListener('click', () => { $('#nameModal').hidden = true; pendingAction = null; });
const withName = fn => myName ? fn() : askName(fn);

function renderWeeks() {
  $('#weeks').innerHTML = WEEKS.map(w => `<button type="button" data-w="${w.id}" aria-pressed="${w === week}">${esc(w.label)}</button>`).join('');
  $('#weeks').hidden = WEEKS.length < 2;
}
function renderCards() {
  $('#wkTitle').innerHTML = week.title;
  $('#main').innerHTML = week.items.map(it => {
    const frames = Array.from({ length: it.n }, (_, i) =>
      `<div class="frame"><img src="/img/${it.id}-${i + 1}.jpg?v=${it.v || 1}" alt="${it.type === 'post' ? 'Diapositiva' : 'Historia'} ${i + 1} de ${it.n}" loading="lazy">${it.n > 1 ? `<span class="n">${i + 1}/${it.n}</span>` : ''}</div>`).join('');
    const kind = it.type === 'post' ? `Post · ${it.n} ${it.n === 1 ? 'imagen' : 'diapositivas'}` : `Historias · ${it.n}`;
    return `<article class="card ${it.type}" id="${it.id}" data-id="${it.id}">
      <div class="card-h"><h2>${esc(it.day)} ${esc(longDate(it.date))} <span>· ${kind}</span></h2><span class="badge" data-badge>Pendiente</span></div>
      <div class="media">${frames}</div>
      ${it.copy ? `<details class="copywrap"><summary>Texto del post</summary><div class="copybody"><pre class="copy">${esc(it.copy)}</pre><button type="button" class="copybtn" data-copy>Copiar texto</button></div></details>` : ''}
      <div class="review">
        <div class="btns">
          <button type="button" class="vote yes" data-vote="ok" aria-pressed="false"><span class="e">👍</span>Aprobar</button>
          <button type="button" class="vote no" data-vote="no" aria-pressed="false"><span class="e">👎</span>No aprobar</button>
        </div>
        <p class="who" data-who></p>
      </div>
    </article>`;
  }).join('');
}
function renderStatus() {
  for (const it of week.items) {
    const card = document.getElementById(it.id); if (!card) continue;
    const r = state.reviews[it.id]; const st = statusOf(r);
    card.classList.toggle('is-ok', st === 'ok'); card.classList.toggle('is-no', st === 'no');
    const badge = $('[data-badge]', card);
    badge.className = 'badge' + (st ? ' ' + st : '');
    badge.textContent = st === 'ok' ? '✓ Aprobado' : st === 'no' ? '✕ No aprobado' : 'Pendiente';
    card.querySelectorAll('[data-vote]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.vote === st); b.disabled = !state.ok; });
    $('[data-who]', card).textContent = st ? `${st === 'ok' ? 'Aprobado' : 'No aprobado'} por ${r.by || 'alguien'} · ${fmtDate(r.at)}` : '';
  }
}
function renderAll() { renderWeeks(); renderCards(); renderStatus(); }

let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const j = await api(`/api/state?week=${encodeURIComponent(week.id)}`);
    state.reviews = j.reviews || {}; state.ok = true;
    if ($('#notice').dataset.kind === 'conn') { notice(''); $('#notice').dataset.kind = ''; }
  } catch (e) {
    state.ok = false; $('#notice').dataset.kind = 'conn';
    notice(e.status === 503 ? 'La base de datos aún no está conectada. Avisa a Borja.' : 'No se pueden cargar los aprobados ahora mismo. Lo reintentamos solos.');
  }
  loading = false; renderStatus();
}

$('#weeks').addEventListener('click', e => {
  const b = e.target.closest('button[data-w]'); if (!b) return;
  week = WEEKS.find(w => w.id === b.dataset.w); store.set('crisWeek', week.id);
  state.reviews = {}; renderAll(); load();
});
document.addEventListener('click', async e => {
  const img = e.target.closest('.frame img');
  if (img) { const lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = `<img src="${img.src}" alt=""><button type="button">Cerrar ✕</button>`; lb.addEventListener('click', () => lb.remove()); document.body.appendChild(lb); return; }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const pre = cp.parentElement.querySelector('.copy');
    try { await navigator.clipboard.writeText(pre.textContent); cp.textContent = 'Copiado ✓'; }
    catch (err) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = 'Texto seleccionado'; }
    setTimeout(() => cp.textContent = 'Copiar texto', 1800); return;
  }
  const v = e.target.closest('[data-vote]');
  if (v && state.ok) {
    withName(async () => {
      const id = v.closest('.card').dataset.id;
      const status = statusOf(state.reviews[id]) === v.dataset.vote ? '' : v.dataset.vote;
      v.closest('.btns').querySelectorAll('button').forEach(b => b.disabled = true);
      try { const j = await api('/api/review', { method: 'POST', body: JSON.stringify({ week: week.id, item: id, status, name: myName }) }); if (j.review) state.reviews[id] = j.review; else delete state.reviews[id]; }
      catch (err) { notice('No se ha podido guardar. Inténtalo de nuevo.'); }
      renderStatus();
    });
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelector('.lb')?.remove(); if (!$('#nameModal').hidden) $('#nameCancel').click(); } });

renderAll(); load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
