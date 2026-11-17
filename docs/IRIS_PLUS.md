# IRIS+: conversations that open by themselves

A block of the calendar can carry an **order that starts by itself**. When the block's time arrives, a small launcher on your Mac opens a Terminal
window in that area's repo and starts `claude` with the order as its first message. You see it, answer its permission prompts and interact as usual.

```
hub: assign_order(..., autostart: true)  ->  block 21:00 + brief in the area inbox, marked "abre sola"
launcher (every minute) -> 21:00 -> Terminal: cd <repo> && claude "<order>"
area conversation -> works -> report_progress(...)  ->  note + block done, visible in Motor > IRIS
```
Because the block's own time is the trigger, if the planner moves the block (nightly reschedule, you drag it) the start moves with it.

## What it does and does not do
- Opens the conversation at the block's start, or late **while the block is still running** (e.g. the Mac woke up late). After the block ends it is marked *perdida*, never opened late, and the hub gets a note.
- Several blocks at the same time open several windows (4 s apart, at most 3 per pass).
- It never skips permission prompts, deploys, publishes or sends anything. The first message tells the conversation to work on a branch.
- It needs the Mac **on and logged in** (screen locked is fine). Asleep, it runs when the Mac wakes.
- Opening is by Terminal.app. Another terminal: put a script path in `~/.config/boceto-mcp/iris-areas.json` as `"opener"`; it is called with `<folder> <prompt file>`.

## Setup on the Mac (once)
1. `git pull`, `npm --prefix mcp install`, `npm run mcp:build`.
2. The `claude` command must exist in the terminal: `curl -fsSL https://claude.ai/install.sh | bash`, then open a new terminal and check `claude --version`.
3. Tell IRIS which folder is each area's repo (this also installs the hooks; run it again for areas you already connected):
   `npm run iris:install -- "Loginet" /Users/you/Developer/loginet-web`
   `npm run iris:install -- "MediLyft" ~/Desktop/MEDILYFT/teledox`
4. `npm run iris:launcher:install` (macOS asks once if it may control Terminal: accept). Log: `~/Library/Logs/iris-launcher.log`.
   Remove: `npm run iris:launcher:uninstall`. Without launchd: `npm run iris:launcher` keeps it running in a terminal.

## Use
- In the hub: "Encárgale a Loginet X para hoy a las 21:00 y que se abra sola" -> `assign_order` with `autostart: true`.
- An existing block: `autostart_item(id)`. To cancel: `autostart_item(id, on: false)`.
- Motor > IRIS in the app lists the blocks that open by themselves and their state (por abrir / abierta / perdida).

## Test without waiting
`node mcp/dist/iris-launcher.mjs --dry-run` prints what it would open right now and changes nothing.
