# Nightly reschedule (Fase 4)

What it does each night at 00:00 Paris time (`src/lib/scheduler/rollover.js`):
1. Closes fixed-event blocks of past days (they happened).
2. Generates fixed events and habits for the days ahead (a missed habit block is counted and re-placed the same week).
3. Moves what was planned for a past day and is not done to its next free slot **inside its area's hours**.
   It never touches: locked blocks, meetings, things left on purpose ("Dejar"), or anything with no free slot (those stay in Pendientes).
4. Saves a summary (`plan.scheduler.lastRollover`). The app shows it in Motor > Pendientes with "Deshacer lo que movió".

It runs in two places, and runs once per day (`lastRollover.day`):
- **Server, 00:00 Paris** (`server/rollover.mjs` -> `api/rollover.js`, Vercel cron). Needs the setup below.
- **App, first open of a new day** (safety net; also covers a day when the server did not run).

## Setup (once, in Vercel -> Project -> Settings -> Environment Variables)
| Variable | Value |
|---|---|
| `CRON_SECRET` | any long random text (Vercel sends it to the cron call) |
| `SUPABASE_URL` | `https://<project>.supabase.co` (the existing `VITE_SUPABASE_URL` is also read) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase -> Project Settings -> API -> `service_role` key. Server only: never put it in a `VITE_` variable |
| `BOCETO_TZ` | optional, defaults to `Europe/Paris` |

Redeploy after adding them. To test without waiting for midnight:
`curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/rollover?force=1"`

## Notes
- `vercel.json` calls the function at 22:00 and 23:00 UTC; it only works when it is really the 00:00 hour in `BOCETO_TZ` (summer/winter time).
  On Vercel's Hobby plan a cron may fire anywhere inside its hour, so the work happens between 00:00 and 00:59.
- If the app saves at the same moment, the server re-reads the plan and redoes the work once (version check on `updated_at`).
- `api/rollover.js` is generated: after changing `server/rollover.mjs` or anything in `src/lib/scheduler`, run `npm run api:build`.
  `npm run test:scheduler` fails if the committed bundle is out of date.
