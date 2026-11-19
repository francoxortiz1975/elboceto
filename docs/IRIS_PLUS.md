# IRIS+: orders that reach the area's EXISTING conversation

A block of the calendar can carry an **order that starts by itself**. When the block's time arrives, a small launcher on your Mac wakes the area's conversation.
Each area keeps one long conversation that already knows its repo, so IRIS+ **continues that one** instead of opening a new conversation that has to re-learn everything
(that is what burned tokens). What happens at the block's time depends on the area's **mode**:

| mode | what happens | needs |
|---|---|---|
| **resume** (default when a conversation is pinned) | A Terminal window runs `claude --resume <id> "<message>"`: the SAME conversation (same id, same history). The full order is in the IRIS inbox; the hook shows it. | the area's conversation pinned (`npm run iris:pin`) and the `claude` command logged in (`/login`) |
| **notify** (default otherwise) | A macOS notification: *"Empieza X. Escribe «ok» en la conversación de Loginet"*. Nothing opens. You type "ok" in the conversation you already use (app or terminal) and its hook delivers the order. | nothing |
| `app` | A NEW Code session in the Claude desktop app through a `claude://` link (you press Enter). | opt-in per area |
| `terminal` | A NEW conversation in Terminal (`claude "<order>"`). | opt-in per area; `claude` logged in |

`resume` falls back to `notify` when the pinned conversation does not exist or **is in use right now** (its transcript changed in the last 2 minutes, or a `claude` process was
started with its id): two windows must never write into one history. A conversation that is open but idle in the desktop app cannot be detected, so keep an area's chat in ONE place.
It never opens a brand-new conversation unless you ask for `app` / `terminal`.

```
hub: assign_order(...)  ->  block 21:00 + brief in the area inbox, marked "abre sola" BY DEFAULT (for a task with an exact day and time, in an area with a registered folder)
launcher (every minute) -> 21:00 -> resume: Terminal -> claude --resume <id> "IRIS: empieza el bloque X ... lee tu buzón"
                                 -> notify: macOS notification -> you type "ok" in the area's conversation
area conversation -> works -> report_progress(...)  ->  note + block done, visible in Motor > IRIS
```
Because the block's own time is the trigger, if the planner moves the block (nightly reschedule, you drag it) the start moves with it.

## What it does and does not do
- Opens the conversation at the block's start, or late **while the block is still running** (e.g. the Mac woke up late). After the block ends it is marked *perdida*, never opened late, and the hub gets a note.
- Several blocks at the same time open several windows (4 s apart, at most 3 per pass).
- It never skips permission prompts, deploys, publishes or sends anything. The first message tells the conversation to work on a branch.
- In `resume` and `notify` the order is not in the message at all: it is the area's IRIS inbox note, shown in full by the hook. (`app` / `terminal` cut a very long order to ~1500 characters.)
- It needs the Mac **on and logged in** (screen locked is fine). Asleep, it runs when the Mac wakes.
- Another way to open: put a script path in `~/.config/boceto-mcp/iris-areas.json` as `"opener"`; it is called with `<folder> <prompt file>`.

## Setup on the Mac (once)
1. `git pull`, `npm --prefix mcp install`, `npm run mcp:build`.
2. Tell IRIS which folder is each area's repo (this also installs the hooks; run it again for areas you already connected):
   `npm run iris:install -- "Loginet" /Users/you/Developer/loginet-web`
3. Pin the conversation IRIS+ should continue (the one you already use for that area):
   `npm run iris:pin -- "Loginet"` lists its recent conversations (id, date, first message);
   `npm run iris:pin -- "Loginet" <id>` pins one. If that conversation was started in ANOTHER folder (e.g. a notes/dev folder), the pin finds it and remembers
   that folder: `--resume` only finds a conversation from the folder where it started. `--clear` unpins (the area goes back to notifications only).
   Find an id in the list, or inside a session with `/status`.
4. For `resume`: the `claude` command must exist and be logged in: open a terminal, run `claude`, then `/login`. (The desktop app and the terminal command have separate logins.)
5. `npm run iris:launcher:install`. Log: `~/Library/Logs/iris-launcher.log`.
   Remove: `npm run iris:launcher:uninstall`. Without launchd: `npm run iris:launcher` keeps it running in a terminal.

Optional, in `~/.config/boceto-mcp/iris-areas.json`: `"modes": { "MediLyft": "notify" }` (per area), `"notifySound": "Glass"` (notifications are silent by default),
`"claudeBin": "/path/to/claude"` (found automatically in the usual places, including nvm).
IRIS always runs on **Sonnet 5.5 with medium effort** (`--model claude-sonnet-5-5 --effort medium`) in `resume` and `terminal` modes. Change it with `"model"` and `"effort"` (low, medium, high, xhigh, max) in `iris-areas.json`.

## Use
- In the hub: "Encárgale a Loginet X para hoy a las 21:00" -> `assign_order`. **Opening by itself is the default** for a timed task that has not ended yet, in an area whose folder is registered on this Mac (not for meetings). Say "que no se abra sola" to turn it off (`autostart: false`).
- An existing block: `autostart_item(id)`. To cancel: `autostart_item(id, on: false)`.
- Motor > IRIS in the app lists the blocks that open by themselves and their state (por abrir / abierta / perdida).

## If a block does not open
1. Motor > IRIS: is the block under "Se abren solas"? If not, it was never marked: the **hub session has an old MCP loaded**. After every `npm run mcp:build`, close and reopen every Claude session that uses it (the hub first).
   A correct `assign_order` answer says "se abrirá sola cuando empiece el bloque".
2. `tail -20 ~/Library/Logs/iris-launcher.log` shows what the launcher did each minute.
3. `launchctl list | grep boceto` must list `com.boceto.iris-launcher`.
4. The hub conversation cannot open other conversations itself (the app does not allow it from a timer or scheduled task). It does not need to: it only marks the block.

## Test without waiting
`node mcp/dist/iris-launcher.mjs --dry-run` prints what it would open right now and changes nothing.
In a dry run each due block also shows how it would be woken (`resume` / `notify`).
