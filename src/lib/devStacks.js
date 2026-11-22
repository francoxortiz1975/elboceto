// Dev stacks: one row per feature, with up to three pieces: Plan -> Desarrollo -> Verificación.
// Every piece is an ordinary plan block (so it also shows in Día / Tablero / Semana / Mes and the MCP can read it);
// `dev: { s: stackId, r: 'plan' | 'build' | 'check' }` ties it to its stack. The stack id is the id of its Desarrollo block.
import { uid } from './areaPlan';

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
