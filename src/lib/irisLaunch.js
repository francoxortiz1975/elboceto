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
    `Al terminar, o si te bloqueas o tienes una duda, avisa con report_progress(area="${area}", item_id="${item.id}", text="…", done=true si terminó).`
  ].join('\n');
}

// A copy of the plan with the order's state changed (and when).
export function setLaunchState(plan, ids, state, now = new Date().toISOString()) {
  const set = new Set(ids);
  if (!set.size) return plan;
  return { ...plan, items: plan.items.map((i) => (set.has(i.id) && isAutoStart(i) ? { ...i, iris: { ...i.iris, state, at: now } } : i)) };
}

export const LAUNCH_STATE_ES = { pending: 'por abrir', launched: 'abierta', missed: 'perdida', skipped: 'omitida' };

// A link that opens the Claude desktop app on a NEW Code session in `dir` with the message typed in (it is not sent: the app
// never sends by itself, and asks the user to trust the folder first).
export const deepLink = (dir, text) => `claude://code/new?folder=${encodeURIComponent(dir)}&q=${encodeURIComponent(text)}`;
