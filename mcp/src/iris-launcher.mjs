// IRIS+ launcher: opens an area's Claude Code conversation by itself when a block with an order starts.
// Runs every minute (launchd, see `npm run iris:launcher:install`) or in a terminal with --watch.
//   node iris-launcher.mjs --once      one pass (what launchd runs)
//   node iris-launcher.mjs --watch     a pass every 30 s, in this terminal
//   node iris-launcher.mjs --dry-run   say what it would open, change nothing
// It opens a Terminal window in the area's repo running `claude "<order>"` with the NORMAL permission prompts: you see it, you answer it.
// Nothing is deployed, published or sent by it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadConfig, readPlan, mutatePlan } from './cloud.mjs';
import { loadAreas } from './irisAreas.mjs';
import { findDue, launchPrompt, setLaunchState, deepLink } from '../../src/lib/irisLaunch';
import { addNotes } from '../../src/lib/iris';

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('es-ES')}]`, ...a);

// Three ways to open, in this order: a custom script ("opener"), the Terminal ("mode": "terminal", needs the `claude` command logged in),
// and by default the Claude desktop app through a claude:// link: a new Code session in the folder with the order typed in.
// The app asks to trust the folder and waits for you to press Enter: a link cannot send the message by itself.
function open(dir, promptFile, prompt, conf) {
  return new Promise((resolve, reject) => {
    const done = (err) => (err ? reject(err) : resolve());
    if (conf.opener) return execFile(conf.opener, [dir, promptFile], done);
    if (process.platform !== 'darwin') return reject(new Error('Solo sé abrir la app en macOS; define "opener" en iris-areas.json.'));
    if (conf.mode === 'terminal') {
      const bin = conf.claudeBin ? q(conf.claudeBin) : 'claude';
      const withPath = conf.claudeBin ? `PATH=${q(path.dirname(conf.claudeBin))}:"$PATH" ` : '';
      const command = `cd ${q(dir)} && ${withPath}${bin} "$(cat ${q(promptFile)})"`;
      return execFile('osascript', ['-e', 'on run argv', '-e', 'tell application "Terminal"', '-e', 'activate', '-e', 'do script (item 1 of argv)', '-e', 'end tell', '-e', 'end run', command], done);
    }
    return execFile('open', [deepLink(dir, prompt)], done);
  });
}

// One pass. Returns what it did (for logs and tests).
export async function tick({ now = new Date(), dry = false } = {}) {
  const cfg = loadConfig();
  const conf = loadAreas();
  const { plan } = await readPlan(cfg);
  const peek = findDue(plan, now, conf.areas);
  if (!peek.due.length && !peek.missed.length && !peek.noDir.length) return { opened: [], missed: [], noDir: [] };
  if (dry) {
    peek.due.forEach((d) => log(`abriría: ${d.item.text} -> ${d.dir}`));
    peek.missed.forEach((i) => log(`perdido: ${i.text}`));
    peek.noDir.forEach((i) => log(`sin carpeta para el área de: ${i.text}`));
    return { opened: peek.due.map((d) => d.item.id), missed: peek.missed.map((i) => i.id), noDir: peek.noDir.map((i) => i.id), dry: true };
  }

  // Claim first, open after: the state is saved before anything opens, so two passes (or two computers) never open the same block twice.
  let claimed = [];
  const missedIds = [];
  await mutatePlan(cfg, (p) => {
    const cur = findDue(p, now, conf.areas);
    claimed = cur.due.slice(0, conf.maxPerTick).map((d) => ({ item: d.item, dir: d.dir, prompt: launchPrompt(p, d.item) }));
    missedIds.splice(0, missedIds.length, ...cur.missed.map((i) => i.id));
    if (!claimed.length && !cur.missed.length) return { plan: p, result: null };
    let next = setLaunchState(p, claimed.map((c) => c.item.id), 'launched', now.toISOString());
    next = setLaunchState(next, missedIds, 'missed', now.toISOString());
    const areaName = (id) => (p.areas.find((a) => a.id === id) || {}).name || id;
    next = addNotes(next, [
      ...claimed.map((c) => ({ area: c.item.area, dir: 'to_hub', kind: 'report', from: 'launcher', item: c.item.id, text: `Se abrió la conversación de ${areaName(c.item.area)} para “${c.item.text}”.` })),
      ...cur.missed.map((i) => ({ area: i.area, dir: 'to_hub', kind: 'report', from: 'launcher', item: i.id, text: `“${i.text}” no se abrió a tiempo (el ordenador estaba apagado o dormido, o el lanzador no corría).` }))
    ], now.toISOString());
    return { plan: next, result: null };
  });

  const dir = path.join(os.homedir(), '.config', 'boceto-mcp', 'launch');
  const opened = [];
  for (const c of claimed) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const file = path.join(dir, `${c.item.id.replace(/[^\w.-]/g, '_')}.txt`);
      fs.writeFileSync(file, c.prompt, { mode: 0o600 });
      await open(c.dir, file, c.prompt, conf);
      opened.push(c.item.id);
      log(`abierta: ${c.item.text} (${c.dir})`);
      await new Promise((r) => setTimeout(r, Number(process.env.IRIS_STAGGER_MS ?? 4000))); // do not open several windows on top of each other
    } catch (e) {
      log(`no pude abrir ${c.item.text}: ${e.message}`);
      await mutatePlan(cfg, (p) => ({
        plan: addNotes(setLaunchState(p, [c.item.id], 'missed', now.toISOString()), [{ area: c.item.area, dir: 'to_hub', kind: 'report', from: 'launcher', item: c.item.id, text: `No pude abrir la conversación para “${c.item.text}”: ${e.message}` }], now.toISOString()),
        result: null
      }));
    }
  }
  return { opened, missed: missedIds, noDir: peek.noDir.map((i) => i.id) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const run = () => tick({ dry }).catch((e) => log(`error: ${e.message}`));
  if (args.includes('--watch')) { log('IRIS+ lanzador en marcha (Ctrl+C para parar)'); run(); setInterval(run, 30000); } else run().then(() => process.exit(0));
}
