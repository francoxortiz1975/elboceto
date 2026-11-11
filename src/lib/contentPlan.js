// Content plans (e.g. an Instagram plan written by another Claude conversation).
// A plan is a JSON file (format: docs/CONTENT_PLAN_FORMAT.md) that adds an area,
// dated blocks, and a "stack": an ordered list of posts (Reels) whose dates follow
// their position in the stack. Reordering the stack moves the blocks in the
// calendar; posted ones stay where they are.

import { AREA_COLORS, addDays, fromIso, isoOf, uid } from './areaPlan';

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const reelItemId = (stackId, reelId) => `${stackId}:reel:${reelId}`;

// A stack holds one kind of piece: Reels, Stories or Posts. Older stacks have no kind (= Reels).
// `at` is optional: without it the blocks are not tied to a time of day.
export const KINDS = ['reel', 'story', 'post'];
export const KIND_LABEL = { reel: 'Reel', story: 'Story', post: 'Post' };
const KIND_SUFFIX = { reel: '', story: '-stories', post: '-posts' };
const KIND_DAYS = { reel: [2, 5], story: [1, 3, 6], post: [4] };
export const kindOf = (stack) => (stack && stack.kind) || 'reel';
const atOf = (stack) => (stack.at ? toMinutes(stack.at) : 'any');
// The stacks that come from a content-plan file's main "stack" (the Reels).
export const baseStackIds = (plan) => Object.keys((plan && plan.stacks) || {}).filter((id) => kindOf(plan.stacks[id]) === 'reel');
// Each kind's stack (id + stack) for a plan, if it has one.
export const stackOfKind = (plan, kind) => {
  const ids = Object.keys((plan && plan.stacks) || {}).filter((id) => kindOf(plan.stacks[id]) === kind);
  return ids.length ? { id: ids[0], stack: plan.stacks[ids[0]] } : null;
};

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
  for (const key of ['stack', 'stories', 'posts']) {
    const s = c[key];
    if (!s) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.start || '') || (s.at && !/^\d{2}:\d{2}$/.test(s.at))) return `"${key}" necesita "start" (AAAA-MM-DD) y, si lleva hora, "at" (HH:MM).`;
    if (!Array.isArray(s.weekdays) || !s.weekdays.length) return `"${key}" necesita "weekdays" (0 = domingo … 6 = sábado).`;
    if (!Array.isArray(s.reels) || s.reels.some((r) => !r.id)) return `Cada pieza de "${key}" necesita un "id".`;
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
      if (it.reel && it.id in slot) {
        const at = atOf(stack);
        const { dur: _dur, ...rest } = it;
        return { ...rest, day: slotDate(stack, slot[it.id]), at, ...(typeof at === 'number' ? { dur: stack.minutes || 30 } : {}) };
      }
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

// Adds an empty piece (Reel, Story or Post) at the end of the stack (next free slot); returns the new plan and its id.
export function addReel(plan, stackId, name) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return { plan, id: null };
  const label = KIND_LABEL[kindOf(stack)];
  const short = name.trim() || `Nuevo ${label}`;
  const id = `r_${uid().slice(3)}`;
  const reel = { id, short, title: short, script: '', cta: '', caption: '' };
  const at = atOf(stack);
  const item = {
    id: reelItemId(stackId, id), area: stack.area, text: `${label} · ${short}`, note: short, done: false,
    day: stack.start, at, ...(typeof at === 'number' ? { dur: stack.minutes || 30 } : {}), stackId, reel: id
  };
  const next = {
    ...plan,
    items: [...plan.items, item],
    stacks: { ...plan.stacks, [stackId]: { ...stack, order: [...stack.order, id], reels: { ...stack.reels, [id]: reel } } }
  };
  return { plan: applyStack(next, stackId), id };
}

// Changes when a stack publishes (weekdays and/or time of day; `at: ''` = no time) and moves the blocks.
export function setCadence(plan, stackId, patch) {
  const stack = plan.stacks && plan.stacks[stackId];
  if (!stack) return plan;
  const next = { ...stack, ...patch };
  if (!next.at) delete next.at;
  if (!next.weekdays || !next.weekdays.length) return plan;
  return applyStack({ ...plan, stacks: { ...plan.stacks, [stackId]: next } }, stackId);
}

// Starts the stack of a kind (Stories / Posts / Reels) in the social-media area, next to the Reels one.
export function createStack(plan, kind) {
  if (stackOfKind(plan, kind)) return plan;
  const base = baseStackIds(plan)[0];
  const baseStack = base && plan.stacks[base];
  let areas = plan.areas;
  let areaId = baseStack && baseStack.area;
  if (!areaId) {
    let a = areas.find((x) => x.name.trim().toLowerCase() === 'social media');
    if (!a) {
      const used = areas.map((x) => x.c);
      const free = AREA_COLORS.findIndex((_, i) => !used.includes(i));
      a = { id: uid(), name: 'Social Media', c: free < 0 ? areas.length % AREA_COLORS.length : free };
      areas = [...areas, a];
    }
    areaId = a.id;
  }
  const sid = `${base || 'social'}${KIND_SUFFIX[kind]}`;
  const stack = {
    title: `${KIND_LABEL[kind]}s`, kind, area: areaId, start: baseStack ? baseStack.start : isoOf(new Date()),
    weekdays: KIND_DAYS[kind], ...(kind === 'story' ? {} : { at: kind === 'post' ? '12:00' : '19:00' }),
    minutes: kind === 'story' ? 15 : 30, order: [], reels: {}
  };
  return { ...plan, areas, stacks: { ...(plan.stacks || {}), [sid]: stack } };
}

// Stories that an earlier import stored as loose blocks ("<plan>:story-…") become the pieces of a
// Stories stack, so they can be opened, edited, reordered and exported like the Reels.
export function migrateLegacyStories(plan) {
  let out = plan;
  baseStackIds(plan).forEach((sid) => {
    const legacy = out.items.filter((it) => it.stackId === sid && !it.reel && it.id.startsWith(`${sid}:story-`)).sort((a, b) => (a.day < b.day ? -1 : 1));
    if (!legacy.length) return;
    const stId = `${sid}-stories`;
    const prev = out.stacks[stId];
    const days = [...new Set(legacy.map((it) => fromIso(it.day).getDay()))].sort((a, b) => a - b);
    const stack = prev || { title: 'Stories', kind: 'story', area: legacy[0].area, start: legacy[0].day, weekdays: days, minutes: 15, order: [], reels: {} };
    const reels = { ...stack.reels };
    const order = [...stack.order];
    const added = legacy.map((it) => {
      const pid = it.id.slice(sid.length + 1).replace(/^story-/, 's-');
      const short = it.text.replace(/^Stories?:\s*/i, '');
      reels[pid] = { id: pid, short, title: it.text, script: it.note || '', cta: '', caption: '', fromId: it.id };
      if (!order.includes(pid)) order.push(pid);
      return { id: reelItemId(stId, pid), area: it.area, text: `Story · ${short}`, note: it.text, done: !!it.done, day: it.day, at: 'any', stackId: stId, reel: pid };
    });
    const gone = new Set(legacy.map((it) => it.id));
    out = { ...out, items: [...out.items.filter((it) => !gone.has(it.id)), ...added], stacks: { ...out.stacks, [stId]: { ...stack, order, reels } } };
    out = applyStack(out, stId);
  });
  return out;
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
  // Stories that were turned into pieces of a stack must not come back as loose blocks.
  const migrated = new Set(Object.values(plan.stacks || {}).flatMap((st) => Object.values(st.reels).map((r) => r.fromId).filter(Boolean)));

  (content.items || []).forEach((ev) => {
    const id = `${sid}:${ev.key}`;
    const target = ev.area ? areaFor(ev.area) : area;
    const have = byId[id];
    if (migrated.has(id)) return;
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
  const touched = [];
  [['stack', 'reel'], ['stories', 'story'], ['posts', 'post']].forEach(([key, kind]) => {
    const s = content[key];
    if (!s) return;
    const stId = sid + KIND_SUFFIX[kind];
    const stArea = s.area ? areaFor(s.area) : area;
    const prev = stacks[stId];
    const reels = {};
    // `edits` (what you typed in the app) survive a re-import; the file only refreshes the base text.
    s.reels.forEach((r) => { reels[r.id] = { ...r, ...(prev && prev.reels[r.id] && prev.reels[r.id].edits ? { edits: prev.reels[r.id].edits } : {}) }; });
    const known = prev ? prev.order.filter((id) => reels[id]) : [];
    const order = [...known, ...s.reels.map((r) => r.id).filter((id) => !known.includes(id))];
    stacks = {
      ...stacks,
      [stId]: {
        title: s.title || KIND_LABEL[kind] + 's', kind, area: stArea.id, start: s.start, weekdays: s.weekdays,
        ...(s.at ? { at: s.at } : {}), minutes: s.minutes || 30, order, reels
      }
    };
    touched.push(stId);
    const at = s.at ? toMinutes(s.at) : 'any';
    s.reels.forEach((r) => {
      const id = reelItemId(stId, r.id);
      if (byId[id]) return;
      fresh.push({
        id, area: stArea.id, text: `${KIND_LABEL[kind]} · ${r.short || r.hook || r.title}`, ...(r.title ? { note: r.title } : {}),
        done: !!r.posted, day: s.start, at, ...(s.at ? { dur: s.minutes || 30 } : {}), stackId: stId, reel: r.id
      });
    });
  });

  const items = plan.items.map((it) => (moves[it.id] ? { ...it, area: moves[it.id] } : it));
  let merged = { ...plan, areas, items: [...items, ...fresh], stacks };
  touched.forEach((id) => { merged = applyStack(merged, id); });
  merged = migrateLegacyStories(merged);
  return {
    plan: merged,
    added: fresh.length,
    moved: Object.keys(moves).length,
    total: (content.items || []).length + ['stack', 'stories', 'posts'].reduce((n, k) => n + (content[k] ? content[k].reels.length : 0), 0)
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
  const prefix = `${stackId}:`;
  // One stack as the file describes it: pieces in order, edits applied, which ones are posted.
  const stackOut = (id) => {
    const st = plan.stacks[id];
    const posted = new Set(plan.items.filter((it) => it.stackId === id && it.reel && it.done).map((it) => it.reel));
    return {
      title: st.title, ...(st.area !== stack.area ? { area: areaName(st.area) } : {}), start: st.start, weekdays: st.weekdays,
      ...(st.at ? { at: st.at } : {}), minutes: st.minutes,
      reels: st.order.filter((rid) => st.reels[rid]).map((rid) => {
        const { edits, ...base } = st.reels[rid];
        return { ...base, ...(edits || {}), ...(posted.has(rid) ? { posted: true } : {}) };
      })
    };
  };
  const extra = (kind, key) => {
    const id = stackId + KIND_SUFFIX[kind];
    return plan.stacks[id] ? { [key]: stackOut(id) } : {};
  };
  return {
    format: 'boceto-content-plan',
    version: 1,
    id: stackId,
    area: areaName(stack.area),
    stack: stackOut(stackId),
    ...extra('story', 'stories'),
    ...extra('post', 'posts'),
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

