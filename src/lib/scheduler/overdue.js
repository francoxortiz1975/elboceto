// "Pendientes de ayer": what was planned for a past day and is not done, with one action each.
// Every action is logged in plan.scheduler.history (kind: accept | alt | done | later | skip | undo).

import { daysBetween } from '../areaPlan';
import { getScheduler } from './config';

const MAX_HISTORY = 500;

// Open items dated before today. Reels / Stories bound to a stack are not pending work, they keep their date.
export function overdueItems(plan, today) {
  return plan.items
    .filter((it) => !it.done && /^\d{4}-\d{2}-\d{2}$/.test(it.day || '') && it.day < today && !(it.reel && it.stackId))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

const withHistory = (plan, cfg, entries) => ({ ...plan, scheduler: { ...cfg, history: [...cfg.history, ...entries].slice(-MAX_HISTORY) } });

// action: 'move' (target {day, at, dur}, via 'accept' | 'alt'), 'done', 'later' or 'skip' (leave it, only logged).
// Returns the new plan and a snapshot that undoResolve() can restore.
export function resolveItem(plan, id, { action, target, via, today, now = new Date().toISOString() }) {
  const it = plan.items.find((i) => i.id === id);
  if (!it) return { plan, undo: null };
  const cfg = getScheduler(plan);
  const undo = { id, title: it.text, item: it, attr: cfg.attrs[id] };
  let item = it;
  let attrs = cfg.attrs;
  let to = null;
  if (action === 'move') {
    item = { ...it, day: target.day, at: target.at, dur: target.dur };
    attrs = { ...attrs, [id]: { ...(attrs[id] || {}), flex: true } }; // still movable by the next replan
    to = { day: target.day, at: target.at };
  } else if (action === 'done') {
    item = { ...it, done: true };
  } else if (action === 'later') {
    const { dur: _d, ...rest } = it;
    item = { ...rest, day: 'later', at: 'any' };
    to = { day: 'later' };
  }
  const entry = { t: now, kind: action === 'move' ? via || 'accept' : action, id, title: it.text, from: { day: it.day, at: it.at }, ...(to ? { to } : {}), late: daysBetween(it.day, today) };
  const next = { ...plan, items: plan.items.map((i) => (i.id === id ? item : i)) };
  return { plan: withHistory(next, { ...cfg, attrs }, [entry]), undo };
}

export function undoResolve(plan, undo, now = new Date().toISOString()) {
  if (!undo) return plan;
  const cfg = getScheduler(plan);
  const attrs = { ...cfg.attrs };
  if (undo.attr) attrs[undo.id] = undo.attr; else delete attrs[undo.id];
  const next = { ...plan, items: plan.items.map((i) => (i.id === undo.id ? undo.item : i)) };
  return withHistory(next, { ...cfg, attrs }, [{ t: now, kind: 'undo', id: undo.id, title: undo.title, from: null }]);
}
