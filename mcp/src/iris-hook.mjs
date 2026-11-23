// IRIS hook for Claude Code (runs by itself, Claude does not decide):
//   SessionStart       -> prints the area's unread notes + today's blocks + the protocol (goes into the conversation's context)
//   UserPromptSubmit   -> prints only NEW notes, when there are any
// Usage (set in <repo>/.claude/settings.local.json by `npm run iris:install`):  IRIS_AREA="MediLyft" node iris-hook.mjs session|prompt
// It never blocks and never fails loudly: on any problem (no network, no config) it prints nothing and exits 0.

import { loadConfig, readPlan, mutatePlan } from './cloud.mjs';
import { isoOf, durOf, fmtMin } from '../../src/lib/areaPlan';
import { notesOf, markRead, noteLine } from '../../src/lib/iris';
import { hookSessionText } from '../../src/lib/irisPrompt';

const mode = process.argv[2] === 'prompt' ? 'prompt' : 'session';
const areaRef = (process.env.IRIS_AREA || '').trim().toLowerCase();
const done = (out) => { if (out) process.stdout.write(`${out}\n`); process.exit(0); };
setTimeout(() => process.exit(0), 6000).unref(); // never keep the user waiting

(async () => {
  if (!areaRef) return done('');
  const cfg = loadConfig();
  const { plan } = await readPlan(cfg);
  const area = plan.areas.find((a) => a.id.toLowerCase() === areaRef || a.name.trim().toLowerCase() === areaRef);
  if (!area) return done(`[IRIS] El área "${process.env.IRIS_AREA}" no existe en El Boceto. Áreas: ${plan.areas.map((a) => a.name).join(', ')}.`);

  const unread = notesOf(plan).filter((n) => !n.read && n.dir === 'to_area' && n.area === area.id);
  if (mode === 'prompt' && !unread.length) return done('');

  const lines = [];
  if (unread.length) {
    lines.push(`[IRIS · ${area.name}] ${unread.length} nota${unread.length === 1 ? '' : 's'} nueva${unread.length === 1 ? '' : 's'} del centro de mando (léelas antes de seguir):`);
    unread.forEach((n) => lines.push(noteLine(plan, n)));
  } else {
    lines.push(`[IRIS · ${area.name}] Buzón sin notas nuevas.`);
  }
  if (mode === 'session') {
    // No calendar here: an automatic run is told what to do in its message, and a manual session asks El Boceto when it needs the calendar.
    lines.push(hookSessionText(area.name).split('\n')[1]);
  }
  // The notes are now in the conversation: mark them read so they are not shown twice.
  if (unread.length) await mutatePlan(cfg, (p) => ({ plan: markRead(p, { ids: unread.map((n) => n.id) }).plan, result: null }));
  return done(lines.join('\n'));
})().catch(() => done(''));
