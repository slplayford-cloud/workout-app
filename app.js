/* Lift Log — personal Hevy-style workout tracker. Plain JS, no build step. */
'use strict';

/* ======================================================================
   Utilities
   ====================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
const clone = (o) => JSON.parse(JSON.stringify(o));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const fmtNum = (n, d = 0) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });
const fmtW = (w) => (w == null || w === '' ? '—' : String(Math.round(w * 10) / 10));
const fmtDur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
const fmtClock = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDateLong = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const relDays = (d) => { const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(); b.setHours(0, 0, 0, 0); const days = Math.round((b - a) / 864e5); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? `${days}d ago` : days < 60 ? `${Math.floor(days / 7)}w ago` : fmtDate(d); };
const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }; // Monday
const weekKey = (d) => { const x = startOfWeek(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const epley = (w, r) => (w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0);
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const by = (k, dir = 1) => (a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0);
const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function toast(msg, err = false) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`;
  clearTimeout(toast._t); toast._t = setTimeout(() => (root.innerHTML = ''), err ? 3500 : 2000);
}
function sheet(html) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim"><div class="sheet" role="dialog">${html}</div></div>`;
  const scrim = root.firstElementChild;
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeSheet(); });
  return $('.sheet', root);
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }
function confirmDlg(title, msg, okLabel = 'Delete', danger = true) {
  return new Promise((res) => {
    const s = sheet(`<div class="grab"></div><h2>${esc(title)}</h2><p class="t2">${esc(msg)}</p>
      <div class="actions"><button class="btn ghost" data-a="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(okLabel)}</button></div>`);
    s.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; closeSheet(); res(b.dataset.a === 'ok'); });
  });
}
function promptDlg(title, value = '', placeholder = '') {
  return new Promise((res) => {
    const s = sheet(`<div class="grab"></div><h2>${esc(title)}</h2><input class="input" id="pd-in" value="${esc(value)}" placeholder="${esc(placeholder)}">
      <div class="actions"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="ok">Save</button></div>`);
    const inp = $('#pd-in', s); inp.focus(); inp.select();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { closeSheet(); res(inp.value.trim()); } });
    s.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const v = inp.value.trim(); closeSheet(); res(b.dataset.a === 'ok' ? v : null); });
  });
}

/* ======================================================================
   Taxonomy helpers (from seed-data.js)
   ====================================================================== */
function taxonomyFromSeed() {
  const groups = [], subs = [];
  SEED.GROUPS.forEach(([id, name, region, subList], i) => {
    groups.push({ id, name, region, position: i + 1 });
    subList.forEach(([sid, sname], j) => subs.push({ id: `${id}.${sid}`, group_id: id, name: sname, position: j + 1 }));
  });
  return { groups, subs };
}
function seedExercisesFromSeed() {
  return SEED.EXERCISES.map(([name, notes, targets]) => ({
    id: uuid(), name, notes: notes || null, archived: false, created_at: new Date().toISOString(),
    targets: targets.map((t) => {
      const primary = !t.endsWith('*'); const key = t.replace(/\*$/, '');
      return { group_id: key.split('.')[0], sub_group_id: key.includes('.') ? key : null, is_primary: primary };
    }),
  }));
}
function seedRoutinesFromSeed() {
  return SEED.ROUTINES.map(([name, notes, slots], i) => ({
    id: uuid(), name, notes: notes || null, position: i, archived: false, created_at: new Date().toISOString(),
    slots: slots.map(([g, s, sets, label], j) => ({ id: uuid(), position: j, group_id: g, sub_group_id: s ? `${g}.${s}` : null, sets, label: label || null })),
  }));
}
const DEFAULT_SETTINGS = { rest_seconds: 90, target_min: 10, target_max: 20, group_targets: {} };

/* ======================================================================
   Data layer — two backends with the same interface
   Shapes:
     exercise { id, name, notes, archived, created_at, targets:[{group_id, sub_group_id, is_primary}] }
     routine  { id, name, notes, position, archived, slots:[{id, position, group_id, sub_group_id, sets, label}] }
     workout  { id, routine_id, name, started_at, ended_at, notes,
                exercises:[{ id, exercise_id, routine_slot_id, slot_group_id, slot_sub_group_id, slot_label, position, notes,
                             sets:[{ id, position, weight_lb, reps, rpe, set_type, done, completed_at }] }] }
   ====================================================================== */
class LocalDB {
  constructor() { this.mode = 'local'; this.key = 'wt_local_v1'; this.d = LS.get(this.key, null) || { exercises: [], routines: [], workouts: [], settings: null }; }
  save() { LS.set(this.key, this.d); }
  async init() { return { id: 'local', email: 'This device (local mode)' }; }
  onAuth() {}
  async signOut() { }
  async fetchAll() {
    const { groups, subs } = taxonomyFromSeed();
    return { groups, subs, exercises: clone(this.d.exercises), routines: clone(this.d.routines), workouts: clone(this.d.workouts), settings: this.d.settings ? clone(this.d.settings) : null };
  }
  async insertExercises(list) { this.d.exercises.push(...clone(list)); this.save(); return list; }
  async updateExercise(ex) { const i = this.d.exercises.findIndex((e) => e.id === ex.id); if (i < 0) throw new Error('Exercise not found'); this.d.exercises[i] = clone(ex); this.save(); }
  async deleteExercise(id) { this.d.exercises = this.d.exercises.filter((e) => e.id !== id); this.save(); }
  async insertRoutine(r) { this.d.routines.push(clone(r)); this.save(); return r; }
  async updateRoutine(r) { const i = this.d.routines.findIndex((x) => x.id === r.id); if (i < 0) throw new Error('Routine not found'); this.d.routines[i] = clone(r); this.save(); }
  async deleteRoutine(id) { this.d.routines = this.d.routines.filter((r) => r.id !== id); this.d.workouts.forEach((w) => { if (w.routine_id === id) w.routine_id = null; }); this.save(); }
  async insertWorkout(w) { this.d.workouts.unshift(clone(w)); this.save(); return w; }
  async updateWorkout(w) { const i = this.d.workouts.findIndex((x) => x.id === w.id); if (i < 0) throw new Error('Workout not found'); this.d.workouts[i] = clone(w); this.save(); }
  async deleteWorkout(id) { this.d.workouts = this.d.workouts.filter((w) => w.id !== id); this.save(); }
  async saveSettings(s) { this.d.settings = clone(s); this.save(); }
  exportJSON() { return JSON.stringify(this.d, null, 2); }
}

class SupabaseDB {
  constructor(url, key) {
    this.mode = 'supabase';
    this.sb = window.supabase.createClient(url, key);
    this.userId = null;
  }
  redirect() { return location.origin + location.pathname; }
  onAuth(cb) { this.sb.auth.onAuthStateChange((ev, session) => cb(session?.user || null, ev)); }
  signIn(email, password) { return this.sb.auth.signInWithPassword({ email, password }); }
  signUp(email, password) { return this.sb.auth.signUp({ email, password, options: { emailRedirectTo: this.redirect() } }); }
  magicLink(email) { return this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirect() } }); }
  resetPassword(email) { return this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.redirect() }); }
  updatePassword(password) { return this.sb.auth.updateUser({ password }); }
  signOut() { return this.sb.auth.signOut(); }
  async q(p) {
    const { data, error } = await p;
    if (error) {
      if (/uq_exercises_user_name/.test(error.message || '')) throw new Error('An exercise with that name already exists');
      throw new Error(error.message || String(error));
    }
    return data;
  }
  own(row) { return Object.assign({ user_id: this.userId }, row); }

  async fetchAll() {
    const sb = this.sb;
    const [groups, subs, exRows, rRows, wRows, settings] = await Promise.all([
      this.q(sb.from('muscle_groups').select('*').order('position')),
      this.q(sb.from('sub_groups').select('*').order('position')),
      this.q(sb.from('exercises').select('id,name,notes,archived,created_at,targets:exercise_targets(group_id,sub_group_id,is_primary)').order('name')),
      this.q(sb.from('routines').select('id,name,notes,position,archived,created_at,slots:routine_slots(id,position,group_id,sub_group_id,sets,label)').order('position')),
      this.q(sb.from('workouts').select('id,routine_id,name,started_at,ended_at,notes,exercises:workout_exercises(id,exercise_id,routine_slot_id,slot_group_id,slot_sub_group_id,slot_label,position,notes,sets(id,position,weight_lb,reps,rpe,set_type,done,completed_at))').order('started_at', { ascending: false }).limit(2000)),
      this.q(sb.from('user_settings').select('rest_seconds,target_min,target_max,group_targets').maybeSingle()),
    ]);
    rRows.forEach((r) => r.slots.sort(by('position')));
    wRows.forEach((w) => { w.exercises.sort(by('position')); w.exercises.forEach((e) => { e.sets.sort(by('position')); e.sets.forEach((s) => { if (s.weight_lb != null) s.weight_lb = Number(s.weight_lb); if (s.rpe != null) s.rpe = Number(s.rpe); }); }); });
    const tax = groups.length ? { groups, subs } : taxonomyFromSeed();
    return { ...tax, exercises: exRows, routines: rRows, workouts: wRows, settings };
  }
  targetRows(ex) { return (ex.targets || []).map((t) => this.own({ id: uuid(), exercise_id: ex.id, group_id: t.group_id, sub_group_id: t.sub_group_id || null, is_primary: t.is_primary !== false })); }
  exRow(e) { return this.own({ id: e.id, name: e.name, notes: e.notes || null, archived: !!e.archived }); }
  async insertExercises(list) {
    await this.q(this.sb.from('exercises').insert(list.map((e) => this.exRow(e))));
    const t = list.flatMap((e) => this.targetRows(e));
    if (t.length) await this.q(this.sb.from('exercise_targets').insert(t));
    return list;
  }
  async updateExercise(ex) {
    await this.q(this.sb.from('exercises').update({ name: ex.name, notes: ex.notes || null, archived: !!ex.archived }).eq('id', ex.id));
    await this.q(this.sb.from('exercise_targets').delete().eq('exercise_id', ex.id));
    const t = this.targetRows(ex); if (t.length) await this.q(this.sb.from('exercise_targets').insert(t));
  }
  async deleteExercise(id) { await this.q(this.sb.from('exercises').delete().eq('id', id)); }
  rRow(r) { return this.own({ id: r.id, name: r.name, notes: r.notes || null, position: r.position || 0, archived: !!r.archived }); }
  slotRows(r) { return r.slots.map((s, i) => this.own({ id: s.id, routine_id: r.id, position: i, group_id: s.group_id, sub_group_id: s.sub_group_id || null, sets: s.sets, label: s.label || null })); }
  async insertRoutine(r) {
    await this.q(this.sb.from('routines').insert(this.rRow(r)));
    const s = this.slotRows(r); if (s.length) await this.q(this.sb.from('routine_slots').insert(s));
    return r;
  }
  async updateRoutine(r) {
    const row = this.rRow(r); delete row.id; delete row.user_id;
    await this.q(this.sb.from('routines').update(row).eq('id', r.id));
    const keep = r.slots.map((s) => s.id);
    const existing = await this.q(this.sb.from('routine_slots').select('id').eq('routine_id', r.id));
    const gone = existing.map((x) => x.id).filter((id) => !keep.includes(id));
    if (gone.length) await this.q(this.sb.from('routine_slots').delete().in('id', gone));
    const s = this.slotRows(r); if (s.length) await this.q(this.sb.from('routine_slots').upsert(s));
  }
  async deleteRoutine(id) { await this.q(this.sb.from('routines').delete().eq('id', id)); }
  wRow(w) { return this.own({ id: w.id, routine_id: w.routine_id || null, name: w.name, started_at: w.started_at, ended_at: w.ended_at || null, notes: w.notes || null }); }
  childRows(w) {
    const wex = [], sets = [];
    w.exercises.forEach((e, i) => {
      wex.push(this.own({ id: e.id, workout_id: w.id, exercise_id: e.exercise_id, routine_slot_id: e.routine_slot_id || null, slot_group_id: e.slot_group_id || null, slot_sub_group_id: e.slot_sub_group_id || null, slot_label: e.slot_label || null, position: i, notes: e.notes || null }));
      e.sets.forEach((s, j) => sets.push(this.own({ id: s.id, workout_exercise_id: e.id, position: j, weight_lb: s.weight_lb ?? null, reps: s.reps ?? null, rpe: s.rpe ?? null, set_type: s.set_type || 'normal', done: !!s.done, completed_at: s.completed_at || null })));
    });
    return { wex, sets };
  }
  async insertWorkout(w) {
    await this.q(this.sb.from('workouts').insert(this.wRow(w)));
    const { wex, sets } = this.childRows(w);
    if (wex.length) await this.q(this.sb.from('workout_exercises').insert(wex));
    if (sets.length) await this.q(this.sb.from('sets').insert(sets));
    return w;
  }
  async updateWorkout(w) {
    const row = this.wRow(w); delete row.id; delete row.user_id;
    await this.q(this.sb.from('workouts').update(row).eq('id', w.id));
    await this.q(this.sb.from('workout_exercises').delete().eq('workout_id', w.id));
    const { wex, sets } = this.childRows(w);
    if (wex.length) await this.q(this.sb.from('workout_exercises').insert(wex));
    if (sets.length) await this.q(this.sb.from('sets').insert(sets));
  }
  async deleteWorkout(id) { await this.q(this.sb.from('workouts').delete().eq('id', id)); }
  async saveSettings(s) {
    await this.q(this.sb.from('user_settings').upsert(this.own({ rest_seconds: s.rest_seconds, target_min: s.target_min, target_max: s.target_max, group_targets: s.group_targets || {}, updated_at: new Date().toISOString() }), { onConflict: 'user_id' }));
  }
}

/* ======================================================================
   App state, boot, auth, navigation
   ====================================================================== */
const App = {
  db: null, user: null, D: null, started: false,
  tab: 'home', stack: [],
  aw: null,          // active (in-progress) workout, persisted to localStorage
  rest: null,        // { endsAt, total }
  charts: [],        // live Chart.js instances for the current screen
  ui: { exFilter: '', exGroup: '', statsRange: 12, distWeek: 'this', distOpen: {} },
};

function getConfig() {
  const saved = LS.get('wt_cfg', null);
  if (saved && saved.mode) return saved;
  const c = window.APP_CONFIG || {};
  if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY) return { mode: 'supabase', url: c.SUPABASE_URL, key: c.SUPABASE_ANON_KEY };
  return null;
}

async function boot() {
  window.addEventListener('popstate', () => { if (App.stack.length) { App.stack.pop(); render(); } });
  window.addEventListener('error', (e) => toast(e.message || 'Error', true));
  window.addEventListener('unhandledrejection', (e) => toast((e.reason && e.reason.message) || 'Something went wrong', true));
  const cfg = getConfig();
  if (!cfg) return renderSetup();
  if (cfg.mode === 'local') { App.db = new LocalDB(); App.user = await App.db.init(); return startApp(); }
  if (!window.supabase) { $('#app').innerHTML = '<div class="empty"><div class="big">📡</div>Could not load the Supabase client. Check your connection and reload.</div>'; return; }
  App.db = new SupabaseDB(cfg.url, cfg.key);
  App.db.onAuth((user, ev) => {
    if (ev === 'PASSWORD_RECOVERY') { App.user = user; return renderPasswordReset(); }
    if (user && !App.started) { App.user = user; startApp(); }
    else if (!user && (ev === 'SIGNED_OUT' || ev === 'INITIAL_SESSION')) { App.started = false; App.user = null; App.D = null; renderAuth(); }
  });
}

async function startApp() {
  App.started = true;
  if (App.db.mode === 'supabase') App.db.userId = App.user.id;
  $('#app').innerHTML = '<div class="spinner"></div>';
  try {
    await reload();
    if (!App.D.exercises.length) await seedDefaults();
  } catch (e) {
    $('#app').innerHTML = `<div class="screen"><div class="empty"><div class="big">⚠️</div><p>${esc(e.message)}</p>
      <p class="small muted">If this is a fresh Supabase project, make sure you ran schema.sql.</p>
      <button class="btn primary" onclick="location.reload()">Retry</button> <button class="btn ghost" onclick="resetConfig()">Change connection</button></div></div>`;
    return;
  }
  App.aw = LS.get('wt_active', null);
  App.rest = LS.get('wt_rest', null);
  if (App.rest && App.rest.endsAt < Date.now() - 3600e3) App.rest = null;
  $('#tabbar').classList.remove('hide');
  App.stack = [];
  render();
  startTickers();
}

// First-run seed. Guarded against running twice for the same account (two devices
// opened at once, or a reload mid-seed): the unique index on exercises(user_id, name)
// makes the second insert fail, which we treat as "someone else already seeded".
async function seedDefaults() {
  if (seedDefaults.running) return; seedDefaults.running = true;
  try {
    await App.db.insertExercises(seedExercisesFromSeed());
    await reload();
    if (!App.D.routines.length) for (const r of seedRoutinesFromSeed()) await App.db.insertRoutine(r);
    await reload();
    toast('Loaded default exercises & routines');
  } catch (e) {
    if (!/duplicate|unique|23505/i.test(e.message)) throw e;
    await reload();
  } finally { seedDefaults.running = false; }
}

async function reload() {
  const D = await App.db.fetchAll();
  D.groupById = Object.fromEntries(D.groups.map((g) => [g.id, g]));
  D.subById = Object.fromEntries(D.subs.map((s) => [s.id, s]));
  D.groups.forEach((g) => (g.subs = D.subs.filter((s) => s.group_id === g.id)));
  D.exById = Object.fromEntries(D.exercises.map((e) => [e.id, e]));
  D.routineById = Object.fromEntries(D.routines.map((r) => [r.id, r]));
  D.settings = Object.assign({}, DEFAULT_SETTINGS, D.settings || {});
  D.workouts.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  App.D = D;
  buildIndexes();
}

function resetConfig() { LS.del('wt_cfg'); location.reload(); }

/* ---------- setup screen (no config yet) ---------- */
function renderSetup() {
  $('#tabbar').classList.add('hide');
  $('#app').innerHTML = `<div class="auth">
    <div class="logo">🏋️</div><h1>Lift Log</h1><p class="t2">Connect your Supabase project to sync across devices, or keep everything on this device.</p>
    <div class="card">
      <div class="field"><label>Supabase URL</label><input class="input" id="su-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" autocorrect="off"></div>
      <div class="field"><label>Anon (public) key</label><input class="input" id="su-key" placeholder="eyJhbGciOi..." autocapitalize="off" autocorrect="off"></div>
      <button class="btn primary block" id="su-save">Connect</button>
      <p class="small muted center" style="margin:10px 0 0">Project Settings → API in the Supabase dashboard.</p>
    </div>
    <button class="btn ghost block" id="su-local">Use this device only (no account)</button>
    <p class="xs muted center">Local mode keeps data in this browser only. You can export it later from Profile.</p>
  </div>`;
  $('#su-save').onclick = () => {
    const url = $('#su-url').value.trim().replace(/\/$/, ''), key = $('#su-key').value.trim();
    if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) return toast('Check the URL and key', true);
    LS.set('wt_cfg', { mode: 'supabase', url, key }); location.reload();
  };
  $('#su-local').onclick = () => { LS.set('wt_cfg', { mode: 'local' }); location.reload(); };
}

/* ---------- auth ---------- */
function renderAuth(msg = '') {
  $('#tabbar').classList.add('hide');
  $('#app').innerHTML = `<div class="auth">
    <div class="logo">🏋️</div><h1>Lift Log</h1><p class="t2">Sign in to your tracker.</p>
    <div class="card">
      ${msg ? `<p class="small" style="color:var(--good)">${esc(msg)}</p>` : ''}
      <div class="field"><label>Email</label><input class="input" id="au-email" type="email" autocomplete="email" inputmode="email"></div>
      <div class="field"><label>Password</label><input class="input" id="au-pw" type="password" autocomplete="current-password"></div>
      <button class="btn primary block" id="au-in">Sign in</button>
      <div class="row" style="margin-top:8px;gap:4px;justify-content:space-between">
        <button class="link small" id="au-up">Create account</button>
        <button class="link small" id="au-magic">Email me a link</button>
        <button class="link small" id="au-forgot">Forgot?</button>
      </div>
    </div>
    <button class="link small" id="au-cfg">Change connection</button>
  </div>`;
  const email = () => $('#au-email').value.trim(), pw = () => $('#au-pw').value;
  const run = async (fn, okMsg) => {
    try { const { error } = await fn(); if (error) throw error; if (okMsg) toast(okMsg); }
    catch (e) { toast(e.message || 'Failed', true); }
  };
  $('#au-in').onclick = () => run(() => App.db.signIn(email(), pw()));
  $('#au-up').onclick = () => { if (pw().length < 6) return toast('Password needs 6+ characters', true); run(() => App.db.signUp(email(), pw()), 'Account created — check your email if confirmation is required'); };
  $('#au-magic').onclick = () => { if (!email()) return toast('Enter your email first', true); run(() => App.db.magicLink(email()), 'Check your email for the sign-in link'); };
  $('#au-forgot').onclick = () => { if (!email()) return toast('Enter your email first', true); run(() => App.db.resetPassword(email()), 'Password reset email sent'); };
  $('#au-cfg').onclick = resetConfig;
  $('#au-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#au-in').click(); });
}
function renderPasswordReset() {
  $('#tabbar').classList.add('hide');
  $('#app').innerHTML = `<div class="auth"><div class="logo">🔑</div><h1>Set a new password</h1>
    <div class="card"><div class="field"><label>New password</label><input class="input" id="np" type="password" autocomplete="new-password"></div>
    <button class="btn primary block" id="np-save">Save password</button></div></div>`;
  $('#np-save').onclick = async () => {
    const { error } = await App.db.updatePassword($('#np').value);
    if (error) return toast(error.message, true);
    toast('Password updated'); App.started = false; startApp();
  };
}

/* ---------- navigation ---------- */
const TABS = [
  ['home', '🏠', 'Home'], ['routines', '📋', 'Routines'], ['start', '+', 'Start'], ['exercises', '💪', 'Exercises'], ['profile', '📈', 'Profile'],
];
function renderTabbar() {
  $('#tabbar').innerHTML = TABS.map(([id, ic, label]) =>
    `<button class="tab ${id === 'start' ? 'start' : ''} ${App.tab === id && !App.stack.length ? 'on' : ''} ${id === 'start' && App.aw ? 'live' : ''}" data-tab="${id}">
      <span class="ic">${id === 'start' && App.aw ? '▶' : ic}</span><span>${id === 'start' && App.aw ? 'Resume' : label}</span></button>`).join('');
  $$('#tabbar .tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
}
function showTab(t) {
  if (t === 'start' && App.aw) { return push({ type: 'active' }); }
  App.tab = t; App.stack = []; window.scrollTo(0, 0); render();
}
function push(view) { App.stack.push(view); history.pushState({ n: App.stack.length }, ''); window.scrollTo(0, 0); render(); }
function back() { if (App.stack.length) history.back(); else render(); }
function replaceTop(view) { App.stack[App.stack.length - 1] = view; render(); }

function destroyCharts() { App.charts.forEach((c) => { try { c.destroy(); } catch { /* ignore */ } }); App.charts = []; }

function render() {
  destroyCharts();
  renderTabbar();
  const view = App.stack[App.stack.length - 1];
  const root = $('#app');
  root.onclick = root.oninput = root.onchange = null; // screens assign their own; never let stale handlers linger
  if (!view) {
    ({ home: renderHome, routines: renderRoutines, start: renderStart, exercises: renderExercises, profile: renderProfile })[App.tab](root);
  } else {
    const fn = {
      workout: renderWorkoutDetail, exercise: renderExerciseDetail, 'exercise-edit': renderExerciseEdit,
      routine: renderRoutineDetail, 'routine-edit': renderRoutineEdit, active: renderActive, settings: renderSettings, 'workout-edit': renderWorkoutEdit,
    }[view.type];
    fn(root, view);
  }
  renderRestbar();
}
function topbar(title, { backBtn = true, right = '' } = {}) {
  return `<div class="topbar">${backBtn ? '<button class="back" data-back aria-label="Back">‹</button>' : ''}<h1>${esc(title)}</h1>${right}</div>`;
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-back]')) back(); });

/* ======================================================================
   Analytics helpers & indexes
   ====================================================================== */
const isWork = (s) => s.done && s.set_type !== 'warmup' && (s.reps || 0) > 0;
const workSets = (e) => e.sets.filter(isWork);
const setVol = (s) => (s.weight_lb || 0) * (s.reps || 0);
const workoutVolume = (w) => sum(w.exercises, (e) => sum(workSets(e), setVol));
const workoutSets = (w) => sum(w.exercises, (e) => workSets(e).length);
const workoutDuration = (w) => (w.ended_at ? new Date(w.ended_at) - new Date(w.started_at) : 0);
function bestSetOf(sets) { let best = null, bv = -1; for (const s of sets) { const v = epley(s.weight_lb, s.reps); if (v > bv) { bv = v; best = s; } } return best; }
const setLabel = (s) => (s.weight_lb ? `${fmtW(s.weight_lb)} lb × ${s.reps}` : `${s.reps} reps`);

function buildIndexes() {
  const D = App.D;
  D.exHist = {};            // exercise_id -> [{w, e}] newest first
  D.prMap = {};             // set id -> ['1RM', 'Weight', 'Volume']
  D.workoutPRs = {};        // workout id -> count
  for (const w of D.workouts) for (const e of w.exercises) (D.exHist[e.exercise_id] ||= []).push({ w, e });
  const best = {};
  for (const w of [...D.workouts].reverse()) {
    let n = 0;
    for (const e of w.exercises) {
      const b = (best[e.exercise_id] ||= { rm: 0, wt: 0, vol: 0 });
      for (const s of workSets(e)) {
        const tags = [];
        const rm = epley(s.weight_lb, s.reps), vol = setVol(s);
        if (rm > b.rm && rm > 0) { tags.push('1RM'); b.rm = rm; }
        if ((s.weight_lb || 0) > b.wt) { tags.push('Weight'); b.wt = s.weight_lb; }
        if (vol > b.vol && vol > 0) { tags.push('Volume'); b.vol = vol; }
        if (tags.length) { D.prMap[s.id] = tags; n++; }
      }
    }
    D.workoutPRs[w.id] = n;
  }
}
function lastPerf(exId, excludeWorkoutId) {
  return (App.D.exHist[exId] || []).find((x) => x.w.id !== excludeWorkoutId && workSets(x.e).length) || null;
}
function exerciseRecords(exId) {
  const r = { rm: 0, rmSet: null, wt: 0, wtSet: null, vol: 0, volSet: null, sessions: 0, totalSets: 0 };
  for (const { e } of App.D.exHist[exId] || []) {
    const ws = workSets(e); if (!ws.length) continue; r.sessions++; r.totalSets += ws.length;
    for (const s of ws) {
      const rm = epley(s.weight_lb, s.reps), v = setVol(s);
      if (rm > r.rm) { r.rm = rm; r.rmSet = s; }
      if ((s.weight_lb || 0) > r.wt) { r.wt = s.weight_lb; r.wtSet = s; }
      if (v > r.vol) { r.vol = v; r.volSet = s; }
    }
  }
  return r;
}
function targetName(group_id, sub_group_id) {
  const D = App.D; const g = D.groupById[group_id]; const s = sub_group_id ? D.subById[sub_group_id] : null;
  return s ? `${g ? g.name : group_id} · ${s.name}` : (g ? g.name : group_id);
}
function exTags(ex) {
  return (ex.targets || []).map((t) => `<span class="tag ${t.is_primary === false ? 'sec' : ''}">${esc(targetName(t.group_id, t.sub_group_id))}</span>`).join('');
}
function exercisesForSlot(group_id, sub_group_id) {
  const D = App.D;
  const score = (ex) => {
    let s = 0;
    for (const t of ex.targets || []) {
      if (t.group_id !== group_id) continue;
      const pri = t.is_primary !== false ? 2 : 1;
      if (sub_group_id && t.sub_group_id === sub_group_id) s = Math.max(s, 10 + pri);
      else if (!sub_group_id || !t.sub_group_id) s = Math.max(s, 5 + pri);
      else s = Math.max(s, pri);
    }
    return s;
  };
  return D.exercises.filter((e) => !e.archived).map((e) => ({ e, s: score(e) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name));
}

/* ======================================================================
   Home — workout feed
   ====================================================================== */
function renderHome(root) {
  const D = App.D;
  const wk = weekKey(new Date());
  const thisWeek = D.workouts.filter((w) => weekKey(w.started_at) === wk);
  root.innerHTML = topbar('Home', { backBtn: false }) + `<div class="screen">
    <div class="stats">
      <div class="stat"><div class="v">${thisWeek.length}</div><div class="l">Workouts this week</div></div>
      <div class="stat"><div class="v">${fmtNum(sum(thisWeek, workoutVolume) / 1000, 1)}k</div><div class="l">lb this week</div></div>
      <div class="stat"><div class="v">${sum(thisWeek, workoutSets)}</div><div class="l">Sets this week</div></div>
    </div>
    ${App.aw ? `<div class="card tap" data-resume><div class="row between"><div><h3>Workout in progress</h3><div class="sub">${esc(App.aw.name)} · started ${fmtTime(App.aw.started_at)}</div></div><span class="pill good">Resume</span></div></div>` : ''}
    ${D.workouts.length ? D.workouts.map(workoutCard).join('') :
      `<div class="empty"><div class="big">🏋️</div><p>No workouts yet.</p><button class="btn primary" data-go="start">Start your first workout</button></div>`}
  </div>`;
  root.onclick = (e) => {
    const c = e.target.closest('[data-workout]'); if (c) return push({ type: 'workout', id: c.dataset.workout });
    if (e.target.closest('[data-resume]')) return push({ type: 'active' });
    const g = e.target.closest('[data-go]'); if (g) return showTab(g.dataset.go);
  };
}
function workoutCard(w) {
  const D = App.D, prs = D.workoutPRs[w.id] || 0;
  return `<div class="card tap" data-workout="${w.id}">
    <div class="row between"><h3 class="ellip grow">${esc(w.name)}</h3><span class="small muted">${esc(relDays(w.started_at))}</span></div>
    <div class="kpis"><div class="kpi"><div class="v">${fmtDur(workoutDuration(w))}</div><div class="l">Duration</div></div>
      <div class="kpi"><div class="v">${fmtNum(workoutVolume(w))} lb</div><div class="l">Volume</div></div>
      <div class="kpi"><div class="v">${workoutSets(w)}</div><div class="l">Sets</div></div>
      ${prs ? `<div class="kpi"><div class="v">🏅 ${prs}</div><div class="l">PRs</div></div>` : ''}</div>
    ${w.exercises.map((e) => { const ex = D.exById[e.exercise_id]; const b = bestSetOf(workSets(e)); return `<div class="row between small" style="padding:3px 0"><span class="ellip grow">${workSets(e).length} × ${esc(ex ? ex.name : 'Deleted exercise')}</span><span class="muted mono">${b ? setLabel(b) : ''}</span></div>`; }).join('')}
  </div>`;
}

/* ======================================================================
   Routines
   ====================================================================== */
const slotSummary = (r) => r.slots.map((s) => `${esc((s.sub_group_id && App.D.subById[s.sub_group_id]) ? App.D.subById[s.sub_group_id].name : (App.D.groupById[s.group_id] || {}).name || s.group_id)} ×${s.sets}`).join(' · ');
function renderRoutines(root) {
  const D = App.D, rs = D.routines.filter((r) => !r.archived);
  root.innerHTML = topbar('Routines', { backBtn: false, right: `<button class="link" data-new>+ New</button>` }) + `<div class="screen">
    ${rs.length ? rs.map((r) => `<div class="card tap" data-routine="${r.id}">
      <div class="row between"><h3 class="grow ellip">${esc(r.name)}</h3><button class="btn primary sm" data-start="${r.id}">Start</button></div>
      <div class="sub">${slotSummary(r) || 'No slots yet'}</div>
      ${r.notes ? `<div class="sub muted" style="margin-top:4px">${esc(r.notes)}</div>` : ''}
    </div>`).join('') : `<div class="empty"><div class="big">📋</div><p>No routines yet. A routine is a list of muscle targets with set counts — you pick the exact exercise when you train.</p><button class="btn primary" data-new>Create a routine</button></div>`}
  </div>`;
  root.onclick = (e) => {
    const st = e.target.closest('[data-start]'); if (st) { e.stopPropagation(); return startWorkout(D.routineById[st.dataset.start]); }
    if (e.target.closest('[data-new]')) return push({ type: 'routine-edit' });
    const c = e.target.closest('[data-routine]'); if (c) return push({ type: 'routine', id: c.dataset.routine });
  };
}
function renderRoutineDetail(root, view) {
  const D = App.D, r = D.routineById[view.id];
  if (!r) return back();
  const used = D.workouts.filter((w) => w.routine_id === r.id);
  root.innerHTML = topbar(r.name, { right: `<button class="link" data-edit>Edit</button>` }) + `<div class="screen">
    ${r.notes ? `<p class="t2">${esc(r.notes)}</p>` : ''}
    <button class="btn primary block" data-start>Start workout</button>
    <h3 style="margin:16px 0 8px">Slots</h3>
    <div class="list">${r.slots.map((s, i) => `<div class="item" style="cursor:default"><div class="avatar">${i + 1}</div><div class="grow"><div class="title">${esc(targetName(s.group_id, s.sub_group_id))}</div>${s.label ? `<div class="small muted">${esc(s.label)}</div>` : ''}</div><span class="pill">${s.sets} sets</span></div>`).join('') || '<div class="item muted">No slots</div>'}</div>
    ${used.length ? `<h3 style="margin:16px 0 8px">History (${used.length})</h3><div class="list">${used.slice(0, 10).map((w) => `<button class="item" data-workout="${w.id}"><div class="grow"><div class="title">${esc(fmtDate(w.started_at))}</div><div class="small muted">${workoutSets(w)} sets · ${fmtNum(workoutVolume(w))} lb</div></div><span class="chev">›</span></button>`).join('')}</div>` : ''}
    <button class="btn danger block" data-del style="margin-top:16px">Delete routine</button>
  </div>`;
  root.onclick = async (e) => {
    if (e.target.closest('[data-start]')) return startWorkout(r);
    if (e.target.closest('[data-edit]')) return push({ type: 'routine-edit', id: r.id });
    const w = e.target.closest('[data-workout]'); if (w) return push({ type: 'workout', id: w.dataset.workout });
    if (e.target.closest('[data-del]')) {
      if (!(await confirmDlg('Delete routine?', `"${r.name}" will be removed. Past workouts are kept.`))) return;
      await App.db.deleteRoutine(r.id); await reload(); toast('Routine deleted'); App.stack = []; render();
    }
  };
}
function renderRoutineEdit(root, view) {
  const D = App.D;
  const r = view.draft || (view.draft = view.id ? clone(D.routineById[view.id]) : { id: uuid(), name: '', notes: '', position: D.routines.length, archived: false, created_at: new Date().toISOString(), slots: [] });
  const groupOpts = (sel) => D.groups.map((g) => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const subOpts = (gid, sel) => `<option value="">Whole group</option>` + (D.groupById[gid] ? D.groupById[gid].subs : []).map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  root.innerHTML = topbar(view.id ? 'Edit routine' : 'New routine', { right: `<button class="link" id="r-save">Save</button>` }) + `<div class="screen">
    <div class="field"><label>Name</label><input class="input" id="r-name" value="${esc(r.name)}" placeholder="e.g. Back B: lat paths + traps"></div>
    <div class="field"><label>Notes (optional)</label><input class="input" id="r-notes" value="${esc(r.notes || '')}"></div>
    <h3 style="margin:6px 0 4px">Slots</h3><p class="small muted" style="margin:0 0 10px">Each slot is a muscle target plus a set count. You choose the exercise when you train.</p>
    ${r.slots.map((s, i) => `<div class="card" data-i="${i}">
      <div class="row between" style="margin-bottom:8px"><strong>Slot ${i + 1}</strong>
        <div class="row" style="gap:2px"><button class="iconbtn" data-mv="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="iconbtn" data-mv="1" ${i === r.slots.length - 1 ? 'disabled' : ''}>↓</button><button class="iconbtn" data-rm style="color:var(--danger)">✕</button></div></div>
      <div class="row"><div class="field grow"><label>Muscle group</label><select class="input" data-f="group_id">${groupOpts(s.group_id)}</select></div>
        <div class="field" style="width:84px"><label>Sets</label><input class="input" type="number" inputmode="numeric" min="1" max="20" data-f="sets" value="${s.sets}"></div></div>
      <div class="field"><label>Sub-group</label><select class="input" data-f="sub_group_id">${subOpts(s.group_id, s.sub_group_id)}</select></div>
      <div class="field" style="margin-bottom:0"><label>Hint (optional)</label><input class="input" data-f="label" value="${esc(s.label || '')}" placeholder="e.g. Paused shrug, lower fibers…"></div>
    </div>`).join('')}
    <button class="btn block" id="r-add">+ Add slot</button>
    <p class="small muted center" style="margin-top:14px">Slot targets are what the weekly muscle-distribution chart measures against.</p>
  </div>`;
  $('#r-name').oninput = (e) => (r.name = e.target.value);
  $('#r-notes').oninput = (e) => (r.notes = e.target.value);
  $('#r-add').onclick = () => { const last = r.slots[r.slots.length - 1]; r.slots.push({ id: uuid(), position: r.slots.length, group_id: last ? last.group_id : D.groups[0].id, sub_group_id: null, sets: 3, label: '' }); render(); };
  root.oninput = (e) => {
    const card = e.target.closest('[data-i]'); if (!card) return; const s = r.slots[+card.dataset.i], f = e.target.dataset.f; if (!f) return;
    if (f === 'sets') s.sets = Math.max(1, Math.min(20, parseInt(e.target.value) || 1)); else if (f === 'label') s.label = e.target.value;
  };
  root.onchange = (e) => {
    const card = e.target.closest('[data-i]'); if (!card) return; const s = r.slots[+card.dataset.i], f = e.target.dataset.f;
    if (f === 'group_id') { s.group_id = e.target.value; s.sub_group_id = null; render(); }
    else if (f === 'sub_group_id') s.sub_group_id = e.target.value || null;
  };
  root.onclick = (e) => {
    const card = e.target.closest('[data-i]'); if (!card) return; const i = +card.dataset.i;
    if (e.target.closest('[data-rm]')) { r.slots.splice(i, 1); render(); }
    const mv = e.target.closest('[data-mv]'); if (mv) { const j = i + +mv.dataset.mv; [r.slots[i], r.slots[j]] = [r.slots[j], r.slots[i]]; render(); }
  };
  $('#r-save').onclick = async () => {
    r.name = r.name.trim(); if (!r.name) return toast('Give the routine a name', true);
    if (!r.slots.length) return toast('Add at least one slot', true);
    r.slots.forEach((s, i) => (s.position = i));
    try {
      if (view.id) await App.db.updateRoutine(r); else await App.db.insertRoutine(r);
      await reload(); toast('Routine saved');
      App.stack.pop(); if (!view.id) App.stack.push({ type: 'routine', id: r.id }); render();
    } catch (err) { toast(err.message, true); }
  };
}

/* ======================================================================
   Exercises
   ====================================================================== */
function renderExercises(root) {
  const D = App.D, ui = App.ui;
  const q = ui.exFilter.toLowerCase();
  const list = D.exercises.filter((e) => !e.archived && (!q || e.name.toLowerCase().includes(q)) && (!ui.exGroup || (e.targets || []).some((t) => t.group_id === ui.exGroup)))
    .sort((a, b) => a.name.localeCompare(b.name));
  root.innerHTML = topbar('Exercises', { backBtn: false, right: `<button class="link" data-new>+ New</button>` }) + `<div class="screen">
    <div class="search"><input class="input" id="ex-q" placeholder="Search exercises" value="${esc(ui.exFilter)}" autocapitalize="off"></div>
    <div class="chips"><button class="chip ${!ui.exGroup ? 'on' : ''}" data-g="">All</button>${D.groups.map((g) => `<button class="chip ${ui.exGroup === g.id ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>
    <div class="list">${list.map((ex) => { const lp = lastPerf(ex.id); return `<button class="item" data-ex="${ex.id}"><div class="avatar">${esc(ex.name.slice(0, 2).toUpperCase())}</div>
      <div class="grow"><div class="title">${esc(ex.name)}</div><div class="xs">${exTags(ex)}</div></div>
      <div class="small muted" style="text-align:right;flex:none">${lp ? `${esc(relDays(lp.w.started_at))}<br>${esc(setLabel(bestSetOf(workSets(lp.e))))}` : ''}</div></button>`; }).join('') || '<div class="item muted">No exercises match</div>'}</div>
    <p class="small muted center">${list.length} exercises${D.exercises.some((e) => e.archived) ? ` · <button class="link small" data-archived>show archived</button>` : ''}</p>
  </div>`;
  $('#ex-q').oninput = (e) => { ui.exFilter = e.target.value; const pos = e.target.selectionStart; render(); const inp = $('#ex-q'); inp.focus(); inp.setSelectionRange(pos, pos); };
  root.onclick = (e) => {
    const g = e.target.closest('[data-g]'); if (g) { ui.exGroup = g.dataset.g; return render(); }
    if (e.target.closest('[data-new]')) return push({ type: 'exercise-edit' });
    const x = e.target.closest('[data-ex]'); if (x) return push({ type: 'exercise', id: x.dataset.ex });
    if (e.target.closest('[data-archived]')) return showArchived();
  };
}
function showArchived() {
  const D = App.D, list = D.exercises.filter((e) => e.archived);
  const s = sheet(`<div class="grab"></div><h2>Archived exercises</h2><div class="list">${list.map((e) => `<button class="item" data-un="${e.id}"><div class="grow"><div class="title">${esc(e.name)}</div></div><span class="pill accent">Restore</span></button>`).join('')}</div>`);
  s.onclick = async (e) => { const b = e.target.closest('[data-un]'); if (!b) return; const ex = D.exById[b.dataset.un]; ex.archived = false; await App.db.updateExercise(ex); await reload(); closeSheet(); render(); toast('Restored'); };
}
function renderExerciseEdit(root, view) {
  const D = App.D;
  const ex = view.draft || (view.draft = view.id ? clone(D.exById[view.id]) : { id: uuid(), name: view.name || '', notes: '', archived: false, created_at: new Date().toISOString(), targets: [] });
  const tget = (g, s) => ex.targets.find((t) => t.group_id === g && (t.sub_group_id || null) === (s || null));
  const tpRow = (g, s) => { const t = tget(g.id, s ? s.id : null); return `<div class="tp ${t ? 'on' : ''}" data-g="${g.id}" data-s="${s ? s.id : ''}">
      <span>${s ? esc(s.name) : `<em>Whole group</em>`}</span>
      <button class="pri ${t && t.is_primary !== false ? 'p' : ''}" data-pri ${t ? '' : 'style="visibility:hidden"'}>${t && t.is_primary === false ? 'Secondary' : 'Primary'}</button></div>`; };
  root.innerHTML = topbar(view.id ? 'Edit exercise' : 'New exercise', { right: `<button class="link" id="ex-save">Save</button>` }) + `<div class="screen">
    <div class="field"><label>Name</label><input class="input" id="ex-name" value="${esc(ex.name)}" placeholder="e.g. Neutral close-grip pulldown"></div>
    <div class="field"><label>Cue / notes (optional)</label><textarea class="input" id="ex-notes" placeholder="e.g. elbows flared 70–90°">${esc(ex.notes || '')}</textarea></div>
    <h3 style="margin:6px 0 4px">Muscle targets</h3><p class="small muted" style="margin:0 0 10px">Tap to toggle. Primary targets count a full set in weekly distribution; secondary count half.</p>
    ${D.groups.map((g) => `<details ${ex.targets.some((t) => t.group_id === g.id) ? 'open' : ''} style="margin-bottom:8px"><summary style="padding:8px 0;font-weight:600;cursor:pointer">${esc(g.name)} <span class="muted small">(${esc(g.region)})</span>${ex.targets.some((t) => t.group_id === g.id) ? ' <span class="pill accent">' + ex.targets.filter((t) => t.group_id === g.id).length + '</span>' : ''}</summary>
      <div class="targets-pick">${g.subs.map((s) => tpRow(g, s)).join('')}${tpRow(g, null)}</div></details>`).join('')}
    ${view.id ? `<button class="btn danger block" id="ex-del" style="margin-top:16px">${(D.exHist[ex.id] || []).length ? 'Archive exercise' : 'Delete exercise'}</button>` : ''}
  </div>`;
  $('#ex-name').oninput = (e) => (ex.name = e.target.value);
  $('#ex-notes').oninput = (e) => (ex.notes = e.target.value);
  root.onclick = (e) => {
    const row = e.target.closest('.tp'); if (!row) return;
    const g = row.dataset.g, s = row.dataset.s || null; const t = tget(g, s);
    if (e.target.closest('[data-pri]') && t) { t.is_primary = t.is_primary === false; }
    else if (t) ex.targets = ex.targets.filter((x) => x !== t);
    else ex.targets.push({ group_id: g, sub_group_id: s, is_primary: true });
    // Re-render just this group's rows to preserve <details> open state
    const open = $$('details', root).map((d) => d.open);
    render(); $$('details', $('#app')).forEach((d, i) => (d.open = open[i]));
  };
  $('#ex-save').onclick = async () => {
    ex.name = ex.name.trim(); if (!ex.name) return toast('Name the exercise', true);
    if (!ex.targets.length) return toast('Pick at least one muscle target', true);
    try {
      if (view.id) await App.db.updateExercise(ex); else await App.db.insertExercises([ex]);
      await reload(); toast('Saved');
      if (view.onSaved) { App.stack.pop(); view.onSaved(ex.id); } else { App.stack.pop(); if (!view.id) App.stack.push({ type: 'exercise', id: ex.id }); render(); }
    } catch (err) { toast(err.message, true); }
  };
  const del = $('#ex-del'); if (del) del.onclick = async () => {
    const used = (D.exHist[ex.id] || []).length;
    if (used) { if (!(await confirmDlg('Archive exercise?', 'It is used in past workouts, so it will be hidden rather than deleted. You can restore it later.', 'Archive'))) return; ex.archived = true; await App.db.updateExercise(ex); }
    else { if (!(await confirmDlg('Delete exercise?', 'This cannot be undone.'))) return; await App.db.deleteExercise(ex.id); }
    await reload(); App.stack = []; render(); toast(used ? 'Archived' : 'Deleted');
  };
}

/* ======================================================================
   Start tab
   ====================================================================== */
function renderStart(root) {
  const D = App.D, rs = D.routines.filter((r) => !r.archived);
  root.innerHTML = topbar('Start Workout', { backBtn: false }) + `<div class="screen">
    ${App.aw ? `<div class="card tap" data-resume><div class="row between"><div><h3>Resume workout</h3><div class="sub">${esc(App.aw.name)} · started ${fmtTime(App.aw.started_at)}</div></div><span class="pill good">▶</span></div></div>` : ''}
    <button class="btn block" data-empty>＋ Start an empty workout</button>
    <h3 style="margin:18px 0 8px">From a routine</h3>
    ${rs.map((r) => `<div class="card"><div class="row between"><div class="grow" style="min-width:0"><h3 class="ellip">${esc(r.name)}</h3><div class="sub">${slotSummary(r)}</div></div><button class="btn primary sm" data-start="${r.id}">Start</button></div></div>`).join('') || '<p class="muted">No routines yet.</p>'}
  </div>`;
  root.onclick = (e) => {
    if (e.target.closest('[data-resume]')) return push({ type: 'active' });
    if (e.target.closest('[data-empty]')) return startWorkout(null);
    const st = e.target.closest('[data-start]'); if (st) return startWorkout(D.routineById[st.dataset.start]);
  };
}
async function startWorkout(routine) {
  if (App.aw) { if (!(await confirmDlg('Workout in progress', 'Discard the current workout and start a new one?', 'Discard & start'))) return; }
  const now = new Date();
  App.aw = {
    id: uuid(), routine_id: routine ? routine.id : null,
    name: routine ? routine.name : `${now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'} workout`,
    started_at: now.toISOString(), notes: '',
    exercises: routine ? routine.slots.map((s) => ({ id: uuid(), exercise_id: null, routine_slot_id: s.id, slot_group_id: s.group_id, slot_sub_group_id: s.sub_group_id, slot_label: s.label, target_sets: s.sets, sets: [] })) : [],
  };
  saveActive(); App.rest = null; LS.del('wt_rest');
  App.stack = []; App.tab = 'start'; push({ type: 'active' });
}
function saveActive() { if (App.aw) LS.set('wt_active', App.aw); else LS.del('wt_active'); }

/* ======================================================================
   Workout logger (active workout + editing a past workout)
   ====================================================================== */
const newSet = (j) => ({ id: uuid(), position: j, weight_lb: null, reps: null, rpe: null, set_type: 'normal', done: false, completed_at: null });
function setTypeLabel(sets, j) {
  const s = sets[j]; if (s.set_type === 'warmup') return 'W'; if (s.set_type === 'drop') return 'D'; if (s.set_type === 'failure') return 'F';
  return String(sets.slice(0, j + 1).filter((x) => x.set_type === 'normal').length);
}
const typeCls = (s) => ({ warmup: 'w', drop: 'd', failure: 'f' }[s.set_type] || '');
const localDT = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function renderActive(root) { if (!App.aw) { App.stack = []; return render(); } renderLogger(root, App.aw, false); }
function renderWorkoutEdit(root, view) {
  const w = view.draft || (view.draft = clone(App.D.workouts.find((x) => x.id === view.id)));
  if (!w) return back();
  renderLogger(root, w, true);
}

function renderLogger(root, w, editing) {
  const D = App.D;
  const persist = () => { if (!editing) saveActive(); };
  root.innerHTML = `<div class="topbar"><button class="back" data-back aria-label="Back">‹</button>
    <div class="grow" style="min-width:0"><h1 class="ellip" data-rename style="font-size:18px;cursor:pointer">${esc(w.name)} <span class="muted" style="font-size:13px;font-weight:400">✎</span></h1>
      ${editing ? `<input type="datetime-local" class="input" id="w-start" style="min-height:32px;padding:4px 8px;font-size:13px;width:auto;margin-top:2px" value="${localDT(w.started_at)}">`
                : `<div class="wtimer small" id="wtimer">${fmtClock((Date.now() - new Date(w.started_at)) / 1000)}</div>`}</div>
    <button class="btn primary sm" data-finish>${editing ? 'Save' : 'Finish'}</button></div>
  <div class="screen">
    ${w.exercises.map((e, i) => (e.exercise_id && D.exById[e.exercise_id] ? wexCard(w, e, i) : slotCard(e, i))).join('')}
    <button class="btn block" data-addex>＋ Add exercise</button>
    <div class="field" style="margin-top:14px"><label>Workout notes</label><textarea class="input" id="w-notes" placeholder="How did it go?">${esc(w.notes || '')}</textarea></div>
    <button class="btn danger block" data-discard>${editing ? 'Delete workout' : 'Discard workout'}</button>
  </div>`;

  $('#w-notes').oninput = (e) => { w.notes = e.target.value; persist(); };
  const ws = $('#w-start'); if (ws) ws.onchange = (e) => { const d = new Date(e.target.value); if (!isNaN(d)) { const dur = w.ended_at ? new Date(w.ended_at) - new Date(w.started_at) : 0; w.started_at = d.toISOString(); w.ended_at = new Date(d.getTime() + Math.max(0, dur)).toISOString(); } };

  root.oninput = (e) => {
    const f = e.target.dataset.f, row = e.target.closest('[data-si]'), card = e.target.closest('[data-ei]');
    if (!f || !row || !card) return;
    const s = w.exercises[+card.dataset.ei].sets[+row.dataset.si];
    s[f] = num(e.target.value); persist();
  };
  root.onclick = async (e) => {
    const t = e.target;
    if (t.closest('[data-rename]')) { const v = await promptDlg('Workout name', w.name); if (v) { w.name = v; persist(); render(); } return; }
    if (t.closest('[data-finish]')) return finishWorkout(w, editing);
    if (t.closest('[data-discard]')) {
      if (editing) { if (!(await confirmDlg('Delete workout?', 'This removes the workout and all its sets.'))) return; await App.db.deleteWorkout(w.id); await reload(); App.stack = []; App.tab = 'home'; render(); return toast('Workout deleted'); }
      if (!(await confirmDlg('Discard workout?', 'Nothing from this session will be saved.', 'Discard'))) return;
      App.aw = null; saveActive(); App.rest = null; LS.del('wt_rest'); App.stack = []; App.tab = 'home'; render(); return;
    }
    if (t.closest('[data-addex]')) return pickExercise(w, -1, editing);
    const card = t.closest('[data-ei]'); if (!card) return;
    const i = +card.dataset.ei, ex = w.exercises[i];
    if (t.closest('[data-pick]')) return pickExercise(w, i, editing);
    if (t.closest('[data-rmex]')) { w.exercises.splice(i, 1); persist(); return render(); }
    if (t.closest('[data-exmenu]')) return exerciseMenu(w, i, editing);
    if (t.closest('[data-addset]')) { const last = ex.sets[ex.sets.length - 1]; const s = newSet(ex.sets.length); if (last) { s.weight_lb = last.weight_lb; s.reps = last.reps; } ex.sets.push(s); persist(); return render(); }
    if (t.closest('[data-rmset]')) { ex.sets.pop(); persist(); return render(); }
    const row = t.closest('[data-si]'); if (!row) return;
    const j = +row.dataset.si, s = ex.sets[j];
    if (t.closest('[data-type]')) {
      const order = ['normal', 'warmup', 'drop', 'failure']; s.set_type = order[(order.indexOf(s.set_type) + 1) % order.length]; persist(); return render();
    }
    if (t.closest('[data-done]')) {
      if (!s.done) {
        // Pull values from the row's inputs first (in case the input event has not fired), then fall back to previous performance.
        const get = (f) => num($(`[data-f="${f}"]`, row).value) ?? num($(`[data-f="${f}"]`, row).placeholder);
        s.weight_lb = get('weight_lb'); s.reps = get('reps'); s.rpe = num($('[data-f="rpe"]', row).value);
        if (s.reps == null || s.reps <= 0) return toast('Enter reps first', true);
        s.done = true; s.completed_at = new Date().toISOString();
        if (!editing) startRest();
      } else { s.done = false; s.completed_at = null; }
      persist(); return render();
    }
  };
}
function slotCard(e, i) {
  return `<div class="slot-empty" data-ei="${i}"><div class="row between"><div><div class="lbl">${esc(targetName(e.slot_group_id, e.slot_sub_group_id))}</div>
    <div class="small muted">${e.target_sets || 3} sets${e.slot_label ? ' · ' + esc(e.slot_label) : ''}</div></div><button class="iconbtn" data-rmex aria-label="Remove slot">✕</button></div>
    <button class="btn primary block sm" data-pick style="margin-top:10px">Pick exercise</button></div>`;
}
function wexCard(w, e, i) {
  const D = App.D, ex = D.exById[e.exercise_id];
  const lp = lastPerf(e.exercise_id, w.id); const prev = lp ? lp.e.sets.filter((s) => s.done) : [];
  const slotInfo = e.slot_group_id ? `${targetName(e.slot_group_id, e.slot_sub_group_id)}${e.target_sets ? ` · ${e.target_sets} sets` : ''}${e.slot_label ? ' · ' + e.slot_label : ''}` : '';
  return `<div class="wex" data-ei="${i}">
    <div class="head"><div class="grow" style="min-width:0"><div class="name ellip" data-exmenu style="cursor:pointer">${esc(ex.name)}</div>${slotInfo ? `<div class="target">${esc(slotInfo)}</div>` : ''}${lp ? `<div class="target muted">Last: ${esc(relDays(lp.w.started_at))}</div>` : ''}</div><button class="iconbtn" data-exmenu aria-label="Exercise options">⋯</button></div>
    ${ex.notes ? `<div class="cue">💡 ${esc(ex.notes)}</div>` : ''}
    <div class="sets-grid"><div class="hd">Set</div><div class="hd">Previous</div><div class="hd">lb</div><div class="hd">Reps</div><div class="hd">RPE</div><div class="hd">✓</div>
    ${e.sets.map((s, j) => { const p = prev[j]; return `<div class="setrow ${s.done ? 'done' : ''}" data-si="${j}">
      <button class="num ${typeCls(s)}" data-type title="Tap to change set type">${setTypeLabel(e.sets, j)}</button>
      <div class="prev">${p ? esc(setLabel(p)) : '—'}</div>
      <input class="in" type="number" inputmode="decimal" step="any" min="0" data-f="weight_lb" value="${s.weight_lb ?? ''}" placeholder="${p && p.weight_lb != null ? fmtW(p.weight_lb) : ''}" aria-label="Weight">
      <input class="in" type="number" inputmode="numeric" min="0" data-f="reps" value="${s.reps ?? ''}" placeholder="${p ? p.reps : ''}" aria-label="Reps">
      <input class="in" type="number" inputmode="decimal" step="0.5" min="1" max="10" data-f="rpe" value="${s.rpe ?? ''}" placeholder="${p && p.rpe ? p.rpe : ''}" aria-label="RPE">
      <button class="chk" data-done aria-label="Mark set done">✓</button></div>`; }).join('')}
    </div>
    <div class="foot"><button class="btn sm grow" data-addset>＋ Add set</button>${e.sets.length ? `<button class="btn sm ghost" data-rmset>−</button>` : ''}</div>
  </div>`;
}
function prevSummary(lp) {
  if (!lp) return '<span class="muted">Never</span>';
  const ws = lp.e.sets.filter((s) => s.done); const txt = ws.slice(0, 4).map((s) => (s.weight_lb ? `${fmtW(s.weight_lb)}×${s.reps}` : `${s.reps}`)).join(', ') + (ws.length > 4 ? '…' : '');
  return `${esc(relDays(lp.w.started_at))}<br><span class="mono">${esc(txt)}</span>`;
}
function pickExercise(w, i, editing) {
  const D = App.D, e = i >= 0 ? w.exercises[i] : null;
  let showAll = !(e && e.slot_group_id), q = '';
  const s = sheet(`<div class="grab"></div><h2>${e && e.slot_group_id ? esc(targetName(e.slot_group_id, e.slot_sub_group_id)) : e ? 'Swap exercise' : 'Add exercise'}</h2>
    ${e && e.slot_label ? `<p class="small t2" style="margin:-6px 0 10px">${esc(e.slot_label)}</p>` : ''}
    <div class="search"><input class="input" id="pk-q" placeholder="Search" autocapitalize="off"></div>
    ${e && e.slot_group_id ? `<div class="seg"><button class="${!showAll ? 'on' : ''}" data-all="0">Matching target</button><button class="${showAll ? 'on' : ''}" data-all="1">All exercises</button></div>` : ''}
    <div class="list" id="pk-list"></div><button class="btn block" data-create>＋ Create new exercise</button>`);
  const draw = () => {
    let list = showAll ? D.exercises.filter((x) => !x.archived).map((x) => ({ e: x })).sort((a, b) => a.e.name.localeCompare(b.e.name)) : exercisesForSlot(e.slot_group_id, e.slot_sub_group_id);
    if (q) list = list.filter((x) => x.e.name.toLowerCase().includes(q));
    $('#pk-list', s).innerHTML = list.map(({ e: ex }) => `<button class="item" data-pick="${ex.id}"><div class="grow" style="min-width:0"><div class="title">${esc(ex.name)}</div><div class="xs">${exTags(ex)}</div>${ex.notes ? `<div class="xs muted">${esc(ex.notes)}</div>` : ''}</div>
      <div class="xs" style="text-align:right;flex:none;max-width:40%">${prevSummary(lastPerf(ex.id, w.id))}</div></button>`).join('') || '<div class="item muted">No matches</div>';
  };
  draw();
  $('#pk-q', s).oninput = (ev) => { q = ev.target.value.toLowerCase(); draw(); };
  const assign = (exId) => {
    if (e) { e.exercise_id = exId; if (!e.sets.length) e.sets = Array.from({ length: e.target_sets || 3 }, (_, j) => newSet(j)); }
    else w.exercises.push({ id: uuid(), exercise_id: exId, routine_slot_id: null, slot_group_id: null, slot_sub_group_id: null, slot_label: null, target_sets: 3, sets: Array.from({ length: 3 }, (_, j) => newSet(j)) });
    if (!editing) saveActive(); closeSheet(); render();
  };
  s.onclick = (ev) => {
    const a = ev.target.closest('[data-all]'); if (a) { showAll = a.dataset.all === '1'; $$('.seg button', s).forEach((b) => b.classList.toggle('on', b === a)); return draw(); }
    const p = ev.target.closest('[data-pick]'); if (p) return assign(p.dataset.pick);
    if (ev.target.closest('[data-create]')) { closeSheet(); return push({ type: 'exercise-edit', name: q, onSaved: (id) => assign(id) }); }
  };
}
function exerciseMenu(w, i, editing) {
  const e = w.exercises[i], ex = App.D.exById[e.exercise_id];
  const s = sheet(`<div class="grab"></div><h2>${esc(ex.name)}</h2><div class="list">
    <button class="item" data-a="swap"><div class="grow"><div class="title">Swap exercise</div><div class="small muted">Keeps the sets you logged</div></div><span class="chev">›</span></button>
    <button class="item" data-a="stats"><div class="grow"><div class="title">History & stats</div></div><span class="chev">›</span></button>
    <button class="item" data-a="rm"><div class="grow"><div class="title" style="color:var(--danger)">Remove from workout</div></div></button></div>`);
  s.onclick = (ev) => {
    const b = ev.target.closest('[data-a]'); if (!b) return; closeSheet();
    if (b.dataset.a === 'swap') pickExercise(w, i, editing);
    else if (b.dataset.a === 'stats') push({ type: 'exercise', id: e.exercise_id });
    else { w.exercises.splice(i, 1); if (!editing) saveActive(); render(); }
  };
}
async function finishWorkout(w, editing) {
  const hasData = (s) => s.done || s.reps != null || s.weight_lb != null;
  const exs = w.exercises.filter((e) => e.exercise_id && e.sets.some(hasData));
  if (!editing && !exs.some((e) => e.sets.some((s) => s.done))) {
    if (!(await confirmDlg('No completed sets', 'Nothing was logged. Discard this workout?', 'Discard'))) return;
    App.aw = null; saveActive(); App.rest = null; LS.del('wt_rest'); App.stack = []; App.tab = 'home'; return render();
  }
  const out = {
    id: w.id, routine_id: w.routine_id || null, name: w.name.trim() || 'Workout', started_at: w.started_at,
    ended_at: editing ? (w.ended_at || w.started_at) : new Date().toISOString(), notes: (w.notes || '').trim() || null,
    exercises: exs.map((e, i) => ({
      id: e.id, exercise_id: e.exercise_id, routine_slot_id: e.routine_slot_id || null, slot_group_id: e.slot_group_id || null, slot_sub_group_id: e.slot_sub_group_id || null,
      slot_label: e.slot_label || null, position: i, notes: e.notes || null,
      sets: e.sets.filter(hasData).map((s, j) => ({ id: s.id, position: j, weight_lb: s.weight_lb ?? null, reps: s.reps ?? null, rpe: s.rpe ?? null, set_type: s.set_type || 'normal', done: !!s.done, completed_at: s.completed_at || null })),
    })),
  };
  const btn = $('[data-finish]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try { if (editing) await App.db.updateWorkout(out); else await App.db.insertWorkout(out); }
  catch (err) { if (btn) { btn.disabled = false; btn.textContent = editing ? 'Save' : 'Finish'; } return toast('Save failed: ' + err.message, true); }
  if (!editing) { App.aw = null; saveActive(); App.rest = null; LS.del('wt_rest'); }
  await reload();
  const prs = App.D.workoutPRs[out.id] || 0;
  App.stack = []; App.tab = 'home'; push({ type: 'workout', id: out.id });
  toast(editing ? 'Workout updated' : prs ? `Saved · ${prs} PR${prs > 1 ? 's' : ''} 🏅` : 'Workout saved');
}

/* ---------- rest timer & tickers ---------- */
function startRest(sec = App.D.settings.rest_seconds) {
  if (!sec || sec <= 0) return;
  App.rest = { endsAt: Date.now() + sec * 1000, total: sec, fired: false }; LS.set('wt_rest', App.rest); renderRestbar();
}
function renderRestbar() {
  const bar = $('#restbar');
  if (!App.rest || !App.aw) { bar.classList.add('hide'); return; }
  const left = Math.ceil((App.rest.endsAt - Date.now()) / 1000);
  if (left <= -20) { App.rest = null; LS.del('wt_rest'); bar.classList.add('hide'); return; }
  bar.classList.remove('hide'); bar.classList.toggle('over', left <= 0);
  bar.innerHTML = `<span class="small" style="opacity:.85">Rest</span><span class="t">${left > 0 ? fmtClock(left) : 'Go!'}</span>
    <button data-r="-15">−15</button><button data-r="15">+15</button><button data-r="skip">Skip</button>`;
}
$('#restbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-r]'); if (!b || !App.rest) return;
  if (b.dataset.r === 'skip') { App.rest = null; LS.del('wt_rest'); }
  else { App.rest.endsAt = Math.max(Date.now(), App.rest.endsAt) + parseInt(b.dataset.r) * 1000; App.rest.fired = false; LS.set('wt_rest', App.rest); }
  renderRestbar();
});
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((off) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(0.3, t + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.18); o.start(t + off); o.stop(t + off + 0.2); });
  } catch { /* ignore */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startTickers() {
  if (startTickers.on) return; startTickers.on = true;
  document.addEventListener('pointerdown', () => { if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ } }, { once: true });
  setInterval(() => {
    const t = $('#wtimer'); if (t && App.aw) t.textContent = fmtClock((Date.now() - new Date(App.aw.started_at)) / 1000);
    if (App.rest) { if (!App.rest.fired && Date.now() >= App.rest.endsAt) { App.rest.fired = true; LS.set('wt_rest', App.rest); beep(); } renderRestbar(); }
  }, 1000);
}

/* ======================================================================
   Workout detail
   ====================================================================== */
function renderWorkoutDetail(root, view) {
  const D = App.D, w = D.workouts.find((x) => x.id === view.id);
  if (!w) return back();
  const r = w.routine_id ? D.routineById[w.routine_id] : null, prs = D.workoutPRs[w.id] || 0;
  root.innerHTML = topbar(w.name, { right: `<button class="link" data-edit>Edit</button>` }) + `<div class="screen">
    <p class="t2 small" style="margin:0 0 10px">${esc(fmtDateLong(w.started_at))} · ${esc(fmtTime(w.started_at))}${r ? ` · <span class="pill">${esc(r.name)}</span>` : ''}</p>
    <div class="stats"><div class="stat"><div class="v">${fmtDur(workoutDuration(w))}</div><div class="l">Duration</div></div>
      <div class="stat"><div class="v">${fmtNum(workoutVolume(w))}</div><div class="l">lb volume</div></div>
      <div class="stat"><div class="v">${workoutSets(w)}${prs ? ` <span class="prbadge">${prs} PR</span>` : ''}</div><div class="l">Sets</div></div></div>
    ${w.notes ? `<div class="card"><div class="small t2">${esc(w.notes)}</div></div>` : ''}
    ${w.exercises.map((e) => { const ex = D.exById[e.exercise_id]; return `<div class="card">
      <div class="row between" style="margin-bottom:6px"><button class="link" data-ex="${e.exercise_id}" style="padding:0;min-height:0;text-align:left">${esc(ex ? ex.name : 'Deleted exercise')}</button>${e.slot_group_id ? `<span class="xs muted" style="text-align:right">${esc(targetName(e.slot_group_id, e.slot_sub_group_id))}</span>` : ''}</div>
      ${e.sets.map((s, j) => `<div class="history-set"><span class="idx">${setTypeLabel(e.sets, j)}</span><span class="mono">${esc(setLabel(s))}${s.rpe ? ` <span class="muted small">@ RPE ${s.rpe}</span>` : ''}${!s.done ? ' <span class="muted xs">(skipped)</span>' : ''}</span><span style="text-align:right">${(D.prMap[s.id] || []).map((t) => `<span class="prbadge">${t}</span>`).join('')}</span></div>`).join('')}
    </div>`; }).join('')}
    <button class="btn block" data-repeat>Repeat this workout</button>
    <button class="btn danger block" data-del style="margin-top:8px">Delete workout</button>
  </div>`;
  root.onclick = async (e) => {
    const x = e.target.closest('[data-ex]'); if (x) return push({ type: 'exercise', id: x.dataset.ex });
    if (e.target.closest('[data-edit]')) return push({ type: 'workout-edit', id: w.id });
    if (e.target.closest('[data-repeat]')) {
      if (App.aw && !(await confirmDlg('Workout in progress', 'Discard the current workout and start this one?', 'Discard & start'))) return;
      App.aw = { id: uuid(), routine_id: w.routine_id, name: w.name, started_at: new Date().toISOString(), notes: '',
        exercises: w.exercises.filter((e2) => D.exById[e2.exercise_id] && !D.exById[e2.exercise_id].archived).map((e2) => ({ id: uuid(), exercise_id: e2.exercise_id, routine_slot_id: e2.routine_slot_id, slot_group_id: e2.slot_group_id, slot_sub_group_id: e2.slot_sub_group_id, slot_label: e2.slot_label, target_sets: e2.sets.length, sets: e2.sets.map((s, j) => Object.assign(newSet(j), { set_type: s.set_type })) })) };
      saveActive(); App.stack = []; App.tab = 'start'; return push({ type: 'active' });
    }
    if (e.target.closest('[data-del]')) {
      if (!(await confirmDlg('Delete workout?', 'This removes the workout and all its sets.'))) return;
      await App.db.deleteWorkout(w.id); await reload(); App.stack = []; App.tab = 'home'; render(); toast('Workout deleted');
    }
  };
}

/* ======================================================================
   Charts (Chart.js) — thin marks, recessive grid, tooltips on
   ====================================================================== */
function mkChart(canvas, cfg) {
  Chart.defaults.color = cssVar('--text-2'); Chart.defaults.borderColor = cssVar('--border'); Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.font.size = 11;
  const c = new Chart(canvas, cfg); App.charts.push(c); return c;
}
const baseOpts = (fmt, yMax) => ({
  responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => fmt(c.parsed.y) } } },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
    y: { beginAtZero: true, suggestedMax: yMax, grid: { color: cssVar('--border') }, border: { display: false }, ticks: { maxTicksLimit: 5, precision: 0, callback: (v) => fmt(v, true) } },
  },
});
function barChart(canvas, labels, data, { color = '--s1', fmt = (v) => v } = {}) {
  return mkChart(canvas, { type: 'bar', data: { labels, datasets: [{ data, backgroundColor: cssVar(color), borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 26, categoryPercentage: 0.7 }] }, options: baseOpts(fmt) });
}
function lineChart(canvas, labels, data, { color = '--s1', fmt = (v) => v } = {}) {
  return mkChart(canvas, { type: 'line', data: { labels, datasets: [{ data, borderColor: cssVar(color), backgroundColor: cssVar(color), borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: cssVar('--surface'), pointBorderWidth: 2, tension: 0.3, spanGaps: true }] }, options: baseOpts(fmt) });
}
const kFmt = (v, axis) => (axis && v >= 1000 ? `${Math.round(v / 100) / 10}k` : fmtNum(v));

/* ---------- weekly aggregates ---------- */
function weekList(n) { const out = []; const start = startOfWeek(new Date()); for (let i = n - 1; i >= 0; i--) { const d = new Date(start); d.setDate(d.getDate() - 7 * i); out.push(d); } return out; }
const weekLabel = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function weeklySeries(n) {
  const weeks = weekList(n), byWeek = {};
  for (const w of App.D.workouts) { const k = weekKey(w.started_at); (byWeek[k] ||= []).push(w); }
  return weeks.map((d) => { const ws = byWeek[weekKey(d)] || []; return { d, label: weekLabel(d), count: ws.length, volume: sum(ws, workoutVolume), sets: sum(ws, workoutSets) }; });
}
// Sets per group / sub-group over the given week keys (primary target = 1, secondary = 0.5)
function groupSets(weekKeys) {
  const D = App.D, out = {};
  D.groups.forEach((g) => (out[g.id] = { total: 0, subs: {} }));
  for (const w of D.workouts) {
    if (!weekKeys.includes(weekKey(w.started_at))) continue;
    for (const e of w.exercises) {
      const ex = D.exById[e.exercise_id]; if (!ex) continue; const n = workSets(e).length; if (!n) continue;
      for (const t of ex.targets || []) {
        const g = out[t.group_id]; if (!g) continue; const wgt = t.is_primary === false ? 0.5 : 1;
        g.total += n * wgt; const k = t.sub_group_id || '_'; g.subs[k] = (g.subs[k] || 0) + n * wgt;
      }
    }
  }
  return out;
}
function groupTarget(gid) { const s = App.D.settings, o = (s.group_targets || {})[gid] || {}; return { min: o.min ?? s.target_min, max: o.max ?? s.target_max }; }

/* ======================================================================
   Profile / Stats
   ====================================================================== */
function renderProfile(root) {
  const D = App.D, ui = App.ui;
  const series = weeklySeries(ui.statsRange);
  const first = D.workouts[D.workouts.length - 1];
  const distWeeks = ui.distWeek === 'this' ? [weekKey(new Date())] : ui.distWeek === 'last' ? [weekKey(weekList(2)[0])] : weekList(4).map(weekKey);
  const dist = groupSets(distWeeks), div = ui.distWeek === 'avg4' ? 4 : 1;
  const prs = [];
  for (const w of D.workouts) for (const e of w.exercises) for (const s of e.sets) if (D.prMap[s.id]) prs.push({ w, e, s });
  const regionOrder = { upper: 0, lower: 1, either: 2 };
  const groups = [...D.groups].sort((a, b) => regionOrder[a.region] - regionOrder[b.region] || a.position - b.position);
  root.innerHTML = topbar('Profile', { backBtn: false, right: `<button class="iconbtn" data-settings aria-label="Settings">⚙︎</button>` }) + `<div class="screen">
    <div class="card"><div class="row"><div class="avatar" style="width:46px;height:46px;font-size:16px">${esc((App.user.email || 'U').slice(0, 1).toUpperCase())}</div>
      <div class="grow" style="min-width:0"><div class="ellip" style="font-weight:700">${esc(App.user.email || '')}</div><div class="small muted">${App.db.mode === 'local' ? 'Local mode · this device only' : 'Synced with Supabase'}${first ? ` · since ${esc(fmtDate(first.started_at))}` : ''}</div></div></div>
      <div class="kpis" style="margin-bottom:0"><div class="kpi"><div class="v">${D.workouts.length}</div><div class="l">Workouts</div></div><div class="kpi"><div class="v">${fmtNum(sum(D.workouts, workoutVolume) / 1000, 1)}k lb</div><div class="l">Total volume</div></div><div class="kpi"><div class="v">${Object.keys(D.prMap).length}</div><div class="l">PR sets</div></div></div></div>

    <div class="seg">${[8, 12, 26].map((n) => `<button class="${ui.statsRange === n ? 'on' : ''}" data-range="${n}">${n} weeks</button>`).join('')}</div>
    <div class="card"><div class="row between"><h3>Workouts per week</h3><span class="small muted">avg ${fmtNum(sum(series, (s) => s.count) / series.length, 1)}</span></div><div class="chart-box"><canvas id="c-count"></canvas></div></div>
    <div class="card"><div class="row between"><h3>Weekly volume</h3><span class="small muted">lb · avg ${kFmt(sum(series, (s) => s.volume) / series.length, true)}</span></div><div class="chart-box"><canvas id="c-vol"></canvas></div></div>
    <div class="card"><div class="row between"><h3>Weekly sets</h3><span class="small muted">working sets</span></div><div class="chart-box"><canvas id="c-sets"></canvas></div></div>

    <div class="card"><h3>Muscle distribution</h3><p class="small muted" style="margin:2px 0 10px">Working sets per muscle group. Shaded band = your weekly target range. Secondary targets count ½. Tap a group for sub-groups.</p>
      <div class="seg">${[['this', 'This week'], ['last', 'Last week'], ['avg4', '4-wk avg']].map(([k, l]) => `<button class="${ui.distWeek === k ? 'on' : ''}" data-dist="${k}">${l}</button>`).join('')}</div>
      <div class="dist">${groups.map((g) => {
        const v = dist[g.id].total / div, t = groupTarget(g.id), scale = Math.max(t.max * 1.35, v * 1.1, 1);
        const cls = v < t.min ? 'under' : v > t.max ? 'over' : '';
        const open = ui.distOpen[g.id];
        const subs = g.subs.map((s) => [s.name, (dist[g.id].subs[s.id] || 0) / div]).concat(dist[g.id].subs._ ? [['Whole group', dist[g.id].subs._ / div]] : []);
        return `<div class="drow" data-dg="${g.id}"><span class="name">${esc(g.name)}</span><div class="bar"><div class="band" style="left:${(t.min / scale) * 100}%;width:${((t.max - t.min) / scale) * 100}%"></div><div class="fill ${cls}" style="width:${(v / scale) * 100}%"></div></div><span class="n ${cls ? (cls === 'under' ? 'muted' : '') : ''}">${fmtNum(v, 1)}</span></div>
          ${open ? subs.map(([n, sv]) => `<div class="drow sub"><span class="name">${esc(n)}</span><div class="bar"><div class="fill" style="width:${(sv / scale) * 100}%;opacity:.6"></div></div><span class="n muted">${fmtNum(sv, 1)}</span></div>`).join('') : ''}`;
      }).join('')}</div>
      <div class="legend"><span><i style="background:var(--warn)"></i>below range</span><span><i style="background:var(--accent)"></i>in range</span><span><i style="background:var(--s2)"></i>above range</span></div></div>

    ${prs.length ? `<div class="card"><h3>Recent PRs</h3><div style="margin-top:6px">${prs.slice(0, 12).map(({ w, e, s }) => `<div class="row between small" style="padding:5px 0;border-bottom:1px solid var(--border)"><button class="link small" data-ex="${e.exercise_id}" style="padding:0;min-height:0;text-align:left">${esc((D.exById[e.exercise_id] || {}).name || '?')}</button><span class="mono">${esc(setLabel(s))}</span><span class="muted" style="flex:none">${D.prMap[s.id].map((t) => `<span class="prbadge">${t}</span>`).join('')} ${esc(relDays(w.started_at))}</span></div>`).join('')}</div></div>` : ''}
    <p class="xs muted center">Est. 1RM uses the Epley formula. Volume = weight × reps on completed working sets.</p>
  </div>`;
  const labels = series.map((s) => s.label);
  barChart($('#c-count'), labels, series.map((s) => s.count), { fmt: (v) => `${v} workout${v === 1 ? '' : 's'}` });
  barChart($('#c-vol'), labels, series.map((s) => Math.round(s.volume)), { color: '--s3', fmt: (v, a) => (a ? kFmt(v, true) : `${fmtNum(v)} lb`) });
  barChart($('#c-sets'), labels, series.map((s) => s.sets), { color: '--s7', fmt: (v) => `${v} sets` });
  root.onclick = (e) => {
    const r = e.target.closest('[data-range]'); if (r) { ui.statsRange = +r.dataset.range; return render(); }
    const d = e.target.closest('[data-dist]'); if (d) { ui.distWeek = d.dataset.dist; return render(); }
    const g = e.target.closest('[data-dg]'); if (g) { ui.distOpen[g.dataset.dg] = !ui.distOpen[g.dataset.dg]; return render(); }
    const x = e.target.closest('[data-ex]'); if (x) return push({ type: 'exercise', id: x.dataset.ex });
    if (e.target.closest('[data-settings]')) return push({ type: 'settings' });
  };
}

/* ---------- settings ---------- */
function renderSettings(root) {
  const D = App.D, s = clone(D.settings);
  const theme = LS.get('wt_theme', '');
  root.innerHTML = topbar('Settings', { right: `<button class="link" id="st-save">Save</button>` }) + `<div class="screen">
    <h3 style="margin:4px 0 8px">Training</h3>
    <div class="card">
      <div class="field"><label>Default rest timer (seconds, 0 = off)</label><input class="input" type="number" inputmode="numeric" id="st-rest" value="${s.rest_seconds}" min="0" step="5"></div>
      <div class="row"><div class="field grow"><label>Weekly sets per group — min</label><input class="input" type="number" inputmode="numeric" id="st-min" value="${s.target_min}" min="0"></div>
        <div class="field grow"><label>max</label><input class="input" type="number" inputmode="numeric" id="st-max" value="${s.target_max}" min="0"></div></div>
      <details><summary class="small t2" style="cursor:pointer;padding:4px 0">Per-group overrides (blank = default)</summary>
        ${D.groups.map((g) => { const o = (s.group_targets || {})[g.id] || {}; return `<div class="row" style="padding:4px 0"><span class="small grow">${esc(g.name)}</span><input class="input" type="number" inputmode="numeric" data-gt="${g.id}" data-k="min" value="${o.min ?? ''}" placeholder="${s.target_min}" style="width:70px;min-height:38px;padding:6px"><input class="input" type="number" inputmode="numeric" data-gt="${g.id}" data-k="max" value="${o.max ?? ''}" placeholder="${s.target_max}" style="width:70px;min-height:38px;padding:6px"></div>`; }).join('')}
      </details>
    </div>
    <h3 style="margin:14px 0 8px">Appearance</h3>
    <div class="seg">${[['', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div>
    <h3 style="margin:14px 0 8px">Account & data</h3>
    <div class="list">
      <div class="item" style="cursor:default"><div class="grow"><div class="title">${esc(App.user.email || '')}</div><div class="small muted">${App.db.mode === 'local' ? 'Local mode — data lives in this browser' : 'Supabase'}</div></div></div>
      <button class="item" data-export><div class="grow"><div class="title">Export all data (JSON)</div></div><span class="chev">›</span></button>
      ${App.db.mode === 'supabase' ? `<button class="item" data-signout><div class="grow"><div class="title">Sign out</div></div></button>` : ''}
      <button class="item" data-conn><div class="grow"><div class="title">Change connection</div><div class="small muted">Switch between Supabase and local mode</div></div></button>
    </div>
    <p class="xs muted center">Lift Log · units: lb</p>
  </div>`;
  $('#st-save').onclick = async () => {
    s.rest_seconds = Math.max(0, parseInt($('#st-rest').value) || 0);
    s.target_min = Math.max(0, parseInt($('#st-min').value) || 0); s.target_max = Math.max(s.target_min, parseInt($('#st-max').value) || 0);
    s.group_targets = {};
    $$('[data-gt]', root).forEach((inp) => { const v = parseInt(inp.value); if (Number.isFinite(v)) { (s.group_targets[inp.dataset.gt] ||= {})[inp.dataset.k] = v; } });
    try { await App.db.saveSettings(s); D.settings = s; toast('Settings saved'); back(); } catch (e) { toast(e.message, true); }
  };
  root.onclick = async (e) => {
    const t = e.target.closest('[data-theme]'); if (t) { const v = t.dataset.theme; if (v) LS.set('wt_theme', v); else LS.del('wt_theme'); applyTheme(); return render(); }
    if (e.target.closest('[data-export]')) return exportData();
    if (e.target.closest('[data-signout]')) { if (App.aw && !(await confirmDlg('Workout in progress', 'Signing out keeps the in-progress workout on this device.', 'Sign out', false))) return; await App.db.signOut(); return; }
    if (e.target.closest('[data-conn]')) { if (await confirmDlg('Change connection?', 'You will be returned to the setup screen. Synced data stays in Supabase; local-mode data stays in this browser.', 'Continue', false)) resetConfig(); }
  };
}
function applyTheme() { const t = LS.get('wt_theme', ''); if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
function exportData() {
  const D = App.D;
  const payload = { exported_at: new Date().toISOString(), units: 'lb', exercises: D.exercises, routines: D.routines, workouts: D.workouts, settings: D.settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `liftlog-export-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ======================================================================
   Exercise detail — progress, PRs, history
   ====================================================================== */
function renderExerciseDetail(root, view) {
  const D = App.D, ex = D.exById[view.id];
  if (!ex) return back();
  const hist = (D.exHist[ex.id] || []).filter((h) => workSets(h.e).length);
  const rec = exerciseRecords(ex.id);
  const sessions = [...hist].reverse().slice(-30); // oldest → newest
  root.innerHTML = topbar(ex.name, { right: `<button class="link" data-edit>Edit</button>` }) + `<div class="screen">
    <div class="xs" style="margin-bottom:6px">${exTags(ex)}</div>
    ${ex.notes ? `<div class="cue" style="font-size:13px;color:var(--text-2);background:var(--surface-2);border-radius:8px;padding:8px 10px;margin-bottom:12px">💡 ${esc(ex.notes)}</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="v">${rec.rm ? fmtNum(rec.rm) : '—'}</div><div class="l">Best est. 1RM (lb)</div></div>
      <div class="stat"><div class="v">${rec.wtSet ? fmtW(rec.wt) : '—'}</div><div class="l">Heaviest (lb)${rec.wtSet ? ` × ${rec.wtSet.reps}` : ''}</div></div>
      <div class="stat"><div class="v">${rec.volSet ? esc(setLabel(rec.volSet)) : '—'}</div><div class="l">Best set volume</div></div>
    </div>
    ${sessions.length ? `
    <div class="card"><div class="row between"><h3>Est. 1RM</h3><span class="small muted">best set per session</span></div><div class="chart-box"><canvas id="e-rm"></canvas></div></div>
    <div class="card"><div class="row between"><h3>Heaviest weight</h3><span class="small muted">lb</span></div><div class="chart-box"><canvas id="e-wt"></canvas></div></div>
    <div class="card"><div class="row between"><h3>Session volume</h3><span class="small muted">lb · ${rec.sessions} sessions, ${rec.totalSets} sets</span></div><div class="chart-box"><canvas id="e-vol"></canvas></div></div>
    <h3 style="margin:14px 0 8px">History</h3>
    ${hist.map(({ w, e }) => `<div class="card tap" data-workout="${w.id}"><div class="row between"><strong class="small">${esc(fmtDate(w.started_at))}</strong><span class="xs muted">${esc(w.name)}</span></div>
      ${e.sets.map((s, j) => `<div class="history-set"><span class="idx">${setTypeLabel(e.sets, j)}</span><span class="mono">${esc(setLabel(s))}${s.rpe ? ` <span class="muted small">@ ${s.rpe}</span>` : ''}${!s.done ? ' <span class="muted xs">(skipped)</span>' : ''}</span><span style="text-align:right">${(D.prMap[s.id] || []).map((t) => `<span class="prbadge">${t}</span>`).join('')}</span></div>`).join('')}</div>`).join('')}`
    : `<div class="empty"><div class="big">📈</div><p>No sessions logged yet. Progress charts appear after your first workout with this exercise.</p></div>`}
  </div>`;
  if (sessions.length) {
    const labels = sessions.map((h) => fmtDate(h.w.started_at));
    lineChart($('#e-rm'), labels, sessions.map((h) => Math.round(Math.max(...workSets(h.e).map((s) => epley(s.weight_lb, s.reps))))), { fmt: (v) => `${fmtNum(v)} lb` });
    lineChart($('#e-wt'), labels, sessions.map((h) => Math.max(...workSets(h.e).map((s) => s.weight_lb || 0))), { color: '--s2', fmt: (v) => `${fmtNum(v, 1)} lb` });
    barChart($('#e-vol'), labels, sessions.map((h) => Math.round(sum(workSets(h.e), setVol))), { color: '--s3', fmt: (v, a) => (a ? kFmt(v, true) : `${fmtNum(v)} lb`) });
  }
  root.onclick = (e) => {
    if (e.target.closest('[data-edit]')) return push({ type: 'exercise-edit', id: ex.id });
    const w = e.target.closest('[data-workout]'); if (w) return push({ type: 'workout', id: w.dataset.workout });
  };
}

/* ======================================================================
   Go
   ====================================================================== */
applyTheme();
boot();
