// The nightly reschedule ("rollover"): runs at 00:00 (on the server) and, as a safety net, the first time the app is
// opened on a new day. It is idempotent per day: plan.scheduler.lastRollover.day says it already ran today.
//
//   1. fixed-event blocks of past days are closed (they happened; they are not "pending")
//   2. fixed events / habits are generated for the days ahead (habits missed yesterday are counted and re-placed)
//   3. what was planned for a past day and is not done is moved to its next free slot, inside its area's hours:
//        - applied by itself only when it is safe: a task with a free slot
//        - NOT touched: locked blocks, meetings (someone else is involved), things the user chose to leave ("Dejar"),
//          and anything with no room, which stays in Pendientes for the user
//   4. a summary is stored (lastRollover) so the app can say what happened overnight and offer Deshacer

import { getScheduler, buildEngineInput, isMeeting, nowMinutes } from './config';
import { runEngine } from './engine';
import { runGenerators } from './generate';
import { overdueItems, resolveItem, undoResolve } from './overdue';
import { addNotes, whenText } from '../iris';

const MAX_HISTORY = 500;

const withLast = (plan, last, extraHistory = []) => {
  const cfg = getScheduler(plan);
  return { ...plan, scheduler: { ...cfg, lastRollover: last, history: [...cfg.history, ...extraHistory].slice(-MAX_HISTORY) } };
};

export function rollover(plan, today, { nowMin = nowMinutes(), by = 'auto', now = new Date().toISOString(), force = false } = {}) {
  const cfg0 = getScheduler(plan);
  if (!force && cfg0.lastRollover && cfg0.lastRollover.day === today) return { plan, ran: false };

  // 1. past fixed-event blocks are done by definition
  let cur = plan;
  const closing = cur.items.filter((i) => i.gen && i.gen.startsWith('fx:') && !i.done && i.day < today);
  if (closing.length) { const ids = new Set(closing.map((i) => i.id)); cur = { ...cur, items: cur.items.map((i) => (ids.has(i.id) ? { ...i, done: true } : i)) }; }

  // 2. generated blocks
  const gen = runGenerators(cur, today, { nowMin, by, now });
  cur = gen.plan;

  // 3. overdue work
  const skipped = new Set(getScheduler(cur).history.filter((h) => h.kind === 'skip').map((h) => h.id));
  const overdue = overdueItems(cur, today);
  const movable = overdue.filter((i) => !i.lock && !isMeeting(i) && !skipped.has(i.id));
  const moves = []; const undos = [];
  let lastRes = null;
  if (movable.length) {
    const inp = buildEngineInput(cur, today);
    const res = runEngine(inp.cfg, inp.tasks, { today, nowMin, blocks: inp.blocks });
    lastRes = res;
    movable.forEach((it) => {
      const p = res.placed.find((x) => x.task.id === it.id);
      if (!p) return;
      const target = { day: res.G.days[p.choice.d], at: p.choice.start, dur: p.task.dur };
      const out = resolveItem(cur, it.id, { action: 'move', via: 'auto', target, today, by, now });
      cur = out.plan;
      if (out.undo) undos.push(out.undo);
      moves.push({ id: it.id, area: it.area, title: it.text, from: { day: it.day, at: it.at }, to: { day: target.day, at: target.at } });
    });
  }
  const moved = new Set(moves.map((m) => m.id));
  const noRoom = (i) => { const t = (lastRes && lastRes.unplaced.find((x) => x.task.id === i.id)); return t && t.task.win ? `sin hueco en ${t.task.winLabel}` : 'sin hueco'; };
  const left = overdue.filter((i) => !moved.has(i.id)).map((i) => ({ id: i.id, area: i.area, day: i.day, title: i.text, why: i.lock ? 'candado' : isMeeting(i) ? 'reunión' : skipped.has(i.id) ? 'la dejaste' : noRoom(i) }));

  const last = {
    day: today, t: now, by, moves, undos, left,
    closed: closing.length, fixedAdded: gen.fixedAdded, habitsAdded: gen.habitsAdded, habitsMissed: gen.habitsMissed
  };
  const entry = { t: now, kind: 'rollover', by, moved: moves.length, left: left.length, habitsAdded: gen.habitsAdded, habitsMissed: gen.habitsMissed };
  // Tell each area's conversation what changed in its plan overnight (IRIS inbox).
  const notes = [
    ...moves.map((m) => ({ area: m.area, kind: 'change', from: 'rollover', item: m.id, text: `“${m.title}” pasó de ${whenText(m.from.day, m.from.at)} a ${whenText(m.to.day, m.to.at)} (reagendamiento automático).` })),
    ...left.map((l) => ({ area: l.area, kind: 'change', from: 'rollover', item: l.id, text: `“${l.title}” sigue pendiente (era ${whenText(l.day)}): ${l.why}. Lo decide el usuario en Motor → Pendientes.` }))
  ];
  return { plan: addNotes(withLast(cur, last, [entry]), notes, now), ran: true, summary: last };
}

// Puts back everything the last rollover moved (the other things it did, like generating blocks, stay).
export function undoRollover(plan, now = new Date().toISOString()) {
  const cfg = getScheduler(plan);
  const last = cfg.lastRollover;
  if (!last || !(last.undos || []).length) return plan;
  let cur = plan;
  last.undos.forEach((u) => { cur = undoResolve(cur, u, now); });
  const notes = (last.moves || []).map((m) => ({ area: m.area, kind: 'change', from: 'user', item: m.id, text: `“${m.title}” volvió a ${whenText(m.from.day, m.from.at)}: el usuario deshizo el reagendamiento automático.` }));
  return addNotes(withLast(cur, { ...last, moves: [], undos: [], undone: true }), notes, now);
}
