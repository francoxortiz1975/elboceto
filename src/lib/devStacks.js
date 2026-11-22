// Dev stacks: one row per feature, with up to three pieces: Plan -> Desarrollo -> Verificación.
// Every piece is an ordinary plan block (so it also shows in Día / Tablero / Semana / Mes and the MCP can read it);
// `dev: { s: stackId, r: 'plan' | 'build' | 'check' }` ties it to its stack. The stack id is the id of its Desarrollo block.
import { uid } from './areaPlan';
import { addNotes } from './iris';

export const DEV_ROLES = [
  { role: 'plan', label: 'Plan', hint: 'Qué se va a hacer y cómo' },
  { role: 'build', label: 'Desarrollo', hint: 'La feature' },
  { role: 'check', label: 'Verificación', hint: 'Pruebas, revisión, despliegue' }
];

export const isDev = (it) => !!(it && it.dev && it.dev.s);

// Stacks of one area, ordered by day (undated ones last) and then by creation order.
export function devStacks(plan, areaId) {
  const items = plan.items.filter((i) => isDev(i) && (!areaId || i.area === areaId));
  const out = [];
  items.filter((i) => i.dev.r === 'build').forEach((main) => {
    out.push({
      id: main.id,
      main,
      plan: items.find((i) => i.dev.s === main.id && i.dev.r === 'plan') || null,
      check: items.find((i) => i.dev.s === main.id && i.dev.r === 'check') || null
    });
  });
  const order = (s) => (/^\d{4}/.test(s.main.day || '') ? s.main.day : '9999');
  return out.map((s, i) => ({ s, i })).sort((a, b) => order(a.s).localeCompare(order(b.s)) || a.i - b.i).map((x) => x.s);
}

export function addDevStack(plan, { area, name, day, note = '' }) {
  const text = String(name || '').trim();
  if (!text) return { plan, id: null };
  const id = uid();
  const item = { id, area, text, done: false, day: day || 'later', at: 'any', src: 'desarrollo', dev: { s: id, r: 'build' }, ...(note ? { note } : {}) };
  return { plan: { ...plan, items: [...plan.items, item] }, id };
}

// Adds the Plan or Verificación piece of a stack (same day as the feature).
export function addDevSlot(plan, stackId, role) {
  const main = plan.items.find((i) => i.id === stackId);
  if (!main || role === 'build' || plan.items.some((i) => isDev(i) && i.dev.s === stackId && i.dev.r === role)) return { plan, id: null };
  const id = uid();
  const label = DEV_ROLES.find((r) => r.role === role).label;
  const item = { id, area: main.area, text: `${label}: ${main.text}`, done: false, day: main.day, at: 'any', src: 'desarrollo', dev: { s: stackId, r: role } };
  return { plan: { ...plan, items: [...plan.items, item] }, id };
}

export const editDevItem = (plan, id, patch) => ({ ...plan, items: plan.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

// Moves the whole stack to another day.
export const moveDevStack = (plan, stackId, day) => ({ ...plan, items: plan.items.map((i) => (isDev(i) && i.dev.s === stackId && !i.done ? { ...i, day } : i)) });

// Removes one piece; removing the Desarrollo piece removes the whole stack.
export function removeDevItem(plan, id) {
  const it = plan.items.find((i) => i.id === id);
  if (!it) return plan;
  const gone = isDev(it) && it.dev.r === 'build' ? (i) => isDev(i) && i.dev.s === id : (i) => i.id === id;
  return { ...plan, items: plan.items.filter((i) => !gone(i)) };
}

// ---- importing what already exists ----
// Open blocks of the area that are not dev pieces yet (and are not generated content: reels, films, habits) become one-block stacks,
// so the tasks that were already in the backlog show up here. Returns the same plan when there is nothing to import.
const importable = (i, areaId) => i.area === areaId && !i.done && !isDev(i) && !i.stackId && !i.reel && !i.film && !i.gen;
export function migrateToDev(plan, areaId) {
  if (!plan.items.some((i) => importable(i, areaId))) return plan;
  return { ...plan, items: plan.items.map((i) => (importable(i, areaId) ? { ...i, dev: { s: i.id, r: 'build' } } : i)) };
}

// ---- dragging ----
// Drop a piece (or a one-block stack) onto the EMPTY Plan / Verificación slot of another stack. The piece takes that role and the stack's day.
// Returns { plan, error }: a stack that already has its own Plan / Verificación pieces cannot be folded into another one.
export function dropDev(plan, dragId, targetStackId, role) {
  const it = plan.items.find((i) => i.id === dragId);
  const main = plan.items.find((i) => i.id === targetStackId);
  if (!it || !main || !isDev(it) || role === 'build' || it.id === targetStackId) return { plan, error: '' };
  if (plan.items.some((i) => isDev(i) && i.dev.s === targetStackId && i.dev.r === role)) return { plan, error: 'Ese hueco ya está ocupado.' };
  if (it.dev.r === 'build' && plan.items.some((i) => isDev(i) && i.dev.s === it.id && i.id !== it.id)) return { plan, error: 'Ese stack ya tiene su propio plan o verificación: sepáralos primero.' };
  const day = /^\d{4}/.test(main.day || '') ? main.day : it.day;
  return { plan: { ...plan, items: plan.items.map((i) => (i.id === dragId ? { ...i, day, dev: { s: targetStackId, r: role } } : i)) }, error: '' };
}

// A Plan / Verificación piece becomes a stack of its own again.
export const detachDev = (plan, id) => ({ ...plan, items: plan.items.map((i) => (i.id === id && isDev(i) ? { ...i, dev: { s: id, r: 'build' } } : i)) });

// ---- order inside a day ----
// Moves a stack one place up (-1) or down (+1) among the stacks of the same day: its Desarrollo block swaps places with the neighbour's.
export function nudgeDevStack(plan, stackId, dir) {
  const main = plan.items.find((i) => i.id === stackId);
  if (!main) return plan;
  const mates = devStacks(plan, main.area).filter((s) => s.main.day === main.day);
  const at = mates.findIndex((s) => s.id === stackId);
  const other = mates[at + dir];
  if (at < 0 || !other) return plan;
  const items = plan.items.slice();
  const a = items.findIndex((i) => i.id === stackId);
  const b = items.findIndex((i) => i.id === other.id);
  [items[a], items[b]] = [items[b], items[a]];
  return { ...plan, items };
}

// ---- time and automatic launch (IRIS+) ----
export const setDevTime = (plan, stackId, minutes) => ({
  ...plan,
  items: plan.items.map((i) => {
    if (i.id !== stackId) return i;
    if (typeof minutes !== 'number') { const { iris, ...rest } = i; return { ...rest, at: 'any' }; } // no time = it cannot start by itself
    return { ...i, at: minutes, dur: i.dur || 60 };
  })
});

// The order IRIS leaves in the area's inbox: the feature, its comments and its Plan / Verificación pieces.
export function devBrief(plan, stackId) {
  const st = devStacks(plan).find((s) => s.id === stackId);
  if (!st) return '';
  const part = (label, it) => (it ? `${label}: ${it.text}${it.note ? `\n${it.note}` : ''}` : '');
  return [part('Feature', st.main), part('Plan', st.plan), part('Verificación', st.check)].filter(Boolean).join('\n\n');
}

// on: the conversation of the area starts by itself at the block's time (needs a day and a time) and gets the brief as its order.
export function setDevLaunch(plan, stackId, on, now = new Date().toISOString()) {
  const main = plan.items.find((i) => i.id === stackId);
  if (!main) return plan;
  if (!on) return { ...plan, items: plan.items.map((i) => (i.id === stackId ? { ...i, iris: { ...(i.iris || {}), launch: false } } : i)) };
  if (typeof main.at !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(main.day || '')) return plan;
  const next = { ...plan, items: plan.items.map((i) => (i.id === stackId ? { ...i, iris: { launch: true, state: 'pending' } } : i)) };
  return addNotes(next, [{ area: main.area, dir: 'to_area', kind: 'order', from: 'boceto', item: stackId, text: devBrief(next, stackId) }], now);
}
