/* TASKVERSE – vanilla JS: DOM manipulation, events, localStorage persistence */
(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const cap = s => s[0].toUpperCase() + s.slice(1);
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const PR = { high: 3, medium: 2, low: 1 }, PTS = { high: 30, medium: 20, low: 10 };
const ICONS = {
  menu:'M4 6h16M4 12h16M4 18h16', x:'M6 6l12 12M18 6L6 18', home:'M3 11l9-8 9 8M5 10v10h14V10',
  list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', calendar:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', check:'M5 12l5 5 9-10', tag:'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  plus:'M12 5v14M5 12h14', edit:'M4 20h4L19 9l-4-4L4 16v4z', trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  moon:'M20 14A8 8 0 019.5 4 8 8 0 1020 14z', sun:'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  target:'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z', search:'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  flame:'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'
};
const svg = n => `<svg viewBox="0 0 24 24"><path d="${ICONS[n]}"/></svg>`;   // static strings only, never user text
const paintIcons = () => $$('i[data-i]').forEach(i => i.innerHTML = svg(i.dataset.i));

/* safe localStorage wrapper (private mode / quota errors must not break the app) */
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};

/* ---------- state (single source of truth) ---------- */
const KEY = 'taskverse.tasks.v1';
const state = { tasks: load(), view: 'overview', status: 'all', sort: 'priority', q: '', focus: false, fresh: null, editId: null, pendingDelete: null };

/** Load + validate tasks; corrupted JSON falls back to an empty list. */
function load() {
  try {
    const raw = JSON.parse(store.get(KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && typeof t.text === 'string' && t.text.trim()).map(t => ({
      id: Number(t.id) || Date.now() + Math.random(), text: t.text.slice(0, 120), done: !!t.done,
      priority: PR[t.priority] ? t.priority : 'medium', category: ['Personal', 'Study', 'Work', 'Other'].includes(t.category) ? t.category : 'Other',
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '', created: Number(t.created) || Date.now(), completedAt: t.done ? Number(t.completedAt) || Date.now() : null
    }));
  } catch { return []; }
}
const save = () => { if (!store.set(KEY, JSON.stringify(state.tasks))) toast('Storage is unavailable. Changes will not persist.', true); };

/* ---------- derived data ---------- */
function visible() {
  const t = iso(new Date()), v = state.view;
  let a = state.tasks.slice();
  if (v === 'today') a = a.filter(x => x.due === t);
  else if (v === 'upcoming') a = a.filter(x => x.due > t && !x.done);
  else if (v === 'completed') a = a.filter(x => x.done);
  else if (v.startsWith('cat:')) a = a.filter(x => x.category === v.slice(4));
  const st = state.focus ? 'active' : state.status;
  if (st === 'active') a = a.filter(x => !x.done);
  if (st === 'completed') a = a.filter(x => x.done);
  if (state.q) a = a.filter(x => x.text.toLowerCase().includes(state.q));
  const by = { priority: (p, q) => PR[q.priority] - PR[p.priority] || q.created - p.created, newest: (p, q) => q.created - p.created, oldest: (p, q) => p.created - q.created };
  return a.sort(by[state.sort]);
}
function dueInfo(t) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(t.due + 'T00:00:00'), diff = Math.round((d - today) / 864e5);
  if (diff < 0 && !t.done) return { label: 'Overdue · ' + d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), cls: 'late' };
  if (diff === 0) return { label: 'Today', cls: 'soon' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'soon' };
  return { label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), cls: '' };
}
function streak() {
  const days = new Set(state.tasks.filter(t => t.done && t.completedAt).map(t => iso(new Date(t.completedAt))));
  const d = new Date(); if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- rendering ---------- */
function taskNode(t) {
  const li = el('li', `task p-${t.priority}${t.done ? ' done' : ''}${state.fresh === t.id ? ' fresh' : ''}`);
  li.dataset.id = t.id;
  const chk = el('button', 'chk'); chk.dataset.a = 'toggle'; chk.setAttribute('role', 'checkbox');
  chk.setAttribute('aria-checked', t.done); chk.setAttribute('aria-label', `Mark "${t.text}" as ${t.done ? 'active' : 'completed'}`);
  chk.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3L17 9"/></svg>';
  const body = el('div', 'tbody'); body.append(el('div', 'ttitle', t.text));   // textContent: safe against injected HTML
  const meta = el('div', 'meta'); meta.append(el('span', 'pill pr', cap(t.priority)), el('span', 'pill', t.category));
  if (t.due) { const d = dueInfo(t); meta.append(el('span', 'pill ' + d.cls, d.label)); }
  body.append(meta);
  const acts = el('div', 'acts');
  [['edit', 'Edit task'], ['trash', 'Delete task']].forEach(([ic, lbl]) => {
    const b = el('button'); b.dataset.a = ic === 'trash' ? 'delete' : 'edit'; b.setAttribute('aria-label', lbl); b.innerHTML = svg(ic); acts.append(b);
  });
  li.append(chk, body, acts);
  return li;
}
function render(swap) {
  const list = $('#list'), items = visible();
  list.replaceChildren(...items.map(taskNode));
  if (swap) { list.classList.remove('swap'); void list.offsetWidth; list.classList.add('swap'); }
  const empty = !items.length; $('#empty').hidden = !empty;
  $('#emptyT').textContent = state.tasks.length ? 'Nothing matches here' : 'Your universe is quiet';
  $('#emptyP').textContent = state.tasks.length ? 'Try another filter or search, or add a new task.' : 'Add your first task and start moving.';
  renderStats();
  if (state.fresh) { const f = state.fresh; setTimeout(() => { if (state.fresh === f) state.fresh = null; }, 700); }   // play entrance animation once
}
/** Animate a number from its previous value to a new one. */
function countTo(node, to, sfx = '') {
  const from = Number(node.dataset.v) || 0, s = performance.now(); node.dataset.v = to;
  (function step(n) { const p = Math.min(1, (n - s) / 500); node.textContent = Math.round(from + (to - from) * p) + sfx; if (p < 1) requestAnimationFrame(step); })(s);
}
function renderStats() {
  const T = state.tasks, total = T.length, done = T.filter(t => t.done).length, pend = total - done, pct = total ? Math.round(done / total * 100) : 0;
  countTo($('#sTotal'), total); countTo($('#sDone'), done); countTo($('#sPend'), pend); countTo($('#pct'), pct, '%');
  $('#clearBtn').hidden = !done;
  $('#ringBar').style.strokeDashoffset = 326.7 * (1 - pct / 100);
  $('#liveCount').textContent = `${pend} active · ${done} done`;
  $('#msg').textContent = !total ? 'Add your first task to set the day in motion.' : !pend ? 'All clear. Take a breath, you earned it.' : `${pend} task${pend > 1 ? 's' : ''} left. Start with the highest priority one.`;
  const t = iso(new Date());
  const counts = { tasks: pend, today: T.filter(x => x.due === t && !x.done).length, upcoming: T.filter(x => x.due > t && !x.done).length, completed: done };
  $$('[data-count]').forEach(e => e.textContent = counts[e.dataset.count] || '');
  // weekly chart (completions per day, last 7 days)
  const week = $('#week'), cells = [], max = Math.max(1, ...Array.from({ length: 7 }, (_, i) => dayCount(6 - i)));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const c = el('div', i === 0 ? 'today' : ''), bar = el('span'); bar.style.height = Math.max(4, dayCount(i) / max * 80) + 'px'; bar.title = dayCount(i) + ' completed';
    c.append(bar, el('small', '', d.toLocaleDateString('en', { weekday: 'narrow' }))); cells.push(c);
  }
  week.replaceChildren(...cells);
  const s = streak(); $('#streak').textContent = s;
  $('#score').textContent = T.filter(x => x.done).reduce((a, x) => a + PTS[x.priority], 0) + s * 5;
  const up = T.filter(x => x.due >= t && !x.done).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4), ul = $('#up');
  ul.replaceChildren(...(up.length ? up.map(x => { const li = el('li'); li.append(el('p', '', x.text), el('span', '', dueInfo(x).label)); return li; }) : [Object.assign(el('li'), { innerHTML: '<p>No upcoming deadlines.</p>' })]));
}
function dayCount(back) { const d = new Date(); d.setDate(d.getDate() - back); const k = iso(d); return state.tasks.filter(t => t.done && t.completedAt && iso(new Date(t.completedAt)) === k).length; }

/* ---------- hero: greeting, date, clock, quote ---------- */
const QUOTES = ['Small steps, repeated daily, move mountains.', 'Focus on progress, not perfection.', 'Do the hard thing first; the day gets lighter.', 'What you do today shapes what you can do tomorrow.', 'Done is a decision. Make it.', 'Clear the next task, not the whole list.', 'Energy follows action. Begin.'];
function tick() {
  const n = new Date(), h = n.getHours();
  $('#clock').textContent = n.toLocaleTimeString('en-GB');
  $('#greet').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night') + ', explorer';
  $('#date').textContent = n.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- toasts, confetti ---------- */
function toast(msg, bad) {
  const t = el('div', 'toast' + (bad ? ' bad' : ''), msg); $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#7c5cff', '#c4b5fd', '#22d3ee', '#ff5d8f', '#ffb454'];
  const ps = Array.from({ length: 140 }, () => ({ x: c.width / 2, y: c.height * .4, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 3, s: Math.random() * 7 + 4, r: Math.random() * 6, c: cols[Math.random() * 5 | 0] }));
  let f = 0;
  (function loop() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 170) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------- task actions ---------- */
function addTask(data) {
  const t = { id: Date.now(), text: data.text.trim(), done: false, priority: data.priority || 'medium', category: data.category || 'Personal', due: data.due || '', created: Date.now(), completedAt: null };
  state.tasks.push(t); state.fresh = t.id; save(); render(); toast('Task added');
}
function toggle(id) {
  const t = state.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done; t.completedAt = t.done ? Date.now() : null; state.fresh = t.done ? id : null;
  save(); render(); toast(t.done ? 'Task completed' : 'Task reopened');
  if (t.done && state.tasks.every(x => x.done)) { confetti(); toast('All tasks complete. Universe cleared!'); }
}
function remove(id) { state.tasks = state.tasks.filter(t => t.id !== id); state.fresh = null; save(); render(); toast('Task deleted'); }

/* ---------- modal (create / edit) ---------- */
const modal = $('#modal');
function openModal(task) {
  state.editId = task ? task.id : null;
  $('#modalTitle').textContent = task ? 'Edit task' : 'New task'; $('#saveBtn').textContent = task ? 'Save changes' : 'Add task';
  $('#fText').value = task ? task.text : $('#quickInput').value.trim(); $('#fPri').value = task ? task.priority : 'medium';
  $('#fCat').value = task ? task.category : 'Personal'; $('#fDue').value = task ? task.due : ''; $('#fErr').hidden = true;
  modal.showModal(); $('#fText').focus();
}
$('#taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = { text: $('#fText').value, priority: $('#fPri').value, category: $('#fCat').value, due: $('#fDue').value };
  if (!data.text.trim()) { $('#fErr').hidden = false; return $('#fText').focus(); }
  if (state.editId) {
    Object.assign(state.tasks.find(t => t.id === state.editId), { ...data, text: data.text.trim() }); save(); render(); toast('Task updated');
  } else { addTask(data); $('#quickInput').value = ''; }
  modal.close();
});
$('#cancelBtn').addEventListener('click', () => modal.close());
$('#newBtn').addEventListener('click', () => openModal());

/* ---------- events ---------- */
$('#quick').addEventListener('submit', e => {            // Add button and Enter key
  e.preventDefault(); const v = $('#quickInput').value;
  if (!v.trim()) return toast('Type a task first', true);
  addTask({ text: v, priority: $('#quickPri').value, category: $('#quickCat').value }); $('#quickInput').value = '';
});
$('#list').addEventListener('click', e => {               // event delegation
  const b = e.target.closest('[data-a]'); if (!b) return;
  const id = Number(b.closest('li').dataset.id), t = state.tasks.find(x => x.id === id);
  if (b.dataset.a === 'toggle') toggle(id);
  if (b.dataset.a === 'edit') openModal(t);
  if (b.dataset.a === 'delete') { state.pendingDelete = id; $('#confirmTitle').textContent = 'Delete this task?'; $('#yesBtn').textContent = 'Delete task'; $('#confirmTxt').textContent = `“${t.text}” will be removed permanently.`; $('#confirm').showModal(); }
});
$('#yesBtn').addEventListener('click', () => {
  if (state.pendingDelete === 'done') { state.tasks = state.tasks.filter(t => !t.done); save(); render(); toast('Completed tasks cleared'); }
  else remove(state.pendingDelete);
  $('#confirm').close();
});
$('#clearBtn').addEventListener('click', () => {
  const n = state.tasks.filter(t => t.done).length; state.pendingDelete = 'done';
  $('#confirmTitle').textContent = 'Clear completed tasks?'; $('#yesBtn').textContent = 'Clear them';
  $('#confirmTxt').textContent = `${n} completed task${n > 1 ? 's' : ''} will be removed permanently.`; $('#confirm').showModal();
});
/* keyboard shortcuts: N = new task, / = search */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input,select,textarea') || $('dialog[open]')) return;
  if (e.key === 'n') { e.preventDefault(); openModal(); }
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
});
/* keep several open tabs in sync */
addEventListener('storage', e => { if (e.key === KEY) { state.tasks = load(); render(); } });
$('#noBtn').addEventListener('click', () => $('#confirm').close());
$('#search').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); render(true); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; render(true); });
$$('.chip[data-status]').forEach(b => b.addEventListener('click', () => {
  state.status = b.dataset.status; $$('.chip[data-status]').forEach(x => x.classList.toggle('on', x === b)); render(true);
}));
$('#focusBtn').addEventListener('click', e => {
  state.focus = !state.focus; e.currentTarget.setAttribute('aria-pressed', state.focus);
  toast(state.focus ? 'Focus mode on: active tasks only' : 'Focus mode off'); render(true);
});
const TITLES = { overview: 'Overview', tasks: 'My Tasks', today: 'Today', upcoming: 'Upcoming', completed: 'Completed' };
$$('.nav[data-view]').forEach(b => b.addEventListener('click', () => {
  state.view = b.dataset.view; $$('.nav[data-view]').forEach(x => x.classList.toggle('on', x === b));
  $('#viewTitle').textContent = TITLES[state.view] || state.view.slice(4) + ' tasks'; closeNav(); render(true);
}));

/* hamburger drawer */
const openNav = () => { document.body.classList.add('nav-open'); $('#menuBtn').setAttribute('aria-expanded', 'true'); };
const closeNav = () => { document.body.classList.remove('nav-open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); };
$('#menuBtn').addEventListener('click', openNav); $('#closeBtn').addEventListener('click', closeNav); $('#scrim').addEventListener('click', closeNav);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
matchMedia('(min-width:901px)').addEventListener('change', closeNav);

/* theme */
function setTheme(t) {
  document.documentElement.dataset.theme = t; store.set('taskverse.theme', t);
  $('#themeLbl').textContent = t === 'dark' ? 'Light theme' : 'Dark theme';
  $$('.js-theme i').forEach(i => i.innerHTML = svg(t === 'dark' ? 'moon' : 'sun'));
}
$$('.js-theme').forEach(b => b.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')));

/* ---------- init ---------- */
paintIcons();
setTheme(store.get('taskverse.theme') === 'light' ? 'light' : 'dark');
$('#quote').textContent = QUOTES[Math.floor(Date.now() / 864e5) % QUOTES.length];
tick(); setInterval(tick, 1000);
render();
setTimeout(() => state.fresh = null, 800);
})();
