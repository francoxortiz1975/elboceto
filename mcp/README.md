# El Boceto MCP server

Lets any Claude Code conversation read and edit your planner (the same plan the app shows).

## Setup (once)
1. In the Supabase SQL editor of the El Boceto project, run `supabase/mcp_access.sql`.
2. `npm --prefix mcp install && npm run mcp:build`
3. `npm run mcp:token you@example.com` → saves the token in `~/.config/boceto-mcp/config.json`
   and prints one `insert` statement. Paste it in the SQL editor and run it.
4. `claude mcp add --scope user boceto -- node /full/path/to/EL_BOCETO/mcp/dist/server.mjs`

Revoke: `update public.mcp_tokens set revoked_at = now() where label = 'claude-code';`

## Tools
`get_today`, `get_range`, `get_overdue`, `list_backlog`, `list_areas`, `add_item`, `move_item`,
`complete_item`, `edit_item`, `delete_item`, `import_content_plan`, and the scheduler tools (same engine as the
app's Motor tab): `get_overdue_proposals`, `resolve_overdue` (accept / move / done / later / skip, logged in
`plan.scheduler.history` with `by: claude`), `get_scheduler_settings`.

## How it works
It calls two Postgres functions (`mcp_plan_get`, `mcp_plan_set`) with the personal token; only the
token's hash is stored. A write only succeeds if the plan hasn't changed since it was read (the server
retries once). The app picks the change up when you open it or come back to the tab. It reuses
`src/lib/areaPlan.js` and `src/lib/contentPlan.js`, so Reels/Stories behave as in the app.

`npm --prefix mcp test` runs the server against a fake Supabase in memory.
