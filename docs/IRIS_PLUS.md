# IRIS+: conversations that open by themselves

A block of the calendar can carry an **order that starts by itself**. When the block's time arrives, a small launcher on your Mac **opens the Claude desktop app
(Code tab) on a new session in that area's repo, with the order already typed in**. You confirm the folder ("Trust this workspace?") and press Enter to send it:
a link can prefill a message but never sends it, so there is always one click from you. From then on it is a normal conversation.
(Alternative: `"mode": "terminal"` in `iris-areas.json` opens a Terminal window and starts the `claude` command with the order, which does send by itself but needs that command installed and logged in.)

```
hub: assign_order(..., autostart: true)  ->  block 21:00 + brief in the area inbox, marked "abre sola"
launcher (every minute) -> 21:00 -> claude://code/new?folder=<repo>&q=<order>  (opens the Claude app, you press Enter)
area conversation -> works -> report_progress(...)  ->  note + block done, visible in Motor > IRIS
```
Because the block's own time is the trigger, if the planner moves the block (nightly reschedule, you drag it) the start moves with it.

## What it does and does not do
- Opens the conversation at the block's start, or late **while the block is still running** (e.g. the Mac woke up late). After the block ends it is marked *perdida*, never opened late, and the hub gets a note.
- Several blocks at the same time open several windows (4 s apart, at most 3 per pass).
- It never skips permission prompts, deploys, publishes or sends anything. The first message tells the conversation to work on a branch.
- A very long order is cut to ~1500 characters in the message; the full text is in the area's IRIS inbox, which the hook shows when the conversation starts.
- It needs the Mac **on and logged in** (screen locked is fine). Asleep, it runs when the Mac wakes.
- Another way to open: put a script path in `~/.config/boceto-mcp/iris-areas.json` as `"opener"`; it is called with `<folder> <prompt file>`.

## Setup on the Mac (once)
1. `git pull`, `npm --prefix mcp install`, `npm run mcp:build`.
2. Only for `"mode": "terminal"`: the `claude` command must exist (`curl -fsSL https://claude.ai/install.sh | bash`) and be logged in (`/login`). The default (the Claude app) does not need it.
3. Tell IRIS which folder is each area's repo (this also installs the hooks; run it again for areas you already connected):
   `npm run iris:install -- "Loginet" /Users/you/Developer/loginet-web`
   `npm run iris:install -- "MediLyft" ~/Desktop/MEDILYFT/teledox`
4. `npm run iris:launcher:install`. Log: `~/Library/Logs/iris-launcher.log`.
   Remove: `npm run iris:launcher:uninstall`. Without launchd: `npm run iris:launcher` keeps it running in a terminal.

## Use
- In the hub: "Encárgale a Loginet X para hoy a las 21:00 y que se abra sola" -> `assign_order` with `autostart: true`.
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
