// The waiting logic of `iris-wait`: what to say about one block, given the plan now and what was already said. Pure.
// The hub conversation starts `iris-wait` in the background after it creates an order; it watches the cloud (no tokens while it waits) and
// ends -- which wakes the hub -- when the area is done, the block was missed, or the time limit passed.

const NOTE_MAX = 600;

// seen: Set of note ids already printed. Returns { lines, done, missed } (done = block done; missed = the launcher never opened it).
export function stepWait(plan, itemId, seen = new Set()) {
  const item = (plan.items || []).find((i) => i.id === itemId);
  if (!item) return { lines: [`[IRIS] El bloque ${itemId} ya no existe en El Boceto.`], done: false, missed: true, gone: true };
  const areaName = ((plan.areas || []).find((a) => a.id === item.area) || {}).name || item.area;
  const lines = [];
  const notes = ((plan.iris && plan.iris.notes) || [])
    .filter((n) => n.item === itemId && n.dir === 'to_hub')
    .sort((a, b) => String(a.t || a.at || '').localeCompare(String(b.t || b.at || '')));
  notes.forEach((n) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    const who = n.from === 'launcher' ? 'lanzador' : areaName;
    lines.push(`[IRIS · ${who}] ${String(n.text || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX)}`);
  });
  const state = (item.iris && item.iris.state) || 'pending';
  return { lines, done: !!item.done, missed: state === 'missed', state, text: item.text, areaName };
}

// The line for when the time limit passes with the block still open.
export function timeoutLine(plan, itemId, minutes) {
  const s = stepWait(plan, itemId, new Set(['*']));
  const state = { pending: 'sin arrancar', launched: 'arrancó pero sin informe final', missed: 'se perdió', skipped: 'omitido' }[s.state] || s.state;
  return `[IRIS] Pasaron ${minutes} min y el bloque “${s.text}” de ${s.areaName} no está hecho (${state}). Mira su conversación o pregúntale al área.`;
}
