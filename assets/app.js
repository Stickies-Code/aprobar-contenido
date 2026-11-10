(() => {
const WEEKS = window.WEEKS || [];
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const MONTHS = { ene: 'enero', feb: 'febrero', mar: 'marzo', abr: 'abril', may: 'mayo', jun: 'junio', jul: 'julio', ago: 'agosto', sep: 'septiembre', oct: 'octubre', nov: 'noviembre', dic: 'diciembre' };
const MNUM = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
/* Número de pieza: día + mes (10 nov → 1011). Coincide con el nombre de la carpeta del escritorio. */
const codeOf = it => { const [n, m] = String(it.date).split(' '); return `${String(n).padStart(2, '0')}${MNUM[m] || ''}`; };
const nameOf = it => `${it.type === 'post' ? 'Post' : 'Story'} ${codeOf(it)}`;
const longDate = d => { const [n, m] = String(d).split(' '); return `${n} de ${MONTHS[m] || m}`; };

// Semana actual: la que contiene hoy (start/end en weeks.js); si no hay, la más reciente que ya empezó; si no, la última.
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const current = WEEKS.find(w => w.start && w.end && w.start <= today && today <= w.end)
  || [...WEEKS].reverse().find(w => w.start && w.start <= today) || WEEKS[WEEKS.length - 1];
let week = current;
const fromHash = location.hash.slice(1);
if (WEEKS.find(w => w.id === fromHash)) week = WEEKS.find(w => w.id === fromHash);

const state = { reviews: {}, uploads: {}, ok: false };
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
  const sel = $('#weekSel');
  sel.innerHTML = [...WEEKS].reverse().map(w => `<option value="${w.id}"${w === week ? ' selected' : ''}>${esc(String(w.title || w.label).replace(/<[^>]+>/g, ''))}${w === current ? ' · esta semana' : ''}</option>`).join('');
  $('#wkNow').hidden = week !== current;
}
function renderCards() {
  $('#wkTitle').innerHTML = week.title;
  $('#main').innerHTML = week.items.map(it => {
    const frames = Array.from({ length: it.n }, (_, i) =>
      `<div class="frame"><img src="/img/${it.id}-${i + 1}.jpg?v=${it.v || 1}" alt="${it.type === 'post' ? 'Diapositiva' : 'Historia'} ${i + 1} de ${it.n}" loading="lazy"><span class="n">${esc(it.n > 1 ? `${nameOf(it)}.${i + 1}` : nameOf(it))}</span></div>`).join('');
    const kind = it.type === 'post' ? `${it.n} ${it.n === 1 ? 'imagen' : 'diapositivas'}` : `${it.n} ${it.n === 1 ? 'historia' : 'historias'}`;
    return `<article class="card ${it.type}" id="${it.id}" data-id="${it.id}">
      <div class="card-h"><h2><b class="code">${esc(nameOf(it))}</b> ${esc(it.day)} ${esc(longDate(it.date))} <span>· ${kind}</span></h2>
        <div class="card-r"><span class="badge" data-badge>Pendiente</span>
          <label class="up"><input type="checkbox" data-up><span class="box" aria-hidden="true"></span><span class="t">Subido</span></label></div>
        <p class="upwho" data-upwho hidden></p></div>
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
    const u = state.uploads[it.id]; const cb = $('[data-up]', card);
    cb.checked = Boolean(u && u.done); cb.disabled = !state.ok;
    card.classList.toggle('is-up', cb.checked);
    const uw = $('[data-upwho]', card); uw.hidden = !cb.checked;
    uw.textContent = cb.checked ? `Subido${u.by ? ' por ' + u.by : ''} · ${fmtDate(u.at)}` : '';
  }
  const n = week.items.length;
  const ok = week.items.filter(it => statusOf(state.reviews[it.id]) === 'ok').length;
  const up = week.items.filter(it => state.uploads[it.id] && state.uploads[it.id].done).length;
  $('#wkSum').innerHTML = state.ok ? `<b>${ok}/${n}</b> aprobadas · <b>${up}/${n}</b> subidas` : '';
}
function renderAll() { renderWeeks(); renderCards(); renderStatus(); }

let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const j = await api(`/api/state?week=${encodeURIComponent(week.id)}`);
    state.reviews = j.reviews || {}; state.uploads = j.uploads || {}; state.ok = true;
    if ($('#notice').dataset.kind === 'conn') { notice(''); $('#notice').dataset.kind = ''; }
  } catch (e) {
    state.ok = false; $('#notice').dataset.kind = 'conn';
    notice(e.status === 503 ? 'La base de datos aún no está conectada. Avisa a Borja.' : 'No se pueden cargar los aprobados ahora mismo. Lo reintentamos solos.');
  }
  loading = false; renderStatus();
}

$('#weekSel').addEventListener('change', e => {
  week = WEEKS.find(w => w.id === e.target.value) || current;
  history.replaceState(null, '', week === current ? location.pathname : '#' + week.id);
  state.reviews = {}; state.uploads = {}; renderAll(); load(); window.scrollTo(0, 0);
});
document.addEventListener('change', async e => {
  const cb = e.target.closest('[data-up]'); if (!cb || !state.ok) return;
  const id = cb.closest('.card').dataset.id; const done = cb.checked;
  cb.disabled = true;
  try { const j = await api('/api/uploaded', { method: 'POST', body: JSON.stringify({ week: week.id, item: id, done, name: myName }) }); if (j.upload) state.uploads[id] = j.upload; else delete state.uploads[id]; }
  catch (err) { notice('No se ha podido guardar «Subido». Inténtalo de nuevo.'); }
  renderStatus();
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
