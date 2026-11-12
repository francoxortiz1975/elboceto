/* ===== Engine: pure functions, no DOM ===== */
const DEMO_TODAY = '2026-11-12';   // Thursday
const DEMO_NOW = 600;              // 10:00
const SLOT = 30;
const DAYN = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAYFULL = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const EFFORT = { deep: { label: 'Profundo', need: 0.9 }, light: { label: 'Ligero', need: 0.6 }, admin: { label: 'Administrativo', need: 0.4 } };

const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isoAdd = (iso, n) => { const [y, mo, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, mo - 1, d + n)); return dt.toISOString().slice(0, 10); };
const dowOf = (iso) => { const [y, mo, d] = iso.split('-').map(Number); return (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7; }; // Monday = 0
const diffDays = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => (i === 1 ? +x - 1 : +x))) - Date.UTC(...a.split('-').map((x, i) => (i === 1 ? +x - 1 : +x)))) / 864e5);
const dayLabel = (iso) => { const d = +iso.slice(8); return `${DAYFULL[dowOf(iso)]} ${d}`; };

// Weights: stage A decides who picks first, stage B decides where it lands.
const WEIGHTS = [
  { id: 'wPriority', stage: 'A', label: 'Prioridad de la tarea', hint: '1–5 que le pones a cada tarea.', def: 70 },
  { id: 'wArea', stage: 'A', label: 'Lugar del área en la pila', hint: 'La posición del área en tu orden de prioridad.', def: 50 },
  { id: 'wDeadline', stage: 'A', label: 'Cercanía de la fecha límite', hint: 'Más peso cuanto menos días queden. Las duras pesan más.', def: 60 },
  { id: 'wOverdue', stage: 'A', label: 'Atraso acumulado', hint: 'Lo que lleva días sin hacerse sube en la cola.', def: 40 },
  { id: 'wMove', stage: 'B', label: 'Cercanía al día original', hint: 'Penaliza alejar la tarea de donde estaba.', def: 60 },
  { id: 'wEnergy', stage: 'B', label: 'Energía acorde al esfuerzo', hint: 'Lo profundo a tus horas fuertes, lo administrativo a las flojas.', def: 50 },
  { id: 'wSoon', stage: 'B', label: 'Lo antes posible', hint: 'Prefiere huecos tempranos de la semana.', def: 30 },
  { id: 'wSlack', stage: 'B', label: 'Holgura antes del límite', hint: 'Evita dejarlo justo el día antes de la fecha límite.', def: 50 },
  { id: 'wDeepCap', stage: 'B', label: 'Tope de trabajo profundo al día', hint: 'Penaliza pasar del máximo de horas profundas del perfil.', def: 70 },
  { id: 'wBalance', stage: 'B', label: 'Reparto entre áreas', hint: 'Evita llenar un día con una sola área.', def: 20 }
];
const PLANNED = [
  ['Tareas divisibles', 'Partir una tarea larga en bloques de tamaño mínimo.'],
  ['Dependencias', 'Una tarea que no puede empezar hasta que termine otra.'],
  ['Duración aprendida', 'Corrige tus estimaciones con lo que de verdad tardas por tipo de tarea.'],
  ['Éxito por franja (historial)', 'Probabilidad de que cumplas algo según día y hora, aprendida de tus datos.'],
  ['Traslados encadenados', 'Agrupar tareas del mismo lugar para no ir y volver.'],
  ['Cuota semanal por área', 'Horas mínimas que cada área debe recibir cada semana.']
];

function defaultState() {
  return {
    profile: {
      wake: '07:30', bed: '23:30',
      meals: [
        { name: 'Desayuno', start: '08:00', dur: 20, on: true },
        { name: 'Almuerzo', start: '13:00', dur: 60, on: true },
        { name: 'Cena', start: '20:30', dur: 45, on: true }
      ],
      window: { from: '08:00', to: '22:00' },
      open: [true, true, true, true, true, true, false], // lun..dom: domingo protegido
      energy: { am: 4, pm: 3, ev: 2 },
      deepCap: 5, buffer: 10, bufferFixed: 15,
      places: { Casa: 0, Campus: 35, Trabajo: 25, Cualquiera: 0 }
    },
    fixed: [
      { id: 'f1', name: 'Systèmes distribués (clase)', days: [1], from: '08:30', to: '12:30', place: 'Campus', area: 'School', optional: false },
      { id: 'f2', name: 'TP / laboratorio', days: [3], from: '14:00', to: '18:00', place: 'Campus', area: 'School', optional: false },
      { id: 'f3', name: 'Turno de trabajo', days: [0, 2], from: '09:00', to: '13:00', place: 'Trabajo', area: 'Work', optional: true }
    ],
    areas: ['Loginet', 'School', 'MediLyft', 'Sumay Reels', 'Life', 'Campus France'],
    tasks: [
      { id: 't1', title: 'Factura MediLyft', area: 'MediLyft', prio: 5, fixed: false, orig: '2026-11-09', dl: '2026-11-14', dlHard: true, dur: 30, effort: 'admin', place: 'Casa', notBefore: '' },
      { id: 't2', title: 'TP1 ML pt.2', area: 'School', prio: 4, fixed: false, orig: '2026-11-02', dl: '2026-11-16', dlHard: true, dur: 120, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't3', title: 'Trabajar Loginet', area: 'Loginet', prio: 4, fixed: false, orig: '2026-11-09', dl: '', dlHard: false, dur: 90, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't4', title: 'S5 · Blog funcional', area: 'Loginet', prio: 5, fixed: false, orig: '2026-11-10', dl: '2026-11-20', dlHard: false, dur: 180, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't5', title: 'S4 · Conexión de dominio', area: 'Loginet', prio: 4, fixed: false, orig: '2026-11-10', dl: '', dlHard: false, dur: 120, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't6', title: 'Reunión Grokbot', area: 'MediLyft', prio: 3, fixed: false, orig: '2026-11-09', dl: '', dlHard: false, dur: 60, effort: 'light', place: 'Cualquiera', notBefore: '' },
      { id: 't7', title: 'Plataforma de vídeo', area: 'MediLyft', prio: 2, fixed: false, orig: '2026-11-10', dl: '', dlHard: false, dur: 60, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't8', title: 'Film + edit Reel 1', area: 'Sumay Reels', prio: 4, fixed: false, orig: '2026-11-12', dl: '2026-11-16', dlHard: true, dur: 90, effort: 'light', place: 'Casa', notBefore: '' },
      { id: 't9', title: 'Firmar stage professionnel', area: 'School', prio: 5, fixed: false, orig: '2026-11-12', dl: '2026-11-27', dlHard: true, dur: 20, effort: 'admin', place: 'Campus', notBefore: '' },
      { id: 't10', title: 'Derecho pt.1', area: 'School', prio: 2, fixed: false, orig: '2026-11-12', dl: '', dlHard: false, dur: 90, effort: 'deep', place: 'Casa', notBefore: '' },
      { id: 't11', title: 'Cambiar número', area: 'Life', prio: 2, fixed: false, orig: '2026-11-12', dl: '', dlHard: false, dur: 20, effort: 'admin', place: 'Cualquiera', notBefore: '' },
      { id: 't12', title: 'Publicar Reel 1', area: 'Sumay Reels', prio: 5, fixed: true, orig: '2026-11-17', at: '19:00', dl: '', dlHard: false, dur: 30, effort: 'light', place: 'Casa', notBefore: '' }
    ],
    weights: Object.fromEntries(WEIGHTS.map((w) => [w.id, w.def]))
  };
}

// The week as a grid of 30-minute slots with the reason each one is blocked (or null if free).
function buildGrid(S) {
  const P = S.profile;
  const wake = toMin(P.wake); const bed = toMin(P.bed);
  const n = Math.max(1, Math.floor((bed - wake) / SLOT));
  const days = Array.from({ length: 7 }, (_, i) => isoAdd(DEMO_TODAY, i));
  const blocked = days.map(() => Array(n).fill(null));
  const slotsOf = (from, to) => { // slots overlapping [from, to)
    const out = [];
    for (let k = 0; k < n; k++) { const a = wake + k * SLOT; if (a < to && a + SLOT > from) out.push(k); }
    return out;
  };
  const mark = (d, from, to, why) => slotsOf(from, to).forEach((k) => { if (!blocked[d][k]) blocked[d][k] = why; });
  const win = [toMin(P.window.from), toMin(P.window.to)];
  days.forEach((iso, d) => {
    const dow = dowOf(iso);
    if (d === 0) mark(d, wake, DEMO_NOW, 'pasado');
    if (!P.open[dow]) { mark(d, wake, bed, 'descanso'); return; }
    mark(d, wake, win[0], 'fuera de horario'); mark(d, win[1], bed, 'fuera de horario');
    P.meals.filter((m) => m.on).forEach((m) => mark(d, toMin(m.start), toMin(m.start) + m.dur, 'comida'));
    const commute = (place) => (P.places[place] || 0);
    S.fixed.filter((f) => f.days.includes(dow)).forEach((f) => {
      const a = toMin(f.from); const b = toMin(f.to); const c = commute(f.place);
      mark(d, a - c, a, 'traslado'); mark(d, b, b + c, 'traslado'); mark(d, b + c, b + c + P.bufferFixed, 'colchón');
      mark(d, a, b, `fijo:${f.name}`);
    });
    S.tasks.filter((t) => t.fixed && t.orig === iso && t.at).forEach((t) => mark(d, toMin(t.at), toMin(t.at) + t.dur, `fijo:${t.title}`));
  });
  return { days, blocked, n, wake };
}

const energyAt = (P, minute) => (minute < 13 * 60 ? P.energy.am : minute < 19 * 60 ? P.energy.pm : P.energy.ev) / 5;

function areaScore(S, area) {
  const i = S.areas.indexOf(area);
  if (i < 0) return 0;
  return S.areas.length > 1 ? 1 - i / (S.areas.length - 1) : 1;
}

// Stage A: who gets to pick first.
function urgency(S, t) {
  const W = S.weights; const parts = [];
  const add = (id, label, v, w) => parts.push({ id, label, value: v, weight: w, contrib: v * w });
  add('wPriority', 'Prioridad', (t.prio - 1) / 4, W.wPriority);
  add('wArea', 'Área', areaScore(S, t.area), W.wArea);
  const toDl = t.dl ? diffDays(DEMO_TODAY, t.dl) : null;
  add('wDeadline', 'Fecha límite', toDl === null ? 0 : (1 / (1 + Math.max(0, toDl))) * (t.dlHard ? 1 : 0.6), W.wDeadline);
  add('wOverdue', 'Atraso', Math.min(1, Math.max(0, diffDays(t.orig, DEMO_TODAY)) / 7), W.wOverdue);
  return { total: parts.reduce((s, p) => s + p.contrib, 0), parts };
}

// Stage B: score of putting task `t` at slot k0 of day d.
function scoreSlot(S, G, ctx, t, d, k0, need) {
  const W = S.weights; const P = S.profile; const parts = [];
  const add = (id, label, v) => parts.push({ id, label, value: v, weight: W[id], contrib: v * W[id] });
  const iso = G.days[d]; const start = G.wake + k0 * SLOT;
  add('wMove', 'Distancia al día original', -Math.min(Math.max(0, diffDays(t.orig, iso)), 7) / 7);
  add('wEnergy', 'Energía', 1 - Math.abs(EFFORT[t.effort].need - energyAt(P, start)));
  add('wSoon', 'Lo antes posible', 1 - (d * G.n + k0) / (7 * G.n));
  if (t.dl) {
    const slack = diffDays(iso, t.dl);
    add('wSlack', 'Holgura', slack < 0 ? -1 : -(1 - Math.min(slack, 5) / 5));
  } else add('wSlack', 'Holgura', 0);
  const deepMin = ctx.deep[d] + (t.effort === 'deep' ? t.effDur : 0);
  add('wDeepCap', 'Tope profundo', t.effort === 'deep' && deepMin > P.deepCap * 60 ? -1 : 0);
  add('wBalance', 'Reparto de áreas', -Math.min(1, (ctx.areaDay[d][t.area] || 0) / 3));
  return { total: parts.reduce((s, p) => s + p.contrib, 0), parts, d, k0, start };
}

function runEngine(S) {
  const G = buildGrid(S);
  const P = S.profile;
  const used = G.days.map(() => Array(G.n).fill(null));
  const ctx = { deep: G.days.map(() => 0), areaDay: G.days.map(() => ({})) };
  const placed = []; const unplaced = []; const keptFixed = [];
  const bufSlots = Math.ceil(P.buffer / SLOT);

  S.tasks.filter((t) => t.fixed).forEach((t) => {
    const d = G.days.indexOf(t.orig);
    if (d >= 0) keptFixed.push({ task: t, d, start: toMin(t.at || '00:00'), end: toMin(t.at || '00:00') + t.dur });
  });

  const order = S.tasks.filter((t) => !t.fixed && !t.done).map((t) => ({ t, u: urgency(S, t) }))
    .sort((a, b) => b.u.total - a.u.total || a.t.id.localeCompare(b.t.id));

  order.forEach(({ t, u }, rank) => {
    const commute = t.place && !['Casa', 'Cualquiera'].includes(t.place) ? (P.places[t.place] || 0) : 0;
    const task = { ...t, effDur: t.dur + commute };
    const need = Math.max(1, Math.ceil(task.effDur / SLOT));
    const cands = [];
    for (let d = 0; d < 7; d++) {
      if (t.notBefore && G.days[d] < t.notBefore) continue;
      if (t.dl && t.dlHard && G.days[d] > t.dl) continue;
      for (let k0 = 0; k0 + need <= G.n; k0++) {
        let ok = true;
        for (let k = k0; k < k0 + need; k++) if (G.blocked[d][k] || used[d][k]) { ok = false; break; }
        if (ok) cands.push(scoreSlot(S, G, ctx, task, d, k0, need));
      }
    }
    if (!cands.length) {
      const why = t.dl && t.dlHard ? 'No hay hueco antes de la fecha límite (dura).' : 'No cabe en los próximos 7 días.';
      unplaced.push({ task, rank, urgency: u, reason: why });
      return;
    }
    cands.sort((a, b) => b.total - a.total || a.d - b.d || a.k0 - b.k0);
    const best = cands[0];
    for (let k = best.k0; k < best.k0 + need; k++) used[best.d][k] = t.id;
    for (let k = best.k0 + need; k < best.k0 + need + bufSlots && k < G.n; k++) if (!G.blocked[best.d][k] && !used[best.d][k]) used[best.d][k] = 'buf';
    if (t.effort === 'deep') ctx.deep[best.d] += task.effDur;
    ctx.areaDay[best.d][t.area] = (ctx.areaDay[best.d][t.area] || 0) + 1;
    // alternatives: best candidates on other days / at least 2 h apart
    const alts = [];
    for (const c of cands.slice(1)) {
      if (alts.length >= 3) break;
      if (c.d === best.d && Math.abs(c.k0 - best.k0) < 4) continue;
      if (alts.some((a) => a.d === c.d && Math.abs(a.k0 - c.k0) < 4)) continue;
      alts.push(c);
    }
    placed.push({ task, rank, urgency: u, choice: best, alts, need, candidates: cands.length, commute });
  });
  return { G, used, placed, unplaced, keptFixed };
}

const slotLabel = (G, c) => `${dayLabel(G.days[c.d])} ${fmt(c.start)}`;
const placedSignature = (res) => Object.fromEntries([
  ...res.placed.map((p) => [p.task.id, slotLabel(res.G, p.choice)]),
  ...res.unplaced.map((p) => [p.task.id, 'no cabe'])
]);
const freeHours = (G) => { let c = 0; G.blocked.forEach((col) => col.forEach((b) => { if (!b) c++; })); return c * SLOT / 60; };

if (typeof module !== 'undefined') module.exports = { defaultState, runEngine, buildGrid, placedSignature, slotLabel, freeHours, WEIGHTS, urgency };
