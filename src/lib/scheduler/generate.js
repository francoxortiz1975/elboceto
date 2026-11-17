// Blocks that the scheduler creates in the calendar by itself (item.gen says who made them):
//   - fixed events the user marked "Crear en el calendario"  -> locked blocks, gen 'fx:<eventId>'
//   - flexible habits ("gym, N times a week")                -> normal blocks, gen 'hb:<habitId>'
// Both are idempotent: running them again changes nothing unless something is missing or changed.
//
// Habit rule (hybrid): each week (Monday to Sunday) the target is N. Missed ones are re-placed later in the SAME
// week; if the days left cannot hold what is missing, only what fits is planned; nothing carries into next week.

import { addDays, isoOf } from '../areaPlan';
import { activeOn, runEngine, toMin, dowOf } from './engine';
import { getScheduler, buildEngineInput, areaWindow, windowLabel, nowMinutes } from './config';

const MAX_HISTORY = 500;
const FIXED_AHEAD = 28; // days of fixed events kept ready in the calendar
const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export const weekOf = (today) => { const mon = addDays(today, -dowOf(today)); return { mon, sun: addDays(mon, 6) }; };
// The period a habit is counted in: the calendar week (Monday to Sunday) or the calendar month.
export function periodOf(today, period = 'week') {
  if (period !== 'month') { const w = weekOf(today); return { from: w.mon, to: w.sun }; }
  const d = new Date(`${today}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: `${today.slice(0, 8)}01`, to: isoOf(last) };
}
const inPeriod = (day, p) => isoRe.test(day || '') && day >= p.from && day <= p.to;

const withScheduler = (plan, cfg, patch) => ({ ...plan, scheduler: { ...(plan.scheduler || {}), ...cfg, ...patch } });
const logEntries = (cfg, entries) => [...(cfg.history || []), ...entries].slice(-MAX_HISTORY);

// A new area with the next free colour (used by "Nueva área…" in the habit editor).
export function withNewArea(plan, name) {
  const used = plan.areas.map((a) => a.c);
  const free = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => !used.includes(c));
  const area = { id: `ar_${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), c: free === undefined ? plan.areas.length % 8 : free };
  return { plan: { ...plan, areas: [...plan.areas, area] }, area };
}

// ---------- fixed events -> locked blocks ----------
export function generateFixed(plan, today) {
  const cfg = getScheduler(plan);
  const areaIds = new Set(plan.areas.map((a) => a.id));
  const have = new Set(plan.items.map((i) => i.id));
  const generated = { ...(cfg.generated || {}) };
  const wanted = new Map();
  cfg.fixed.filter((f) => f.calendar && areaIds.has(f.area)).forEach((f) => {
    for (let n = 0; n < FIXED_AHEAD; n++) {
      const day = addDays(today, n);
      if (!activeOn(f, day)) continue;
      wanted.set(`fx:${f.id}:${day}`, {
        id: `fx:${f.id}:${day}`, area: f.area, text: f.name, done: false, day, at: toMin(f.from), dur: Math.max(15, toMin(f.to) - toMin(f.from)), lock: true, gen: `fx:${f.id}`, src: 'motor'
      });
    }
  });
  const add = [];
  wanted.forEach((it, id) => { if (!have.has(id) && !generated[id]) { add.push(it); generated[id] = it.day; } });
  // Generated fixed blocks that no longer belong (switched off, event deleted, days changed) disappear, if still ahead and not done.
  const drop = new Set(plan.items.filter((i) => i.gen && i.gen.startsWith('fx:') && !i.done && i.day >= today && !wanted.has(i.id)).map((i) => i.id));
  drop.forEach((id) => delete generated[id]);
  Object.keys(generated).forEach((id) => { if (generated[id] < addDays(today, -60)) delete generated[id]; });
  if (!add.length && !drop.size && JSON.stringify(generated) === JSON.stringify(cfg.generated || {})) return { plan, added: 0, removed: 0 };
  const items = [...plan.items.filter((i) => !drop.has(i.id)), ...add];
  return { plan: withScheduler({ ...plan, items }, cfg, { generated }), added: add.length, removed: drop.size };
}

// ---------- flexible habits ----------
// Where each habit stands this week, for the editor: done, planned, missing, and how many days could still hold one.
export function habitStatus(plan, h, today) {
  const pr = periodOf(today, h.period);
  const mine = plan.items.filter((i) => i.gen === `hb:${h.id}` && inPeriod(i.day, pr));
  const done = mine.filter((i) => i.done).length;
  const planned = mine.filter((i) => !i.done && i.day >= today).length;
  return { done, planned, missing: Math.max(0, h.perWeek - done - planned), period: pr };
}

// What decides WHERE a habit's blocks go. If any of it changes, the upcoming blocks are placed again;
// the name is not part of it (a rename only renames the upcoming blocks).
const habitSig = (h) => JSON.stringify([h.area, h.dur || 60, h.from || '', h.to || '', h.prefer || [], h.period === 'month' ? 'month' : 'week', h.perWeek, h.maxPerDay || 1]);

export function planHabits(plan, today, { nowMin = nowMinutes(), by = 'auto', now = new Date().toISOString() } = {}) {
  let cur = plan;
  const cfg0 = getScheduler(plan);
  const history = [];
  let added = 0; let missed = 0; let removed = 0; let renamed = 0;

  // Blocks of a habit that was removed, switched off or lost its area disappear (the ones still ahead and not done).
  const live = new Set((cfg0.habits || []).filter((h) => h.on !== false && h.perWeek > 0 && plan.areas.some((a) => a.id === h.area)).map((h) => `hb:${h.id}`));
  const orphans = new Set(cur.items.filter((i) => i.gen && i.gen.startsWith('hb:') && !i.done && i.day >= today && !live.has(i.gen)).map((i) => i.id));
  if (orphans.size) { cur = { ...cur, items: cur.items.filter((i) => !orphans.has(i.id)) }; removed += orphans.size; }

  (cfg0.habits || []).filter((h) => h.on !== false && h.perWeek > 0 && plan.areas.some((a) => a.id === h.area)).forEach((h) => {
    const gen = `hb:${h.id}`;
    const sig = habitSig(h);
    const pr = periodOf(today, h.period);
    const mine = cur.items.filter((i) => i.gen === gen && inPeriod(i.day, pr));
    const done = mine.filter((i) => i.done);
    const pastPending = mine.filter((i) => !i.done && i.day < today);       // not done: counts as missed
    let future = mine.filter((i) => !i.done && i.day >= today).sort((a, b) => (a.day < b.day ? -1 : 1));
    const remaining = Math.max(0, h.perWeek - done.length);
    const drop = new Set(pastPending.map((i) => i.id));
    // Placed under other rules (or before the rules were saved): place them again under the current ones.
    future.filter((i) => i.gsig !== sig).forEach((i) => drop.add(i.id));
    future = future.filter((i) => !drop.has(i.id));
    if (future.length > remaining) future.slice(remaining).forEach((i) => drop.add(i.id)); // more planned than needed: keep the earliest
    future = future.filter((i) => !drop.has(i.id));
    pastPending.forEach((i) => history.push({ t: now, kind: 'habit-miss', id: i.id, title: h.name, from: { day: i.day, at: i.at }, by }));
    missed += pastPending.length; removed += drop.size;
    let items = cur.items.filter((i) => !drop.has(i.id)).map((i) => {
      if (i.gen === gen && !i.done && i.day >= today && i.text !== h.name) { renamed += 1; return { ...i, text: h.name }; }
      return i;
    });

    const maxDay = Math.max(1, h.maxPerDay || 1);
    const countOn = (list, day) => list.filter((i) => i.day === day).length;
    let need = remaining - future.length;
    const win = h.from || h.to
      ? [h.from ? toMin(h.from) : 0, h.to ? toMin(h.to) : 24 * 60]
      : areaWindow(cfg0, h.area, 'task');
    const placedNow = [];
    // Preferred weekdays are a wish, not a rule: try them first, and use another day only when none works.
    const prefer = (h.prefer || []).filter((d) => d >= 0 && d <= 6);
    const reach = Array.from({ length: 7 }, (_, n) => addDays(today, n)).filter((d) => d <= pr.to); // what the engine can see
    const preferredInReach = reach.filter((d) => prefer.includes(dowOf(d)));
    while (need > 0) {
      const tmp = { ...cur, items };
      const inp = buildEngineInput(tmp, today);
      const taken = [...done, ...future, ...placedNow];
      const skipDays = [...new Set(taken.map((i) => i.day))].filter((d) => countOn(taken, d) >= maxDay);
      const task = {
        id: `habit:${h.id}`, title: h.name, area: h.area, kind: 'task', win, winLabel: windowLabel(win), skipDays,
        prio: 3, effort: 'light', dur: h.dur || 60, orig: today, dl: pr.to, dlHard: true, place: 'Casa', notBefore: ''
      };
      // A day the user prefers for this habit counts as open even if the Perfil marks it as a rest day (Sunday chores).
      const prefCfg = { ...inp.cfg, profile: { ...inp.cfg.profile, open: inp.cfg.profile.open.map((o, d) => o || prefer.includes(d)) } };
      const run = (extra, c = inp.cfg) => runEngine(c, [{ ...task, ...extra }], { today, nowMin, blocks: inp.blocks });
      let p = null; let res = null;
      if (preferredInReach.length) { res = run({ onlyDays: preferredInReach }, prefCfg); p = res.placed[0]; }
      if (!p) { res = run({}); p = res.placed[0]; }
      if (!p) break; // nothing else fits this period: do the most that fits
      const day = res.G.days[p.choice.d];
      const item = { id: `hb:${h.id}:${day}`, area: h.area, text: h.name, done: false, day, at: p.choice.start, dur: h.dur || 60, gen, gsig: sig, src: 'motor' };
      if (items.some((i) => i.id === item.id)) break;
      items = [...items, item]; placedNow.push(item); need -= 1; added += 1;
      history.push({ t: now, kind: 'habit-add', id: item.id, title: h.name, to: { day, at: p.choice.start }, by });
    }
    cur = { ...cur, items };
  });

  if (!added && !removed && !renamed) return { plan, added, missed, removed };
  const cfg = getScheduler(cur);
  return { plan: withScheduler(cur, cfg, { history: logEntries(cfg, history) }), added, missed, removed };
}

// Everything the scheduler generates, in one call (used when the app opens, when the day changes and when rules change).
export function runGenerators(plan, today = isoOf(new Date()), opts = {}) {
  const a = generateFixed(plan, today);
  const b = planHabits(a.plan, today, opts);
  return { plan: b.plan, changed: b.plan !== plan, fixedAdded: a.added, fixedRemoved: a.removed, habitsAdded: b.added, habitsMissed: b.missed };
}

export const newHabit = (areaId) => ({ id: `hb_${Math.random().toString(36).slice(2, 8)}`, name: 'Nuevo hábito', area: areaId || '', perWeek: 3, period: 'week', prefer: [], dur: 60, from: '', to: '', maxPerDay: 1, on: false });
