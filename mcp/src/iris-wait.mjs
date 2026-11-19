#!/usr/bin/env node
// Waits for an IRIS order to finish. Usage:
//   node iris-wait.mjs <block id> [--timeout <minutes>] [--interval <seconds>]
// Prints each new report of the area as its own line (the plan, then the final one) and ends when:
//   exit 0  the block is done        exit 2  the time limit passed        exit 3  the block was missed or no longer exists
// Meant to run in the BACKGROUND of the hub conversation: it uses no tokens while waiting, and when it ends the hub is woken with its output.
import { loadConfig, readPlan } from './cloud.mjs';
import { stepWait, timeoutLine } from './irisWait.mjs';

const args = process.argv.slice(2);
const itemId = args.find((a) => !a.startsWith('--') && !/^[\d.]+$/.test(a));
const num = (flag, def) => { const i = args.indexOf(flag); const v = i >= 0 ? Number(args[i + 1]) : NaN; return Number.isFinite(v) && v > 0 ? v : def; };
const minutes = num('--timeout', 10);
const every = Math.max(2, num('--interval', 10)) * 1000;
if (!itemId) { console.error('Uso: node iris-wait.mjs <id del bloque> [--timeout minutos] [--interval segundos]'); process.exit(1); }

const cfg = loadConfig();
const seen = new Set();
const deadline = Date.now() + minutes * 60000;
let lastPlan = null;
const out = (lines) => lines.forEach((l) => process.stdout.write(`${l}\n`));

for (;;) {
  try {
    const { plan } = await readPlan(cfg);
    lastPlan = plan;
    const s = stepWait(plan, itemId, seen);
    out(s.lines);
    if (s.done) { out([`[IRIS] El bloque “${s.text}” de ${s.areaName} está hecho.`]); process.exit(0); }
    if (s.missed) { out([`[IRIS] El bloque “${s.text || itemId}” no llegó a abrirse (el ordenador estaba apagado o la conversación no pudo reanudarse a tiempo).`]); process.exit(3); }
  } catch (e) {
    // a network blip must not end the wait: try again at the next turn
    if (/token|invalid/i.test(String(e.message))) { console.error(`[IRIS] Sin acceso a El Boceto: ${e.message}`); process.exit(3); }
  }
  if (Date.now() >= deadline) {
    out([lastPlan ? timeoutLine(lastPlan, itemId, minutes) : `[IRIS] Pasaron ${minutes} min sin poder consultar El Boceto.`]);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, every));
}
