import { BANDS, addDays, durOf } from './areaPlan';

// Pure helpers that decide what to send to Google Calendar. The plan keeps a
// map of itemId -> { id: googleEventId, hash } in `plan.gcal.map`, so deleting
// an item anywhere in the app is noticed on the next sync (its id is still in
// the map but no longer in the plan) without touching every delete code path.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n) => String(n).padStart(2, '0');
export const MAX_OPS_PER_REQUEST = 25;

// Only dated items with a title go to Google ("Más adelante" items stay in the app).
export const isSyncable = (item) => DATE_RE.test(item.day || '') && !!(item.text || '').trim();

const dateTime = (day, minutes) => {
  let d = day;
  let m = minutes;
  if (m >= 1440) { d = addDays(day, 1); m -= 1440; }
  return `${d}T${pad2(Math.floor(m / 60))}:${pad2(m % 60)}:00`;
};

export function buildEvent(item, area, tz) {
  const lines = [];
  if (area) lines.push(`Área: ${area.name}`);
  const band = BANDS.find((b) => b.id === item.at);
  if (band) lines.push(`Franja: ${band.label}`);
  if (item.note) lines.push(item.note);
  lines.push('Creado en El Boceto');
  const common = { summary: `${item.done ? '✓ ' : ''}${item.text.trim()}`, description: lines.join('\n') };

  if (typeof item.at === 'number') {
    return {
      ...common,
      start: { dateTime: dateTime(item.day, item.at), timeZone: tz },
      end: { dateTime: dateTime(item.day, item.at + durOf(item)), timeZone: tz }
    };
  }
  return { ...common, start: { date: item.day }, end: { date: addDays(item.day, 1) } };
}

export function hashEvent(event) {
  const s = JSON.stringify(event);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// What has to change in Google so that it matches the plan.
export function planSyncOps(plan, tz) {
  const map = (plan.gcal && plan.gcal.map) || {};
  const areaById = Object.fromEntries(plan.areas.map((a) => [a.id, a]));
  const upserts = [];
  const live = new Set();
  plan.items.forEach((item) => {
    if (!isSyncable(item)) return;
    const event = buildEvent(item, areaById[item.area], tz);
    const hash = hashEvent(event);
    live.add(item.id);
    const prev = map[item.id];
    if (!prev || prev.hash !== hash) upserts.push({ key: item.id, gcalId: prev && prev.id, event, hash });
  });
  const deletes = Object.entries(map)
    .filter(([key]) => !live.has(key))
    .map(([key, m]) => ({ key, gcalId: m.id }));
  return { upserts, deletes };
}

// Splits the work into requests the server accepts.
export function chunkOps({ upserts, deletes }, size = MAX_OPS_PER_REQUEST) {
  const all = [...upserts.map((u) => ({ type: 'upsert', op: u })), ...deletes.map((d) => ({ type: 'delete', op: d }))];
  const batches = [];
  for (let i = 0; i < all.length; i += size) {
    const slice = all.slice(i, i + size);
    batches.push({
      upserts: slice.filter((s) => s.type === 'upsert').map((s) => ({ key: s.op.key, gcalId: s.op.gcalId, event: s.op.event })),
      deletes: slice.filter((s) => s.type === 'delete').map((s) => s.op)
    });
  }
  return batches;
}

// Records what the server did. Returns the same plan object when nothing changed.
export function applyResults(plan, { results = [], deleted = [], hashes = {} }) {
  if (!results.length && !deleted.length) return plan;
  const map = { ...((plan.gcal && plan.gcal.map) || {}) };
  results.forEach((r) => { map[r.key] = { id: r.gcalId, hash: hashes[r.key] }; });
  deleted.forEach((key) => { delete map[key]; });
  return { ...plan, gcal: { ...(plan.gcal || {}), map } };
}
