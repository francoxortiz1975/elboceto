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

// The text of a Reel as shown: the file's text with the edits made in the app on top.
export const reelText = (r) => ({ ...r, ...(r.edits || {}) });

// Saves what was typed for a Reel (script / cta / caption) without touching the imported base text.
export function editReel(plan, stackId, reelId, patch) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack || !stack.reels[reelId]) return plan;
  const r = stack.reels[reelId];
  return {
    ...plan,
    stacks: { ...plan.stacks, [stackId]: { ...stack, reels: { ...stack.reels, [reelId]: { ...r, edits: { ...(r.edits || {}), ...patch } } } } }
  };
}

// Adds an empty Reel at the end of the stack (next free slot); returns the new plan and the Reel id.
export function addReel(plan, stackId, name) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return { plan, id: null };
  const short = name.trim() || 'Nuevo Reel';
  const id = `r_${uid().slice(3)}`;
  const reel = { id, short, title: short, script: '', cta: '', caption: '' };
  const item = {
    id: reelItemId(stackId, id), area: stack.area, text: `Reel · ${short}`, note: short, done: false,
    day: stack.start, at: toMinutes(stack.at), dur: stack.minutes || 30, stackId, reel: id
  };
  const next = {
    ...plan,
    items: [...plan.items, item],
    stacks: { ...plan.stacks, [stackId]: { ...stack, order: [...stack.order, id], reels: { ...stack.reels, [id]: reel } } }
  };
  return { plan: applyStack(next, stackId), id };
}

// Opens the script panel of a Reel from anywhere (stack card, week, month, day, board).
export const openReel = (item) => {
  if (item && item.reel && item.stackId) window.dispatchEvent(new CustomEvent('boceto:open-reel', { detail: { stackId: item.stackId, reelId: item.reel } }));
};

export function togglePosted(plan, stackId, reelId) {
  const iid = reelItemId(stackId, reelId);
  return { ...plan, items: plan.items.map((it) => (it.id === iid ? { ...it, done: !it.done } : it)) };
}

// Adds (or refreshes) a content plan. Blocks already in the plan are never touched
// again, so edits and deletions survive; Reel texts and details are refreshed.
export function importContentPlan(plan, content) {
  let areas = plan.areas;
  // Finds an area by name (case-insensitive) or creates it with a free color.
  const areaFor = (name) => {
    let a = areas.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
    if (!a) {
      const used = areas.map((x) => x.c);
      const free = AREA_COLORS.findIndex((_, i) => !used.includes(i));
      a = { id: uid(), name, c: free < 0 ? areas.length % AREA_COLORS.length : free };
      areas = [...areas, a];
    }
    return a;
  };
  const area = areaFor(content.area);
  const sid = content.id;
  const byId = Object.fromEntries(plan.items.map((i) => [i.id, i]));
  const fresh = [];
  const moves = {}; // blocks still in the plan's main area that the file now puts in another one

  (content.items || []).forEach((ev) => {
    const id = `${sid}:${ev.key}`;
    const target = ev.area ? areaFor(ev.area) : area;
    const have = byId[id];
    if (have) {
      if (have.stackId === sid && have.area === area.id && target.id !== area.id) moves[id] = target.id;
      return;
    }
    fresh.push({
      id, area: target.id, text: ev.text, ...(ev.note ? { note: ev.note } : {}), done: false,
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
    // `edits` (what you typed in the app) survive a re-import; the file only refreshes the base text.
    s.reels.forEach((r) => { reels[r.id] = { ...r, ...(prev && prev.reels[r.id] && prev.reels[r.id].edits ? { edits: prev.reels[r.id].edits } : {}) }; });
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
      if (byId[id]) return;
      fresh.push({
        id, area: area.id, text: `Reel · ${r.short || r.hook || r.title}`, ...(r.title ? { note: r.title } : {}),
        done: !!r.posted, day: s.start, at: toMinutes(s.at), dur: s.minutes || 30, stackId: sid, reel: r.id
      });
    });
  }

  const items = plan.items.map((it) => (moves[it.id] ? { ...it, area: moves[it.id] } : it));
  const merged = applyStack({ ...plan, areas, items: [...items, ...fresh], stacks }, sid);
  return {
    plan: merged,
    added: fresh.length,
    moved: Object.keys(moves).length,
    total: (content.items || []).length + (s ? s.reels.length : 0)
  };
}

const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// The plan as it is now, in the same file format it was imported from: Reels in stack order
// with the edits made in the app applied, and which ones are posted. This is what goes back
// to the conversation that writes the content.
export function exportContentPlan(plan, stackId) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return null;
  const areaName = (id) => (plan.areas.find((a) => a.id === id) || {}).name;
  const own = plan.items.filter((it) => it.stackId === stackId);
  const posted = new Set(own.filter((it) => it.reel && it.done).map((it) => it.reel));
  const prefix = `${stackId}:`;
  return {
    format: 'boceto-content-plan',
    version: 1,
    id: stackId,
    area: areaName(stack.area),
    stack: {
      title: stack.title, start: stack.start, weekdays: stack.weekdays, at: stack.at, minutes: stack.minutes,
      reels: stack.order.filter((id) => stack.reels[id]).map((id) => {
        const { edits, ...base } = stack.reels[id];
        return { ...base, ...(edits || {}), ...(posted.has(id) ? { posted: true } : {}) };
      })
    },
    items: own.filter((it) => !it.reel).map((it) => ({
      key: it.id.startsWith(prefix) ? it.id.slice(prefix.length) : it.id,
      day: it.day,
      ...(typeof it.at === 'number' ? { from: fmtMin(it.at), to: fmtMin(it.at + durOfItem(it)) } : {}),
      text: it.text,
      ...(it.note ? { note: it.note } : {}),
      ...(it.area !== stack.area ? { area: areaName(it.area) } : {}),
      ...(typeof it.film === 'number' ? { film: it.film } : {})
    }))
  };
}
const durOfItem = (it) => it.dur || 60;

