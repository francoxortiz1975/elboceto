// Vercel cron function: the nightly reschedule, at 00:00 Paris time.
//
// Vercel cron runs in UTC and (on the Hobby plan) anywhere inside the scheduled hour, so vercel.json calls this twice a day
// (22:00 and 23:00 UTC, which are 00:00 Paris in summer and in winter). The function only does the work when it is
// really the 00:00 hour in BOCETO_TZ; the other call returns "skipped". Running twice in the same night is harmless:
// the plan remembers that today's reschedule already ran.
//
// Environment variables (Vercel -> Settings -> Environment Variables):
//   CRON_SECRET                 any long random text; Vercel sends it as "Authorization: Bearer ..." on cron calls
//   SUPABASE_URL                https://<project>.supabase.co   (VITE_SUPABASE_URL also works)
//   SUPABASE_SERVICE_ROLE_KEY   the project's service_role key (server only, never in the app)
//   BOCETO_TZ                   optional, default Europe/Paris
//
// GET /api/rollover            (cron)   -> work only if it is the 00:00 hour
// GET /api/rollover?force=1    (manual) -> work now, same authorization; handy to test

import { rollover } from '../src/lib/scheduler/rollover';

// Calendar date and hour in a time zone (en-CA gives YYYY-MM-DD).
export function localParts(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const rest = (env, path, init = {}, fetchFn = fetch) => fetchFn(`${(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
});

// Does the whole job. `fetchFn`, `now` and `env` are parameters so it can be tested without a network.
export async function runRollover({ env, now = new Date(), force = false, fetchFn = fetch }) {
  if (!(env.SUPABASE_URL || env.VITE_SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.' } };
  const tz = env.BOCETO_TZ || 'Europe/Paris';
  const { day, hour } = localParts(now, tz);
  if (!force && hour !== 0) return { status: 200, body: { skipped: 'No es la hora de las 00:00.', tz, hour } };

  const list = await rest(env, 'area_plans?select=user_id,plan,updated_at', {}, fetchFn);
  if (!list.ok) return { status: 502, body: { error: `Supabase respondió ${list.status} al leer los planes.` } };
  const rows = await list.json();
  const out = [];
  for (const row of rows) {
    let cur = row;
    let result = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const r = rollover(cur.plan, day, { nowMin: 0, by: 'auto', now: now.toISOString(), force: false });
      if (!r.ran) { result = { user: row.user_id, ran: false }; break; }
      // Write only if the plan has not changed since it was read (the app may be saving at the same time).
      const res = await rest(env, `area_plans?user_id=eq.${row.user_id}&updated_at=eq.${encodeURIComponent(cur.updated_at)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ plan: r.plan })
      }, fetchFn);
      const written = res.ok ? await res.json() : null;
      if (written && written.length) { result = { user: row.user_id, ran: true, moved: r.summary.moves.length, left: r.summary.left.length, habitsAdded: r.summary.habitsAdded, habitsMissed: r.summary.habitsMissed }; break; }
      // The plan changed while we worked (or the write failed): read it again and redo the work once.
      const again = await rest(env, `area_plans?select=user_id,plan,updated_at&user_id=eq.${row.user_id}`, {}, fetchFn);
      const fresh = again.ok ? await again.json() : [];
      if (!fresh.length) break;
      cur = fresh[0];
    }
    out.push(result || { user: row.user_id, ran: false, error: 'conflict' });
  }
  return { status: 200, body: { day, tz, users: out } };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) { res.status(401).json({ error: 'No autorizado.' }); return; }
  try {
    const force = String((req.query && req.query.force) || '') === '1';
    const r = await runRollover({ env: process.env, force });
    res.status(r.status).json(r.body);
  } catch (e) {
    console.error('rollover failed', e);
    res.status(500).json({ error: 'El reagendamiento falló.' });
  }
}
