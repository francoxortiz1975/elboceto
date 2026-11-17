// Three-way merge of the area plan, so the app and the MCP / server job can both write the same cloud row without
// one overwriting the other (the cloud copy gets IRIS notes, "done" ticks and nightly moves while the app is open).
//
//   base   what this device last agreed with the cloud (the plan after its last pull or successful push)
//   local  what this device has now
//   cloud  what the cloud has now
//
// Rule of thumb: a side that did not change something leaves it to the other side; if both changed the same thing, the device
// in the user's hands (local) wins. Notes are never lost: they are united by id, and "read" is sticky.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MAX_NOTES = 300;
const MAX_HISTORY = 500;

// Lists of objects with an id (items, areas, ...).
function mergeById(base, local, cloud) {
  const b = new Map((base || []).map((x) => [x.id, x]));
  const l = new Map((local || []).map((x) => [x.id, x]));
  const c = new Map((cloud || []).map((x) => [x.id, x]));
  const keep = (id) => {
    const bi = b.get(id); const li = l.get(id); const ci = c.get(id);
    if (li && ci) return same(li, bi) ? ci : same(ci, bi) ? li : li;      // untouched on one side: take the other; both: local
    if (li && !ci) return bi && same(li, bi) ? null : li;                  // cloud deleted it: drop it, unless it was edited here
    if (!li && ci) return bi && same(ci, bi) ? null : ci;                  // deleted here: drop it, unless it was edited in the cloud
    return null;
  };
  const out = [];
  const seen = new Set();
  [...(cloud || []), ...(local || [])].forEach((x) => {
    if (seen.has(x.id)) return;
    seen.add(x.id);
    const k = keep(x.id);
    if (k) out.push(k);
  });
  return out;
}

function mergeNotes(local, cloud) {
  const byId = new Map();
  [...(cloud || []), ...(local || [])].forEach((n) => {
    const prev = byId.get(n.id);
    byId.set(n.id, prev ? { ...prev, ...n, read: !!(prev.read || n.read) } : n);
  });
  const all = [...byId.values()].sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0));
  if (all.length <= MAX_NOTES) return all;
  let extra = all.length - MAX_NOTES;
  const drop = new Set();
  all.forEach((n) => { if (extra > 0 && n.read) { drop.add(n.id); extra -= 1; } });
  all.forEach((n) => { if (extra > 0 && !drop.has(n.id)) { drop.add(n.id); extra -= 1; } });
  return all.filter((n) => !drop.has(n.id));
}

function mergeHistory(local, cloud) {
  const key = (h) => `${h.t}|${h.kind}|${h.id || ''}`;
  const seen = new Set();
  const out = [];
  [...(cloud || []), ...(local || [])].forEach((h) => { const k = key(h); if (!seen.has(k)) { seen.add(k); out.push(h); } });
  return out.sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0)).slice(-MAX_HISTORY);
}

// plan.scheduler: settings merge key by key; history is united; "lastRollover" keeps the most recent run.
function mergeScheduler(base, local, cloud) {
  const b = base || {}; const l = local || {}; const c = cloud || {};
  const out = {};
  new Set([...Object.keys(l), ...Object.keys(c)]).forEach((k) => {
    if (k === 'history') out.history = mergeHistory(l.history, c.history);
    else if (k === 'lastRollover') {
      const a = l.lastRollover; const z = c.lastRollover;
      out.lastRollover = !a ? z : !z ? a : (a.day || '') !== (z.day || '') ? ((a.day || '') > (z.day || '') ? a : z) : ((a.t || '') >= (z.t || '') ? a : z);
    } else if (k === 'generated') out.generated = { ...(c.generated || {}), ...(l.generated || {}) };
    else if (k === 'attrs') out.attrs = { ...(c.attrs || {}), ...(l.attrs || {}) };
    else out[k] = same(l[k], b[k]) ? c[k] : l[k];
  });
  Object.keys(out).forEach((k) => { if (out[k] === undefined) delete out[k]; });
  return out;
}

export function mergePlans(base, local, cloud) {
  const b = base || {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
  const out = {};
  keys.forEach((k) => {
    if (k === 'items') out.items = mergeById(b.items, local.items, cloud.items);
    else if (k === 'areas') out.areas = mergeById(b.areas, local.areas, cloud.areas);
    else if (k === 'iris') out.iris = { ...(cloud.iris || {}), ...(local.iris || {}), notes: mergeNotes((local.iris || {}).notes, (cloud.iris || {}).notes) };
    else if (k === 'scheduler') out.scheduler = mergeScheduler(b.scheduler, local.scheduler, cloud.scheduler);
    else out[k] = same(local[k], b[k]) ? cloud[k] : local[k];
  });
  Object.keys(out).forEach((k) => { if (out[k] === undefined) delete out[k]; });
  return out;
}
