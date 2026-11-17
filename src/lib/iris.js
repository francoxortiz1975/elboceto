// IRIS: the inbox that connects the planner ("centro de mando") with one conversation per area.
// Conversations cannot message each other, so they leave notes here and read them when they start (a hook forces it).
// The notes live inside the plan (plan.iris.notes), so they sync like everything else and need no extra table.
//
// A note: { id, t, area, dir, kind, text, from, item?, read }
//   area  id of the area the note is about
//   dir   'to_area' (the hub tells the area) | 'to_hub' (the area tells the hub)
//   kind  'note' | 'order' (a piece of work, usually with a block in the calendar) | 'change' (the plan changed) | 'report' (progress)
//   from  'hub' | 'rollover' | 'user' | 'area'

import { durOf, dayLabel, fmtMin, isoOf } from './areaPlan';

export const NOTE_KINDS = ['note', 'order', 'change', 'report'];
const MAX_NOTES = 300;
const nid = () => `n_${Math.random().toString(36).slice(2, 10)}`;

export const notesOf = (plan) => (plan.iris && Array.isArray(plan.iris.notes) ? plan.iris.notes : []);

// When there are too many, the oldest read ones go first, then the oldest of all.
function prune(notes) {
  if (notes.length <= MAX_NOTES) return notes;
  let extra = notes.length - MAX_NOTES;
  const drop = new Set();
  for (const n of notes) { if (extra > 0 && n.read) { drop.add(n.id); extra -= 1; } }
  for (const n of notes) { if (extra > 0 && !drop.has(n.id)) { drop.add(n.id); extra -= 1; } }
  return notes.filter((n) => !drop.has(n.id));
}

// list: [{ area, text, kind?, dir?, from?, item?, read? }]
export function addNotes(plan, list, now = new Date().toISOString()) {
  const valid = list.filter((n) => n && n.area && n.text);
  if (!valid.length) return plan;
  const added = valid.map((n) => ({
    id: nid(), t: now, area: n.area, dir: n.dir === 'to_hub' ? 'to_hub' : 'to_area', kind: NOTE_KINDS.includes(n.kind) ? n.kind : 'note',
    text: String(n.text).slice(0, 2000), from: n.from || 'hub', ...(n.item ? { item: n.item } : {}), read: !!n.read
  }));
  return { ...plan, iris: { ...(plan.iris || {}), notes: prune([...notesOf(plan), ...added]) } };
}

// Notes an area's conversation should read (dir 'to_area') or the hub should read (dir 'to_hub').
export const unreadFor = (plan, { area, dir = 'to_area' } = {}) => notesOf(plan).filter((n) => !n.read && n.dir === dir && (!area || n.area === area));

// ids: mark these; or area (+ dir): mark everything unread for it.
export function markRead(plan, { ids, area, dir }) {
  const set = ids ? new Set(ids) : null;
  let changed = 0;
  const notes = notesOf(plan).map((n) => {
    if (n.read) return n;
    const hit = set ? set.has(n.id) : (!area || n.area === area) && (!dir || n.dir === dir);
    if (!hit) return n;
    changed += 1;
    return { ...n, read: true };
  });
  return changed ? { plan: { ...plan, iris: { ...(plan.iris || {}), notes } }, changed } : { plan, changed: 0 };
}

const clock = (day, at) => (typeof at === 'number' ? `${dayLabel(day)} ${fmtMin(at)}` : day === 'later' ? 'más adelante' : dayLabel(day));
export const whenText = clock;

export function noteLine(plan, n) {
  const a = plan.areas.find((x) => x.id === n.area);
  const d = new Date(n.t);
  const stamp = Number.isNaN(d.getTime()) ? '' : `${isoOf(d).slice(5)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const kind = { note: 'nota', order: 'encargo', change: 'cambio', report: 'avance' }[n.kind] || n.kind;
  return `[${n.id}] ${stamp} · ${a ? a.name : '?'} · ${kind} · de ${n.from === 'area' ? 'el área' : n.from === 'rollover' ? 'el reagendamiento' : n.from === 'user' ? 'ti' : 'el centro'}${n.item ? ` · bloque ${n.item}` : ''}\n    ${n.text}`;
}

// One line per area for "how am I doing".
export function areaSummary(plan, today, overdueIds = new Set()) {
  return plan.areas.map((a) => {
    const mine = plan.items.filter((i) => i.area === a.id);
    const open = mine.filter((i) => !i.done);
    const dated = open.filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.day || ''));
    const next = dated.filter((i) => i.day >= today).sort((x, y) => `${x.day}${String(typeof x.at === 'number' ? x.at : 99999).padStart(5, '0')}` < `${y.day}${String(typeof y.at === 'number' ? y.at : 99999).padStart(5, '0')}` ? -1 : 1)[0];
    return {
      id: a.id, name: a.name, open: open.length, locked: open.filter((i) => i.lock).length,
      overdue: open.filter((i) => overdueIds.has(i.id)).length,
      todayCount: dated.filter((i) => i.day === today).length,
      unreadToArea: unreadFor(plan, { area: a.id, dir: 'to_area' }).length,
      unreadToHub: unreadFor(plan, { area: a.id, dir: 'to_hub' }).length,
      next: next ? `${next.text} (${clock(next.day, next.at)}${typeof next.at === 'number' ? `, ${durOf(next)} min` : ''})` : ''
    };
  });
}
