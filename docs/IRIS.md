# IRIS v1: planner + inbox for one conversation per area

IRIS connects two kinds of Claude conversations through the plan itself (`plan.iris.notes`, synced like everything else; no extra table):

- the **centro de mando**: one conversation that knows the calendar, assigns work and answers "how am I doing";
- one **conversation per area** (MediLyft, Loginet…), in that area's repo, that does the heavy work.

Conversations cannot message each other, so they leave notes. What is forced, not remembered: **a Claude Code hook** shows an area's
unread notes when its conversation starts and on every message you send. It never wakes a conversation you are not using.

## What each side can do (MCP tools of El Boceto)
| Who | Tool | What |
|---|---|---|
| hub | `assign_order` | creates the block (day, time, duration, optional lock) and leaves the full brief in the area's inbox |
| hub | `leave_note` | a note for an area (change, context, order without a date) |
| hub | `read_notes` (`for: "hub"`) | progress the areas reported |
| hub | `areas_summary` | one line per area: open, overdue, locked, next block, unread notes |
| area | `report_progress` | tells the hub what happened; `done: true` ticks the block |
| area | `read_notes` / `mark_notes_read` | its notes (the hook already does this) |
| both | `move_item`, `lock_item`, `delete_item`, `resolve_overdue` | each one leaves a "change" note in the affected area |
| automatic | nightly rollover (00:00 Paris) | notes to the areas of everything it moved or left pending |

## Setup on your Mac (once)
1. **MCP of El Boceto** (see `mcp/README.md`): `supabase/mcp_access.sql` in the SQL editor, `npm --prefix mcp install && npm run mcp:build`,
   `npm run mcp:token you@email`, run the printed `insert`, then `claude mcp add --scope user boceto -- node /full/path/to/EL_BOCETO/mcp/dist/server.mjs`.
   After pulling new code, run `npm run mcp:build` again.
2. **Each area's repo** (this adds the two hooks to that repo's private `.claude/settings.local.json`):
   `npm run iris:install -- "MediLyft" /path/to/medilyft` (same for Loginet, School…). The area name must match the one in El Boceto.
3. **The hub**: a folder for the control-center conversation, e.g. `~/IRIS`, with `docs/IRIS_HUB_CLAUDE.md` copied there as `CLAUDE.md`.
   Open Claude Code in that folder; that is your single place to talk about the calendar and to hand out work.

## Day to day
- You (in the hub): "Me enviaron este feature de MediLyft: …" -> the hub checks the calendar, proposes a slot, and after you confirm calls `assign_order`.
- Later you open Claude Code in the MediLyft repo: it starts already knowing the brief, the date and the next blocks of the area.
- When that conversation finishes something it calls `report_progress`; in the hub, "¿cómo voy?" shows it, and Motor -> IRIS in the app lists every note.

## Limits (v1)
- It does not start conversations by itself: you open them (that is IRIS+, next).
- Notes are in the plan: if the app has unsaved edits at the very moment a note arrives, the last save wins; the app reloads on focus.
- The hook needs the MCP config (`~/.config/boceto-mcp/config.json`) on the same computer. With no network it stays silent and does not block anything.
