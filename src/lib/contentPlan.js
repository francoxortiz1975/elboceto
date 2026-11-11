// Content plans (e.g. an Instagram plan written by another Claude conversation).
// A plan is a JSON file (format: docs/CONTENT_PLAN_FORMAT.md) that adds an area,
// dated blocks, and a "stack": an ordered list of posts (Reels) whose dates follow
// their position in the stack. Reordering the stack moves the blocks in the
// calendar; posted ones stay where they are.

import { AREA_COLORS, addDays, fromIso, uid } from './areaPlan';

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const reelItemId = (stackId, reelId) => `${stackId}:reel:${reelId}`;

// Returns an error message, or '' when the file looks like a content plan.
export function validateContentPlan(c) {
  if (!c || typeof c !== 'object') return 'El archivo no es un plan de contenido.';
  if (c.format !== 'boceto-content-plan') return 'Falta "format": "boceto-content-plan".';
  if (!c.id || !c.area) return 'Faltan "id" o "area".';
  if (c.items && !Array.isArray(c.items)) return '"items" debe ser una lista.';
  for (const it of c.items || []) {
    if (!it.key || !it.day || !it.text) return 'Cada bloque necesita "key", "day" y "text".';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.day)) return `Fecha no válida: ${it.day}`;
  }
  const s = c.stack;
  if (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.start || '') || !/^\d{2}:\d{2}$/.test(s.at || '')) return 'El stack necesita "start" (AAAA-MM-DD) y "at" (HH:MM).';
    if (!Array.isArray(s.weekdays) || !s.weekdays.length) return 'El stack necesita "weekdays" (0 = domingo … 6 = sábado).';
    if (!Array.isArray(s.reels) || s.reels.some((r) => !r.id)) return 'Cada Reel del stack necesita un "id".';
  }
  return '';
}

// Date (YYYY-MM-DD) of slot `i` of a stack: the first weekday on/after `start`, then the next
// weekdays of the list, week after week.
export function slotDate(stack, i) {
  const days = [...stack.weekdays].sort((a, b) => a - b);
  const startDow = fromIso(stack.start).getDay();
  const first = addDays(stack.start, (days[0] - startDow + 7) % 7);
  const n = days.length;
  return addDays(first, 7 * Math.floor(i / n) + (days[i % n] - days[0]));
}

const reelName = (stack, id) => {
  const r = stack.reels[id];
  return r ? r.short || r.hook || r.title : id;
};

// The "Film + edit" block of week `w` names the Reels due the week after.
function filmText(stack, w) {
  const n = stack.weekdays.length;
  const ids = stack.order.slice(n * (w + 1), n * (w + 2));
  if (!ids.length) return 'Film + edit';
  const nums = ids.map((_, k) => n * (w + 1) + k + 1);
  return `Film + edit: Reel ${nums.join(' y ')} (${ids.map((id) => reelName(stack, id)).join(' · ')})`;
}

// Puts every stack block on its slot and refreshes the film notes.
export function applyStack(plan, stackId) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return plan;
  const slot = Object.fromEntries(stack.order.map((id, i) => [reelItemId(stackId, id), i]));
  return {
    ...plan,
    items: plan.items.map((it) => {
      if (it.stackId !== stackId) return it;
      if (it.reel && it.id in slot) return { ...it, day: slotDate(stack, slot[it.id]), at: toMinutes(stack.at) };
      if (typeof it.film === 'number') return { ...it, text: filmText(stack, it.film) };
      return it;
    })
  };
}

const isPosted = (plan, stackId, reelId) => {
  const it = plan.items.find((i) => i.id === reelItemId(stackId, reelId));
  return !!(it && it.done);
};

// Moves a Reel to the position of another one. Posted Reels keep their slot (and
// their date), so only the not-yet-posted ones are reordered among themselves.
export function moveReel(plan, stackId, id, toId) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack || id === toId) return plan;
  const free = stack.order.filter((r) => !isPosted(plan, stackId, r));
  const from = free.indexOf(id);
  const to = free.indexOf(toId);
  if (from < 0 || to < 0) return plan;
  free.splice(to, 0, free.splice(from, 1)[0]);
  let k = 0;
  const order = stack.order.map((r) => (isPosted(plan, stackId, r) ? r : free[k++]));
  return applyStack({ ...plan, stacks: { ...plan.stacks, [stackId]: { ...stack, order } } }, stackId);
}

// One step up (-1) or down (+1) among the not-yet-posted Reels.
export function nudgeReel(plan, stackId, id, dir) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return plan;
  const free = stack.order.filter((r) => !isPosted(plan, stackId, r));
  const target = free[free.indexOf(id) + dir];
  return target ? moveReel(plan, stackId, id, target) : plan;
}

export function togglePosted(plan, stackId, reelId) {
  const iid = reelItemId(stackId, reelId);
  return { ...plan, items: plan.items.map((it) => (it.id === iid ? { ...it, done: !it.done } : it)) };
}

// Adds (or refreshes) a content plan. Blocks already in the plan are never touched
// again, so edits and deletions survive; Reel texts and details are refreshed.
export function importContentPlan(plan, content) {
  let areas = plan.areas;
  let area = areas.find((a) => a.name.trim().toLowerCase() === content.area.toLowerCase());
  if (!area) {
    const used = areas.map((a) => a.c);
    const free = AREA_COLORS.findIndex((_, i) => !used.includes(i));
    area = { id: uid(), name: content.area, c: free < 0 ? areas.length % AREA_COLORS.length : free };
    areas = [...areas, area];
  }
  const have = new Set(plan.items.map((i) => i.id));
  const fresh = [];
  const sid = content.id;

  (content.items || []).forEach((ev) => {
    const id = `${sid}:${ev.key}`;
    if (have.has(id)) return;
    fresh.push({
      id, area: area.id, text: ev.text, ...(ev.note ? { note: ev.note } : {}), done: false,
      day: ev.day, at: ev.from ? toMinutes(ev.from) : 'any',
      ...(ev.from ? { dur: ev.to ? toMinutes(ev.to) - toMinutes(ev.from) : 60 } : {}),
      stackId: sid, ...(typeof ev.film === 'number' ? { film: ev.film } : {})
    });
  });

  let stacks = plan.stacks || {};
  const s = content.stack;
  if (s) {
    const prev = stacks[sid];
    const reels = {};
    s.reels.forEach((r) => { reels[r.id] = r; });
    const known = prev ? prev.order.filter((id) => reels[id]) : [];
    const order = [...known, ...s.reels.map((r) => r.id).filter((id) => !known.includes(id))];
    stacks = {
      ...stacks,
      [sid]: {
        title: s.title || 'Stack', area: area.id, start: s.start, weekdays: s.weekdays, at: s.at,
        minutes: s.minutes || 30, order, reels
      }
    };
    s.reels.forEach((r) => {
      const id = reelItemId(sid, r.id);
      if (have.has(id)) return;
      fresh.push({
        id, area: area.id, text: `Reel · ${r.short || r.hook || r.title}`, ...(r.title ? { note: r.title } : {}),
        done: false, day: s.start, at: toMinutes(s.at), dur: s.minutes || 30, stackId: sid, reel: r.id
      });
    });
  }

  const merged = applyStack({ ...plan, areas, items: [...plan.items, ...fresh], stacks }, sid);
  return { plan: merged, added: fresh.length, total: (content.items || []).length + (s ? s.reels.length : 0) };
}
