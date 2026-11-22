// IRIS+: opens an area's conversation by itself when a block with an order starts.
// A block with `iris: { launch: true, state }` is an order to start automatically; state: pending -> launched | missed | skipped.
// The block's own time is the trigger, so when the planner moves the block the start moves with it.
// This file is the pure logic (what is due, what to say); mcp/src/iris-launcher.mjs does the opening on the Mac.

import { durOf, fmtMin, isoOf } from './areaPlan';
import { notesOf } from './iris';

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export const isAutoStart = (it) => !!(it && it.iris && it.iris.launch === true);
export const stateOf = (it) => (it.iris && it.iris.state) || 'pending';

// now: a Date (local time). areas: { "MediLyft": "/path/to/repo", ... } (area name, case-insensitive).
// Returns { due: [items to open now], missed: [items whose time passed without opening], noDir: [items due but their area has no folder] }.
export function findDue(plan, now, areas = {}) {
  const today = isoOf(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dirOf = (areaId) => {
    const a = plan.areas.find((x) => x.id === areaId);
    if (!a) return null;
    const key = Object.keys(areas).find((k) => k.trim().toLowerCase() === a.name.trim().toLowerCase());
    return key ? areas[key] : null;
  };
  const due = []; const missed = []; const noDir = [];
  plan.items.forEach((it) => {
    if (!isAutoStart(it) || it.done || stateOf(it) !== 'pending' || !isoRe.test(it.day || '') || typeof it.at !== 'number') return;
    const end = it.at + durOf(it);
    const past = it.day < today || (it.day === today && nowMin >= end);
    if (past) { missed.push(it); return; }
    if (it.day === today && nowMin >= it.at) {
      const dir = dirOf(it.area);
      if (dir) due.push({ item: it, dir }); else noDir.push(it);
    }
  });
  return { due, missed, noDir };
}

// Batching: blocks of the SAME area that start soon after the one that is due now run in the SAME conversation turn (one cold cache, not one per block).
// lead: the due item. Returns up to max-1 other pending auto-start blocks of that area that start within windowMin minutes after it, in time order.
const absMin = (it) => Date.parse(`${it.day}T00:00:00Z`) / 60000 + it.at;
export function findCompanions(plan, lead, { windowMin = 180, max = 3 } = {}) {
  // An explicit batch (chosen by the user in the Desarrollo tab): every pending block of that batch rides along, whatever the hour.
  if (lead.iris && lead.iris.batch) {
    return plan.items
      .filter((it) => it.id !== lead.id && isAutoStart(it) && it.iris.batch === lead.iris.batch && !it.done && stateOf(it) === 'pending')
      .sort((a, b) => (a.day + String(a.at).padStart(5, '0')).localeCompare(b.day + String(b.at).padStart(5, '0')))
      .slice(0, 5);
  }
  if (!isoRe.test(lead.day || '') || typeof lead.at !== 'number' || max < 2) return [];
  const t0 = absMin(lead);
  return plan.items
    .filter((it) => it.id !== lead.id && it.area === lead.area && isAutoStart(it) && !it.done && stateOf(it) === 'pending' && isoRe.test(it.day || '') && typeof it.at === 'number'
      && absMin(it) > t0 && absMin(it) <= t0 + windowMin)
    .sort((a, b) => absMin(a) - absMin(b))
    .slice(0, max - 1);
}
// Is this start time "night" (default 21:00-07:00)? Batching is meant for the late-night runs.
export const isNight = (at, from = 21 * 60, to = 7 * 60) => (from > to ? at >= from || at < to : at >= from && at < to);

// Blocks that were opened by IRIS+ and have since been ticked as done, but nobody reported yet. The conversation is supposed to call
// report_progress; when it cannot (an older MCP loaded), the launcher reports for it so the hub never misses a finished order.
export const findFinished = (plan) => plan.items.filter((i) => isAutoStart(i) && stateOf(i) === 'launched' && i.done && !i.iris.reported);
export const markReported = (plan, ids) => {
  const set = new Set(ids);
  return set.size ? { ...plan, items: plan.items.map((i) => (set.has(i.id) ? { ...i, iris: { ...i.iris, reported: true } } : i)) } : plan;
};

// The order text the hub left for this block (kind 'order', linked by item id); newest wins.
export function orderBrief(plan, item) {
  const n = notesOf(plan).filter((x) => x.item === item.id && x.kind === 'order' && x.dir === 'to_area').pop();
  return n ? n.text : '';
}

// max: the longest brief to put inside the message. A long order is cut: the full text is in the area's IRIS inbox,
// which the hook shows when the conversation starts, so nothing is lost (and a link to the app stays short enough).
export function launchPrompt(plan, item, { max = 1500 } = {}) {
  const area = (plan.areas.find((a) => a.id === item.area) || {}).name || item.area;
  let brief = orderBrief(plan, item) || `(El centro de mando no dejó detalle. Mira tu buzón y los bloques de tu área.)`;
  if (brief.length > max) brief = `${brief.slice(0, max).trimEnd()}…\n(El encargo sigue; está completo en tu buzón de IRIS, que ya se te muestra al empezar.)`;
  return [
    `Eres la conversación del área ${area} de IRIS. Ahora empieza el bloque "${item.text}" (${fmtMin(item.at)}–${fmtMin(item.at + durOf(item))}).`,
    '',
    'Encargo del centro de mando:',
    brief,
    '',
    'Empieza ahora. Primero confirma en una línea qué vas a hacer (tu buzón de IRIS ya te lo muestra el hook).',
    'Trabaja en una rama, sin desplegar ni publicar nada, y pide confirmación antes de cualquier cosa destructiva.',
    `Al terminar, o si te bloqueas o tienes una duda, avisa con report_progress(area="${area}", item_id="${item.id}", text="…", done=true si terminó).`,
    'Si no tienes la herramienta report_progress, marca el bloque como hecho con complete_item y cuenta el resultado en tu respuesta: IRIS avisará al centro de mando.'
  ].join('\n');
}

// A copy of the plan with the order's state changed (and when).
export function setLaunchState(plan, ids, state, now = new Date().toISOString()) {
  const set = new Set(ids);
  if (!set.size) return plan;
  return { ...plan, items: plan.items.map((i) => (set.has(i.id) && isAutoStart(i) ? { ...i, iris: { ...Object.fromEntries(Object.entries(i.iris).filter(([k]) => k !== 'ended')), state, at: now } } : i)) };
}

export const LAUNCH_STATE_ES = { pending: 'por abrir', launched: 'abierta', missed: 'perdida', skipped: 'omitida' };

// A link that opens the Claude desktop app on a NEW Code session in `dir` with the message typed in (it is not sent: the app
// never sends by itself, and asks the user to trust the folder first).
export const deepLink = (dir, text) => `claude://code/new?folder=${encodeURIComponent(dir)}&q=${encodeURIComponent(text)}`;

// A launched block whose run has finished without the block being done (the area left it open on purpose, or it stopped).
// `ended` is stamped by the launcher once nothing is working on the conversation any more.
export const runEnded = (it) => !!(it && it.iris && it.iris.ended);
export const staleLaunched = (plan, now = Date.now(), graceMs = 180000) =>
  plan.items.filter((i) => isAutoStart(i) && stateOf(i) === 'launched' && !i.done && !i.iris.ended && i.iris.at && now - Date.parse(i.iris.at) > graceMs);
export const markEnded = (plan, ids, now = new Date().toISOString()) => {
  const set = new Set(ids);
  return set.size ? { ...plan, items: plan.items.map((i) => (set.has(i.id) && isAutoStart(i) ? { ...i, iris: { ...i.iris, ended: now } } : i)) } : plan;
};
