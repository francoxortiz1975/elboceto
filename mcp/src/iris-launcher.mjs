// IRIS+ launcher: opens an area's Claude Code conversation by itself when a block with an order starts.
// Runs every minute (launchd, see `npm run iris:launcher:install`) or in a terminal with --watch.
//   node iris-launcher.mjs --once      one pass (what launchd runs)
//   node iris-launcher.mjs --watch     a pass every 30 s, in this terminal
//   node iris-launcher.mjs --dry-run   say what it would open, change nothing
// Nothing is deployed, published or sent by it; permission prompts are never skipped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadConfig, readPlan, mutatePlan } from './cloud.mjs';
import { loadAreas } from './irisAreas.mjs';
import { modeFor, pinnedSession, pinnedDir, modelFlags, sessionExists, sessionInUse, resumeMessage, resumeCommand, notifyArgs } from './irisResume.mjs';
import { findDue, launchPrompt, setLaunchState, deepLink, findFinished, markReported } from '../../src/lib/irisLaunch';
import { addNotes } from '../../src/lib/iris';

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('es-ES')}]`, ...a);

// What happens when a block with an order starts, per area (see irisResume.mjs):
//   resume   the area's pinned conversation is continued in Terminal: `claude --resume <id> "<message>"` (same history, nothing re-learned)
//   notify   a macOS notification; nothing opens. You type "ok" in the area's usual conversation and its IRIS hook delivers the order
//   app      a NEW Code session in the Claude desktop app through a claude:// link (you press Enter)
//   terminal a NEW conversation in Terminal (`claude "<order>"`, needs the command logged in)
// resume falls back to notify when the pinned conversation does not exist or is in use right now (never two windows on one history).
// A custom "opener" script, if set, wins over all of them. Permission prompts are never skipped; nothing is deployed or published.
const exec = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, (e) => (e ? reject(e) : resolve())));
const terminalDo = (command) => exec('osascript', ['-e', 'on run argv', '-e', 'tell application "Terminal"', '-e', 'activate', '-e', 'do script (item 1 of argv)', '-e', 'end tell', '-e', 'end run', command]);

async function openFor(c, file, conf) {
  const write = (text) => fs.writeFileSync(file, text, { mode: 0o600 });
  if (conf.opener) { write(c.prompt); await exec(conf.opener, [c.dir, file]); return 'opener'; }
  if (process.platform !== 'darwin') throw new Error('Solo sé abrir conversaciones en macOS; define "opener" en iris-areas.json.');
  let mode = c.mode;
  let why = '';
  if (mode === 'resume') {
    const sid = pinnedSession(conf, c.areaName);
    const rdir = pinnedDir(conf, c.areaName) || c.dir; // the conversation may live in another folder than the area's repo
    if (!sid || !sessionExists(rdir, sid)) { mode = 'notify'; why = 'la conversación fijada no existe en esa carpeta'; }
    else if (sessionInUse(rdir, sid)) { mode = 'notify'; why = 'esa conversación está en uso ahora mismo'; }
    else {
      write(resumeMessage(c.item, c.areaName));
      await terminalDo(resumeCommand({ dir: rdir, sid, promptFile: file, claudeBin: conf.claudeBin, model: conf.model, effort: conf.effort }));
      return 'resume';
    }
  }
  if (mode === 'notify') {
    await exec('osascript', notifyArgs(`IRIS · ${c.areaName}`, `Empieza “${c.item.text}”. Escribe “ok” en la conversación de ${c.areaName}: recogerá el encargo.`, conf.notifySound));
    return why ? `notify (${why})` : 'notify';
  }
  write(c.prompt);
  if (mode === 'terminal') {
    const bin = conf.claudeBin ? q(conf.claudeBin) : 'claude';
    const withPath = conf.claudeBin ? `PATH=${q(path.dirname(conf.claudeBin))}:"$PATH" ` : '';
    await terminalDo(`cd ${q(c.dir)} && ${withPath}${bin}${modelFlags(conf.model, conf.effort)} "$(cat ${q(file)})"`);
    return 'terminal';
  }
  await exec('open', [deepLink(c.dir, c.prompt)]);
  return 'app';
}

// One pass. Returns what it did (for logs and tests).
export async function tick({ now = new Date(), dry = false } = {}) {
  const cfg = loadConfig();
  const conf = loadAreas();
  const { plan } = await readPlan(cfg);
  // First: orders it opened that are now done but nobody reported (the conversation had no report_progress): report for them.
  const finished = findFinished(plan);
  if (finished.length && !dry) {
    await mutatePlan(cfg, (p) => {
      const fin = findFinished(p);
      if (!fin.length) return { plan: p, result: null };
      const next = addNotes(markReported(p, fin.map((i) => i.id)), fin.map((i) => ({ area: i.area, dir: 'to_hub', kind: 'report', from: 'launcher', item: i.id, text: `“${i.text}” se marcó como hecho. (Aviso automático: la conversación no envió un avance propio; mira su respuesta para el detalle.)` })), now.toISOString());
      return { plan: next, result: null };
    });
    log(`avisado al centro: ${finished.map((i) => i.text).join(', ')}`);
  }
  const peek = findDue(plan, now, conf.areas);
  if (!peek.due.length && !peek.missed.length && !peek.noDir.length) return { opened: [], missed: [], noDir: [], reported: finished.map((i) => i.id) };
  if (dry) {
    peek.due.forEach((d) => {
      const areaName = (plan.areas.find((x) => x.id === d.item.area) || {}).name || '';
      log(`abriría: ${d.item.text} -> ${d.dir} [${conf.opener ? 'opener' : modeFor(conf, areaName)}]`);
    });
    peek.missed.forEach((i) => log(`perdido: ${i.text}`));
    peek.noDir.forEach((i) => log(`sin carpeta para el área de: ${i.text}`));
    return { opened: peek.due.map((d) => d.item.id), missed: peek.missed.map((i) => i.id), noDir: peek.noDir.map((i) => i.id), dry: true };
  }

  // Claim first, open after: the state is saved before anything opens, so two passes (or two computers) never open the same block twice.
  let claimed = [];
  const missedIds = [];
  await mutatePlan(cfg, (p) => {
    const cur = findDue(p, now, conf.areas);
    claimed = cur.due.slice(0, conf.maxPerTick).map((d) => {
      const areaName = (p.areas.find((a) => a.id === d.item.area) || {}).name || '';
      return { item: d.item, dir: d.dir, areaName, mode: conf.opener ? 'opener' : modeFor(conf, areaName), prompt: launchPrompt(p, d.item) };
    });
    missedIds.splice(0, missedIds.length, ...cur.missed.map((i) => i.id));
    if (!claimed.length && !cur.missed.length) return { plan: p, result: null };
    let next = setLaunchState(p, claimed.map((c) => c.item.id), 'launched', now.toISOString());
    next = setLaunchState(next, missedIds, 'missed', now.toISOString());
    const areaName = (id) => (p.areas.find((a) => a.id === id) || {}).name || id;
    next = addNotes(next, [
      ...claimed.map((c) => ({ area: c.item.area, dir: 'to_hub', kind: 'report', from: 'launcher', item: c.item.id, text: c.mode === 'notify' ? `Empezó “${c.item.text}”: se avisó por notificación; la conversación de ${areaName(c.item.area)} recogerá el encargo con su siguiente mensaje.` : c.mode === 'resume' ? `Se reanudó la conversación de ${areaName(c.item.area)} para “${c.item.text}”.` : `Se abrió la conversación de ${areaName(c.item.area)} para “${c.item.text}”.` })),
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
      const how = await openFor(c, file, conf);
      opened.push(c.item.id);
      log(`${how.startsWith('notify') ? 'avisada' : 'abierta'}: ${c.item.text} (${c.dir}) [${how}]`);
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
