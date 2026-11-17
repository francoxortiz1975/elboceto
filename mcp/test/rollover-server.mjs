// The server job against a fake Supabase REST (in memory): reads area_plans, runs the rollover, writes back with a version check.
import { runRollover, localParts } from '../../server/rollover.mjs';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
let currentKey = 'sb_secret_abc';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc', BOCETO_TZ: 'Europe/Paris' };
const plan = () => ({ areas: [{ id: 'm', name: 'MediLyft', c: 3 }], hidden: [], scheduler: { profile: { meals: [{ name: 'Cena', start: '19:30', dur: 45, on: true }], open: [true, true, true, true, true, true, true] }, areaRules: { m: { from: '21:00', to: '22:00' } } },
  items: [{ id: 'a', area: 'm', text: 'Feature de ayer', done: false, day: '2026-11-17', at: 1260, dur: 60 }] });
let db, conflictOnce, calls;
const fake = async (url, init = {}) => {
  calls.push(`${init.method || 'GET'} ${url.replace('https://x.supabase.co/rest/v1/', '')}`);
  const h = init.headers || {}; const key = currentKey;
  if (!(h.apikey === key && (key.startsWith('eyJ') ? h.Authorization === `Bearer ${key}` : h.Authorization === undefined))) return { ok: false, status: 401, json: async () => ({}) };
  const u = new URL(url);
  if ((init.method || 'GET') === 'GET') {
    const f = u.searchParams.get('user_id');
    return { ok: true, status: 200, json: async () => db.rows.filter((r) => !f || `eq.${r.user_id}` === f).map((r) => ({ ...r })) };
  }
  const uid = u.searchParams.get('user_id').slice(3); const ver = u.searchParams.get('updated_at').slice(3);
  const row = db.rows.find((r) => r.user_id === uid);
  if (conflictOnce) { conflictOnce = false; db.n++; row.updated_at = `2026-11-18T00:00:0${db.n}.000000+00:00`; row.plan = { ...row.plan, items: [...row.plan.items, { id: 'edited', area: 'm', text: 'editada a la vez', done: false, day: '2026-11-25', at: 'any' }] }; }
  if (!row || row.updated_at !== ver) return { ok: true, status: 200, json: async () => [] };
  db.n++; row.plan = JSON.parse(init.body).plan; row.updated_at = `2026-11-18T00:00:0${db.n}.000000+00:00`;
  return { ok: true, status: 200, json: async () => [{ ...row }] };
};
const fresh = () => { db = { n: 0, rows: [{ user_id: 'u1', plan: plan(), updated_at: '2026-11-17T20:00:00.000000+00:00' }] }; conflictOnce = false; calls = []; };

ok(JSON.stringify(localParts(new Date('2026-11-17T23:10:00Z'), 'Europe/Paris')) === '{"day":"2026-11-18","hour":0}', 'winter: 23:10 UTC is 00:10 in Paris, day 18');
ok(JSON.stringify(localParts(new Date('2026-07-17T22:10:00Z'), 'Europe/Paris')) === '{"day":"2026-07-18","hour":0}', 'summer: 22:10 UTC is 00:10 in Paris');
fresh();
let r = await runRollover({ env, now: new Date('2026-11-17T22:10:00Z'), fetchFn: fake });
ok(r.body.skipped && calls.length === 0, '22:10 UTC in winter (23:10 Paris): skipped, nothing read');
r = await runRollover({ env, now: new Date('2026-11-17T23:10:00Z'), fetchFn: fake });
ok(r.status === 200 && r.body.day === '2026-11-18' && r.body.users[0].ran && r.body.users[0].moved === 1, 'at 00:10 Paris it runs and moves the overdue task');
const a = db.rows[0].plan.items.find((i) => i.id === 'a');
ok(a.day >= '2026-11-18' && a.at === 1260, 'the plan saved in the database has the task at its 21:00 slot');
ok(db.rows[0].plan.scheduler.lastRollover.day === '2026-11-18', 'lastRollover is saved (so the app and a second cron call know)');
const before = JSON.stringify(db.rows[0]);
r = await runRollover({ env, now: new Date('2026-11-17T23:50:00Z'), fetchFn: fake });
ok(r.body.users[0].ran === false && JSON.stringify(db.rows[0]) === before, 'second call the same night changes nothing');
fresh(); conflictOnce = true;
r = await runRollover({ env, now: new Date('2026-11-17T23:10:00Z'), fetchFn: fake });
const p2 = db.rows[0].plan;
ok(r.body.users[0].ran && p2.items.some((i) => i.id === 'edited') && p2.scheduler.lastRollover.day === '2026-11-18', 'if the app saved at the same moment, it re-reads and keeps that edit');
fresh();
r = await runRollover({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: '' }, now: new Date(), fetchFn: fake });
ok(r.status === 500, 'missing key: clear error');
fresh();
r = await runRollover({ env, now: new Date('2026-11-17T12:00:00Z'), force: true, fetchFn: fake });
ok(r.body.users[0].ran, 'force=1 works at any hour');
// with the default Perfil (dinner 20:30-21:15) the 21:00 slot is taken: the task stays for the user, and says why
fresh(); db.rows[0].plan.scheduler.profile = { open: [true, true, true, true, true, true, true] };
r = await runRollover({ env, now: new Date('2026-11-17T23:10:00Z'), fetchFn: fake });
ok(r.body.users[0].moved === 0 && db.rows[0].plan.scheduler.lastRollover.left[0].why === 'sin hueco en 21:00–22:00', 'dinner covering the area hours: nothing moved, reason names the hours');
// the legacy service_role key is a JWT: it must go in both headers
fresh(); currentKey = 'eyJhbGciOi.legacy.key';
r = await runRollover({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: currentKey }, now: new Date('2026-11-17T23:10:00Z'), fetchFn: fake });
ok(r.body.users && r.body.users[0].ran, 'legacy service_role key (JWT): sent as apikey and Bearer');
r = await runRollover({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }, now: new Date('2026-11-17T23:10:00Z'), force: true, fetchFn: fake });
ok(r.status === 502, 'a key the project does not accept gives a clear error, not a crash');
