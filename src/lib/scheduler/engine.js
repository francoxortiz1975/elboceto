// Scheduling engine (pure functions, no screen). Prototype: docs/scheduler-prototype/, notes: docs/SCHEDULER_ARCHITECTURE.md
//   1. hard rules  -> grid of free 30-minute slots (sleep, meals, fixed events, commute, buffers, protected days)
//   2. stage A     -> who picks first (priority, area rank, deadline closeness, delay)
//   3. stage B     -> where each task lands (distance, energy, earliest, slack, deep-work cap, balance)
//   4. output      -> placements with the score of every factor and the alternatives left out

import { addDays, daysBetween, fromIso } from '../areaPlan';

export const SLOT = 30;
export const HORIZON = 7;
export const EFFORT = {
  deep: { label: 'Profundo', need: 0.9 },
  light: { label: 'Ligero', need: 0.6 },
  admin: { label: 'Administrativo', need: 0.4 }
};

// Stage A decides who picks first, stage B where it lands.
export const WEIGHTS = [
  { id: 'wPriority', stage: 'A', label: 'Prioridad de la tarea', hint: 'El 1–5 que le pones a cada tarea.', def: 70 },
  { id: 'wArea', stage: 'A', label: 'Lugar del área en la pila', hint: 'La posición del área en tu orden de prioridad.', def: 50 },
  { id: 'wDeadline', stage: 'A', label: 'Cercanía de la fecha límite', hint: 'Más peso cuanto menos días quedan. Las duras pesan más.', def: 60 },
  { id: 'wOverdue', stage: 'A', label: 'Atraso acumulado', hint: 'Lo que lleva días sin hacerse sube en la cola.', def: 40 },
  { id: 'wMove', stage: 'B', label: 'Cercanía al día original', hint: 'Penaliza alejar la tarea de donde estaba.', def: 60 },
  { id: 'wEnergy', stage: 'B', label: 'Energía acorde al esfuerzo', hint: 'Lo profundo a tus horas fuertes, lo administrativo a las flojas.', def: 50 },
  { id: 'wSoon', stage: 'B', label: 'Lo antes posible', hint: 'Prefiere huecos tempranos de la semana.', def: 30 },
  { id: 'wSlack', stage: 'B', label: 'Holgura antes del límite', hint: 'Evita dejarlo justo el día antes de la fecha límite.', def: 50 },
  { id: 'wDeepCap', stage: 'B', label: 'Tope de trabajo profundo al día', hint: 'Penaliza pasar del máximo de horas profundas del perfil.', def: 70 },
  { id: 'wBalance', stage: 'B', label: 'Reparto entre áreas', hint: 'Evita llenar un día con una sola área.', def: 20 }
];
export const PLANNED = [
  ['Tareas divisibles', 'Partir una tarea larga en bloques de tamaño mínimo.'],
  ['Dependencias', 'Una tarea que no puede empezar hasta que termine otra.'],
  ['Duración aprendida', 'Corrige tus estimaciones con lo que de verdad tardas por tipo de tarea.'],
  ['Éxito por franja (historial)', 'Probabilidad de que cumplas algo según día y hora, aprendida de tus datos.'],
  ['Traslados encadenados', 'Agrupar tareas del mismo lugar para no ir y volver.'],
  ['Cuota semanal por área', 'Horas mínimas que cada área debe recibir cada semana.']
];

export const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
export const fmtMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dowOf = (iso) => (fromIso(iso).getDay() + 6) % 7; // Monday = 0
const mondayOf = (iso) => addDays(iso, -dowOf(iso));

// Is a recurring fixed event happening on this date? Handles weekdays, a date range, skipped dates
// and rotating weeks (cycle of N weeks; `weeks` lists the cycle weeks in which it happens).
export function activeOn(f, iso) {
  if (!f.days || !f.days.includes(dowOf(iso))) return false;
  if (f.start && iso < f.start) return false;
  if (f.end && iso > f.end) return false;
  if ((f.skip || []).includes(iso)) return false;
  const cycle = f.cycle || 1;
  if (cycle > 1) {
    const anchor = f.anchor || iso;
    const wk = Math.floor(daysBetween(mondayOf(anchor), mondayOf(iso)) / 7);
    const idx = ((wk % cycle) + cycle) % cycle;
    if (!(f.weeks || [0]).includes(idx)) return false;
  }
  return true;
}
// Which week of its cycle a date falls in (0-based), for showing "now: week 2 of 2".
export const cycleWeek = (f, iso) => {
  const cycle = f.cycle || 1;
  const wk = Math.floor(daysBetween(mondayOf(f.anchor || iso), mondayOf(iso)) / 7);
  return ((wk % cycle) + cycle) % cycle;
};

const placeMin = (cfg, name) => { const p = (cfg.profile.places || []).find((x) => x.name === name); return p ? p.min : 0; };

// The week as a grid of 30-minute slots, each with the reason it is blocked (or null when free).
// `blocks` are fixed things already in the calendar: [{ day, from, to, name, area, place? }].
export function buildGrid(cfg, today, nowMin, blocks = []) {
  const P = cfg.profile;
  const wake = toMin(P.wake); const bed = toMin(P.bed);
  const n = Math.max(1, Math.floor((bed - wake) / SLOT));
  const days = Array.from({ length: HORIZON }, (_, i) => addDays(today, i));
  const blocked = days.map(() => Array(n).fill(null));
  const slotsOf = (from, to) => {
    const out = [];
    for (let k = 0; k < n; k++) { const a = wake + k * SLOT; if (a < to && a + SLOT > from) out.push(k); }
    return out;
  };
  const mark = (d, from, to, why) => slotsOf(from, to).forEach((k) => { if (!blocked[d][k]) blocked[d][k] = why; });
  const win = [toMin(P.window.from), toMin(P.window.to)];
  days.forEach((iso, d) => {
    const dow = dowOf(iso);
    if (d === 0) mark(d, wake, nowMin, 'pasado');
    if (!P.open[dow]) { mark(d, wake, bed, 'descanso'); return; }
    mark(d, wake, win[0], 'fuera de horario'); mark(d, win[1], bed, 'fuera de horario');
    P.meals.filter((m) => m.on).forEach((m) => mark(d, toMin(m.start), toMin(m.start) + m.dur, 'comida'));
    const around = (a, b, c, buf) => { mark(d, a - c, a, 'traslado'); mark(d, b, b + c, 'traslado'); mark(d, b + c, b + c + buf, 'colchón'); };
    (cfg.fixed || []).filter((f) => activeOn(f, iso)).forEach((f) => {
      const a = toMin(f.from); const b = toMin(f.to);
      around(a, b, placeMin(cfg, f.place), P.bufferFixed);
      mark(d, a, b, `fijo:${f.name}`);
    });
    blocks.filter((x) => x.day === iso).forEach((x) => {
      around(x.from, x.to, x.place ? placeMin(cfg, x.place) : 0, 0);
      mark(d, x.from, x.to, `fijo:${x.name}`);
    });
  });
  return { days, blocked, n, wake };
}

const energyAt = (P, minute) => (minute < 13 * 60 ? P.energy.am : minute < 19 * 60 ? P.energy.pm : P.energy.ev) / 5;

export function areaScore(cfg, areaId) {
  const order = cfg.areaOrder || [];
  const i = order.indexOf(areaId);
  if (i < 0) return 0;
  return order.length > 1 ? 1 - i / (order.length - 1) : 1;
}

// Stage A: who gets to pick first.
export function urgency(cfg, t, today) {
  const W = cfg.weights; const parts = [];
  const add = (id, label, v) => parts.push({ id, label, value: v, weight: W[id], contrib: v * W[id] });
  add('wPriority', 'Prioridad', (t.prio - 1) / 4);
  add('wArea', 'Área', areaScore(cfg, t.area));
  const toDl = t.dl ? daysBetween(today, t.dl) : null;
  add('wDeadline', 'Fecha límite', toDl === null ? 0 : (1 / (1 + Math.max(0, toDl))) * (t.dlHard ? 1 : 0.6));
  add('wOverdue', 'Atraso', Math.min(1, Math.max(0, daysBetween(t.orig, today)) / 7));
  return { total: parts.reduce((s, p) => s + p.contrib, 0), parts };
}

// Stage B: score of putting task `t` at slot k0 of day d.
function scoreSlot(cfg, G, ctx, t, d, k0) {
  const W = cfg.weights; const P = cfg.profile; const parts = [];
  const add = (id, label, v) => parts.push({ id, label, value: v, weight: W[id], contrib: v * W[id] });
  const iso = G.days[d]; const start = G.wake + k0 * SLOT;
  add('wMove', 'Distancia al día original', -Math.min(Math.max(0, daysBetween(t.orig, iso)), 7) / 7);
  add('wEnergy', 'Energía', 1 - Math.abs(EFFORT[t.effort].need - energyAt(P, start)));
  add('wSoon', 'Lo antes posible', 1 - (d * G.n + k0) / (HORIZON * G.n));
  if (t.dl) {
    const slack = daysBetween(iso, t.dl);
    add('wSlack', 'Holgura', slack < 0 ? -1 : -(1 - Math.min(slack, 5) / 5));
  } else add('wSlack', 'Holgura', 0);
  const deepMin = ctx.deep[d] + (t.effort === 'deep' ? t.effDur : 0);
  add('wDeepCap', 'Tope profundo', t.effort === 'deep' && deepMin > P.deepCap * 60 ? -1 : 0);
  add('wBalance', 'Reparto de áreas', -Math.min(1, (ctx.areaDay[d][t.area] || 0) / 3));
  return { total: parts.reduce((s, p) => s + p.contrib, 0), parts, d, k0, start };
}

// tasks: [{ id, title, area, prio, effort, dur, orig, dl, dlHard, place, notBefore }]
export function runEngine(cfg, tasks, { today, nowMin, blocks = [] }) {
  const G = buildGrid(cfg, today, nowMin, blocks);
  const P = cfg.profile;
  const used = G.days.map(() => Array(G.n).fill(null));
  const ctx = { deep: G.days.map(() => 0), areaDay: G.days.map(() => ({})) };
  const placed = []; const unplaced = [];
  const bufSlots = Math.ceil(P.buffer / SLOT);

  const order = tasks.map((t) => ({ t, u: urgency(cfg, t, today) }))
    .sort((a, b) => b.u.total - a.u.total || String(a.t.id).localeCompare(String(b.t.id)));

  order.forEach(({ t, u }, rank) => {
    const commute = t.place && !['Casa', 'Cualquiera'].includes(t.place) ? placeMin(cfg, t.place) : 0;
    const task = { ...t, effDur: t.dur + commute };
    const need = Math.max(1, Math.ceil(task.effDur / SLOT));
    // Never earlier than the day it was planned for (unless that day is already past).
    const minDay = [t.notBefore, t.orig >= today ? t.orig : ''].filter(Boolean).sort().pop() || '';
    const cands = [];
    for (let d = 0; d < HORIZON; d++) {
      if (minDay && G.days[d] < minDay) continue;
      if (t.dl && t.dlHard && G.days[d] > t.dl) continue;
      for (let k0 = 0; k0 + need <= G.n; k0++) {
        let ok = true;
        for (let k = k0; k < k0 + need; k++) if (G.blocked[d][k] || used[d][k]) { ok = false; break; }
        if (ok) cands.push(scoreSlot(cfg, G, ctx, task, d, k0));
      }
    }
    if (!cands.length) {
      unplaced.push({ task, rank, urgency: u, reason: t.dl && t.dlHard ? 'No hay hueco antes de la fecha límite (dura).' : 'No cabe en los próximos 7 días.' });
      return;
    }
    cands.sort((a, b) => b.total - a.total || a.d - b.d || a.k0 - b.k0);
    const best = cands[0];
    for (let k = best.k0; k < best.k0 + need; k++) used[best.d][k] = t.id;
    for (let k = best.k0 + need; k < best.k0 + need + bufSlots && k < G.n; k++) if (!G.blocked[best.d][k] && !used[best.d][k]) used[best.d][k] = 'buf';
    if (t.effort === 'deep') ctx.deep[best.d] += task.effDur;
    ctx.areaDay[best.d][t.area] = (ctx.areaDay[best.d][t.area] || 0) + 1;
    const alts = [];
    for (const c of cands.slice(1)) {
      if (alts.length >= 3) break;
      if (c.d === best.d && Math.abs(c.k0 - best.k0) < 4) continue;
      if (alts.some((a) => a.d === c.d && Math.abs(a.k0 - c.k0) < 4)) continue;
      alts.push(c);
    }
    placed.push({ task, rank, urgency: u, choice: best, alts, need, candidates: cands.length, commute });
  });
  return { G, used, placed, unplaced };
}

export const freeHours = (G) => { let c = 0; G.blocked.forEach((col) => col.forEach((b) => { if (!b) c++; })); return (c * SLOT) / 60; };
export const slotKey = (G, c) => `${G.days[c.d]} ${fmtMin(c.start)}`;
export const signature = (res) => Object.fromEntries([
  ...res.placed.map((p) => [p.task.id, slotKey(res.G, p.choice)]),
  ...res.unplaced.map((p) => [p.task.id, 'no cabe'])
]);
