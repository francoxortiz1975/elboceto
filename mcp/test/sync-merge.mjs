import { mergePlans } from '../../src/lib/areaPlanMerge.js';
import { savePlan } from '../../src/lib/areaPlanSyncCore.js';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const it = (id, extra = {}) => ({ id, area: 'l', text: id, done: false, day: '2026-11-18', at: 'any', ...extra });
const note = (id, extra = {}) => ({ id, t: `2026-11-17T23:${id.slice(1).padStart(2, '0')}:00Z`, area: 'l', dir: 'to_area', kind: 'note', text: id, from: 'hub', read: false, ...extra });
const P0 = { areas: [{ id: 'l', name: 'Loginet', c: 5 }], hidden: [], items: [it('a'), it('b'), it('c'), it('d'), it('e')], scheduler: { habits: [], history: [] } };

// the situation from the phone: the app kept an old copy while the MCP wrote notes and ticked a block
const cloud = { ...P0, items: P0.items.map((x) => (x.id === 'a' ? { ...x, done: true } : x)), iris: { notes: [note('n1'), note('n2'), note('n3', { dir: 'to_hub', kind: 'report', from: 'area' })] } };
const local = { ...P0, items: P0.items.map((x) => (x.id === 'b' ? { ...x, day: '2026-11-20', at: 1260, dur: 60 } : x)) };
let m = mergePlans(P0, local, cloud);
ok(m.iris.notes.length === 3, 'the notes the MCP wrote are kept');
ok(m.items.find((x) => x.id === 'a').done === true, 'the block the MCP ticked stays ticked');
ok(m.items.find((x) => x.id === 'b').day === '2026-11-20', 'and the edit made in the app is kept too');
ok(m.items.length === 5 && m.areas.length === 1, 'nothing duplicated');

// both sides changed the same thing: the device in the user's hands wins
m = mergePlans(P0, { ...P0, items: P0.items.map((x) => (x.id === 'a' ? { ...x, text: 'local' } : x)) }, { ...P0, items: P0.items.map((x) => (x.id === 'a' ? { ...x, text: 'cloud' } : x)) });
ok(m.items.find((x) => x.id === 'a').text === 'local', 'same block edited on both sides: local wins');
// additions and deletions
m = mergePlans(P0, { ...P0, items: [...P0.items.filter((x) => x.id !== 'd'), it('new-local')] }, { ...P0, items: [...P0.items.filter((x) => x.id !== 'c'), it('new-cloud')] });
const ids = m.items.map((x) => x.id).sort().join(',');
ok(ids === 'a,b,e,new-cloud,new-local', 'additions from both sides are kept; a block deleted on one side (unchanged on the other) stays deleted');
m = mergePlans(P0, { ...P0, items: P0.items.filter((x) => x.id !== 'e') }, { ...P0, items: P0.items.map((x) => (x.id === 'e' ? { ...x, done: true } : x)) });
ok(m.items.some((x) => x.id === 'e' && x.done), 'deleted here but ticked in the cloud: it is kept (never lose work silently)');
// notes: read is sticky, union by id
m = mergePlans(P0, { ...P0, iris: { notes: [note('n1', { read: false }), note('n9')] } }, { ...P0, iris: { notes: [note('n1', { read: true })] } });
ok(m.iris.notes.length === 2 && m.iris.notes.find((n) => n.id === 'n1').read === true, 'a note read on one side is read after the merge');
// scheduler: history united, lastRollover the most recent, settings by who changed them
const h = (t, id) => ({ t, kind: 'apply', id });
m = mergePlans({ ...P0, scheduler: { habits: [], history: [], areaRules: {} } },
  { ...P0, scheduler: { habits: [{ id: 'g' }], history: [h('2026-11-17T10:00:00Z', 'x')], areaRules: {}, lastRollover: { day: '2026-11-17', t: 'a' } } },
  { ...P0, scheduler: { habits: [], history: [h('2026-11-17T10:00:00Z', 'x'), h('2026-11-17T11:00:00Z', 'y')], areaRules: { l: { from: '21:00' } }, lastRollover: { day: '2026-11-18', t: 'b' } } });
ok(m.scheduler.history.length === 2, 'history is united without duplicates');
ok(m.scheduler.lastRollover.day === '2026-11-18', 'lastRollover keeps the most recent run');
ok(m.scheduler.habits.length === 1 && m.scheduler.areaRules.l.from === '21:00', 'settings: what only the app changed (habits) and what only the cloud changed (area rules) both survive');
ok(JSON.stringify(mergePlans(P0, cloud, cloud)) === JSON.stringify(cloud), 'merging identical copies changes nothing');
// first sync of a device (no base): nothing from either side is lost
m = mergePlans(null, { ...P0, items: [it('only-local')] }, { ...P0, items: [it('only-cloud')], iris: { notes: [note('n1')] } });
ok(m.items.length === 2 && m.iris.notes.length === 1, 'first sync (no common ancestor): items from both sides and the notes are kept');

// a fake cloud row with a version, written by two parties
const mkCloud = (plan) => { const c = { plan, v: 1 }; return {
  c,
  api: {
    push: async (p, expected) => { if (expected && expected !== `v${c.v}`) return { ok: false, conflict: true }; c.plan = p; c.v += 1; return { ok: true, updatedAt: `v${c.v}` }; },
    pull: async () => ({ plan: c.plan, updatedAt: `v${c.v}` })
  },
  mcpWrite: (fn) => { c.plan = fn(c.plan); c.v += 1; }
}; };
{
  const f = mkCloud(P0);                                   // app and cloud agree at v1
  f.mcpWrite((p) => ({ ...p, iris: { notes: [note('n1'), note('n2')] }, items: p.items.map((x) => (x.id === 'a' ? { ...x, done: true } : x)) })); // the MCP writes (v2)
  const edited = { ...P0, items: P0.items.map((x) => (x.id === 'c' ? { ...x, text: 'editado en la app' } : x)) };
  let r = await savePlan({ plan: edited, expected: 'v1', base: P0, api: f.api });
  ok(r.status === 'merged' && f.c.v === 2, 'the app saves with an old copy: it is NOT written over the cloud; it gets a merge instead');
  ok(r.plan.iris.notes.length === 2 && r.plan.items.find((x) => x.id === 'a').done && r.plan.items.find((x) => x.id === 'c').text === 'editado en la app', 'the merge has the MCP notes, the ticked block and the app edit');
  r = await savePlan({ plan: r.plan, expected: r.cloudUpdatedAt, base: P0, api: f.api });
  ok(r.status === 'pushed' && f.c.plan.iris.notes.length === 2 && f.c.plan.items.find((x) => x.id === 'c').text === 'editado en la app', 'saving the merge succeeds and the cloud ends with everything');
}
{
  const f = mkCloud(P0);
  let r = await savePlan({ plan: P0, expected: 'v1', base: P0, api: f.api });
  ok(r.status === 'pushed', 'no conflict: a plain save');
  const gone = { c: { plan: null, v: 1 }, api: { push: async (p, e) => (e ? { ok: false, conflict: true } : { ok: true, updatedAt: 'v2' }), pull: async () => null } };
  r = await savePlan({ plan: P0, expected: 'v1', base: P0, api: gone.api });
  ok(r.status === 'pushed', 'the cloud row is gone: it is created again, nothing is lost');
}
