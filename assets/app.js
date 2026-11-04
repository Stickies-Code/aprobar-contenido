(() => {
const WEEKS = window.WEEKS || [];
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

let week = WEEKS[WEEKS.length - 1];
const fromHash = location.hash.slice(1);
const savedW = store.get('crisWeek');
if (WEEKS.find(w => w.id === fromHash)) week = WEEKS.find(w => w.id === fromHash);
else if (WEEKS.find(w => w.id === savedW)) week = WEEKS.find(w => w.id === savedW);

const state = { reviews: {}, comments: [], ok: false };
let myName = store.get('crisName') || '';
let myKey = store.get('crisKey');
if (!myKey) { myKey = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); store.set('crisKey', myKey); }

const fmtDate = iso => { try { return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
function notice(msg) { const n = $('#notice'); n.textContent = msg || ''; n.hidden = !msg; }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json' } });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { status: r.status });
  return j;
}

// ── Nombre del revisor
let pendingAction = null;
function renderReviewer() {
  $('#reviewer').innerHTML = myName
    ? `Revisando como <b>${esc(myName)}</b> <button type="button" class="linkbtn" data-rename>cambiar</button>`
    : `<button type="button" class="linkbtn" data-rename>Indica tu nombre para aprobar y comentar</button>`;
}
function askName(then) {
  pendingAction = then || null;
  $('#nameInput').value = myName; $('#nameModal').hidden = false; setTimeout(() => $('#nameInput').focus(), 30);
}
$('#nameForm').addEventListener('submit', e => {
  e.preventDefault(); const v = $('#nameInput').value.trim().slice(0, 40); if (!v) return;
  myName = v; store.set('crisName', v); $('#nameModal').hidden = true; renderReviewer();
  const a = pendingAction; pendingAction = null; if (a) a();
});
$('#nameCancel').addEventListener('click', () => { $('#nameModal').hidden = true; pendingAction = null; });
const withName = fn => myName ? fn() : askName(fn);

// ── Pintado
function renderWeeks() {
  $('#weeks').innerHTML = WEEKS.map(w => `<button type="button" data-w="${w.id}" aria-pressed="${w === week}">${esc(w.label)}</button>`).join('');
  $('#weeks').hidden = WEEKS.length < 2;
}
function renderCards() {
  $('#wkTitle').innerHTML = week.title;
  document.title = `${week.label.replace(/<[^>]+>/g, '')} · Aprobación Instagram Criscolor`;
  $('#main').innerHTML = week.items.map(it => {
    const frames = Array.from({ length: it.n }, (_, i) =>
      `<div class="frame"><img src="/img/${it.id}-${i + 1}.jpg?v=${it.v || 1}" alt="${esc(it.title)} · ${i + 1} de ${it.n}" loading="lazy">${it.n > 1 ? `<span class="n">${i + 1}/${it.n}</span>` : ''}</div>`).join('');
    const kind = it.type === 'post' ? (it.n > 1 ? `Carrusel · ${it.n} diapositivas` : 'Publicación') : `Historias · tanda de ${it.n}`;
    return `<article class="card ${it.type}" id="${it.id}" data-id="${it.id}">
      <div class="card-h">
        <div>
          <div class="when"><span class="day">${esc(it.day)} ${esc(it.date)}</span><span class="chip ${it.type}">${kind}</span></div>
          <h2>${esc(it.title)}</h2>
          <p class="goal">${esc(it.goal)}</p>
        </div>
        <span class="badge pend" data-badge>Pendiente</span>
      </div>
      <div class="media">${frames}</div>
      <div class="body">
        ${it.copy ? `<div class="col"><p class="lbl">Texto del post <button type="button" class="copybtn" data-copy>Copiar</button></p><pre class="copy">${esc(it.copy)}</pre></div>` : ''}
        <div class="col"><p class="lbl">Cómo se publica</p><ul class="notes">${it.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
      </div>
      <div class="review">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button type="button" class="approve" data-approve aria-pressed="false"><span class="thumb">👍</span><span data-label>Aprobar</span></button>
          <span class="who" data-who></span>
        </div>
        <ul class="comments" data-comments></ul>
        <form class="cform" data-form>
          <textarea name="t" rows="2" maxlength="2000" placeholder="Escribe un comentario o un cambio que harías…" aria-label="Comentario para ${esc(it.title)}"></textarea>
          <button type="submit">Comentar</button>
        </form>
      </div>
    </article>`;
  }).join('');
}
function renderStatus() {
  let ok = 0; const sum = [];
  for (const it of week.items) {
    const r = state.reviews[it.id]; const approved = !!(r && r.approved);
    const cs = state.comments.filter(c => c.item === it.id).sort((a, b) => a.at < b.at ? -1 : 1);
    if (approved) ok++;
    const card = document.getElementById(it.id); if (!card) continue;
    card.classList.toggle('is-ok', approved);
    const badge = $('[data-badge]', card);
    badge.className = 'badge ' + (approved ? 'ok' : 'pend');
    badge.textContent = approved ? '✓ Aprobado' : (cs.length ? `${cs.length} comentario${cs.length > 1 ? 's' : ''}` : 'Pendiente');
    const btn = $('[data-approve]', card);
    btn.setAttribute('aria-pressed', approved);
    $('[data-label]', btn).textContent = approved ? 'Aprobado' : 'Aprobar';
    btn.disabled = !state.ok;
    $('[data-who]', card).textContent = approved ? `Aprobado por ${r.by || 'alguien'} · ${fmtDate(r.at)} — pulsa otra vez para retirarlo` : '';
    $('[data-comments]', card).innerHTML = cs.map(c => `<li><div class="meta"><span>${esc(c.by || 'Alguien')} · ${esc(fmtDate(c.at))}</span>${c.mine ? `<button type="button" data-del="${esc(c.id)}">Borrar</button>` : ''}</div><p>${esc(c.text)}</p></li>`).join('');
    const ta = $('textarea', card), sb = $('[data-form] button', card);
    ta.disabled = sb.disabled = !state.ok;
    const st = approved ? '<span class="st ok">✓ Aprobado</span>' : cs.length ? `<span class="st com">💬 ${cs.length}</span>` : '<span class="st pend">Pendiente</span>';
    sum.push(`<a class="sum" href="#${it.id}"><b>${esc(it.day.slice(0, 3))} ${esc(it.date.split(' ')[0])}</b><span class="ty">${it.type === 'post' ? 'Post' : 'Historias'}</span>${st}</a>`);
  }
  $('#summary').innerHTML = sum.join('');
  $('#progTxt').textContent = state.ok ? `${ok} de ${week.items.length} piezas aprobadas` : 'Sin conexión';
  $('#progBar').style.width = (100 * ok / week.items.length) + '%';
}
function renderAll() { renderWeeks(); renderCards(); renderStatus(); }

// ── Datos
let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const j = await api(`/api/state?week=${encodeURIComponent(week.id)}&key=${encodeURIComponent(myKey)}`);
    state.reviews = j.reviews || {}; state.comments = j.comments || []; state.ok = true;
    if ($('#notice').dataset.kind === 'conn') { notice(''); $('#notice').dataset.kind = ''; }
  } catch (e) {
    state.ok = false; $('#notice').dataset.kind = 'conn';
    notice(e.status === 503 ? 'La base de datos aún no está conectada en Vercel. Avisa a Borja.' : 'No conseguimos cargar los aprobados. Revisa la conexión; lo reintentamos solos.');
  }
  loading = false; renderStatus();
}

// ── Interacciones
$('#weeks').addEventListener('click', e => {
  const b = e.target.closest('button[data-w]'); if (!b) return;
  week = WEEKS.find(w => w.id === b.dataset.w); store.set('crisWeek', week.id);
  state.reviews = {}; state.comments = []; renderAll(); load();
});
document.addEventListener('click', async e => {
  if (e.target.closest('[data-rename]')) { askName(); return; }
  const img = e.target.closest('.frame img');
  if (img) { const lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = `<img src="${img.src}" alt=""><button type="button">Cerrar ✕</button>`; lb.addEventListener('click', () => lb.remove()); document.body.appendChild(lb); return; }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const pre = cp.closest('.col').querySelector('.copy');
    try { await navigator.clipboard.writeText(pre.textContent); cp.textContent = 'Copiado ✓'; }
    catch (err) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = 'Seleccionado'; }
    setTimeout(() => cp.textContent = 'Copiar', 1800); return;
  }
  const ap = e.target.closest('[data-approve]');
  if (ap && state.ok) {
    withName(async () => {
      const id = ap.closest('.card').dataset.id; const cur = state.reviews[id];
      const approved = !(cur && cur.approved);
      ap.disabled = true;
      try { const j = await api('/api/review', { method: 'POST', body: JSON.stringify({ week: week.id, item: id, approved, name: myName }) }); state.reviews[id] = j.review; }
      catch (err) { notice('No se ha podido guardar el aprobado. Inténtalo de nuevo.'); }
      ap.disabled = false; renderStatus();
    });
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    del.disabled = true;
    try { await api('/api/comment', { method: 'DELETE', body: JSON.stringify({ week: week.id, id: del.dataset.del, key: myKey }) }); state.comments = state.comments.filter(c => c.id !== del.dataset.del); }
    catch (err) { notice('No se ha podido borrar el comentario.'); }
    renderStatus();
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); if (!state.ok) return;
  const ta = $('textarea', f); const text = ta.value.trim(); if (!text) return;
  withName(async () => {
    const id = f.closest('.card').dataset.id; const btn = $('button', f);
    btn.disabled = true;
    try { const j = await api('/api/comment', { method: 'POST', body: JSON.stringify({ week: week.id, item: id, text, name: myName, key: myKey }) }); state.comments.push(j.comment); ta.value = ''; }
    catch (err) { notice('No se ha podido enviar el comentario. Inténtalo de nuevo.'); }
    btn.disabled = false; renderStatus();
  });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelector('.lb')?.remove(); if (!$('#nameModal').hidden) $('#nameCancel').click(); } });

renderReviewer(); renderAll(); load();
setInterval(() => { if (!document.hidden) load(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
