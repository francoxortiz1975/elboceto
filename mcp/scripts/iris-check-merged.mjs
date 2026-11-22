#!/usr/bin/env node
// Which tickets IRIS built are already in main? Read-only by default; --apply marks the merged ones as "deployado en main".
import { loadConfig, readPlan, mutatePlan } from '../src/cloud.mjs';
import { loadAreas } from '../src/irisAreas.mjs';
import { pinnedDir } from '../src/irisResume.mjs';
import { analyzeStacks } from '../src/gitMerged.mjs';

const apply = process.argv.includes('--apply');
const cfg = loadConfig();
const conf = loadAreas();
const { plan } = await readPlan(cfg);
const nameOf = (id) => (plan.areas.find((a) => a.id === id) || {}).name || '';
const dirOf = (areaId) => { const n = nameOf(areaId); const k = Object.keys(conf.areas).find((x) => x.toLowerCase() === n.toLowerCase()); return pinnedDir(conf, n) || (k ? conf.areas[k] : ''); };
const rows = analyzeStacks(plan, { dirOf });
const label = { merged: 'EN MAIN', unmerged: 'NO está en main', missing: 'rama no existe', unknown: 'sin rama conocida' };
rows.forEach((r) => console.log(`${label[r.state].padEnd(18)} ${(r.code || '-').padEnd(8)} ${r.text.slice(0, 55).padEnd(56)} ${r.branch || ''}${r.hint ? `\n${' '.repeat(28)}¿en main como? ${r.hint}` : ''}`));
const merged = rows.filter((r) => r.state === 'merged').map((r) => r.id);
console.log(`\n${rows.length} revisados · ${merged.length} ya en main · ${rows.filter((r) => r.state === 'unmerged').length} sin fusionar · ${rows.filter((r) => r.state === 'unknown' || r.state === 'missing').length} sin poder comprobar`);
if (apply && merged.length) {
  await mutatePlan(cfg, (p) => ({ plan: { ...p, items: p.items.map((i) => (merged.includes(i.id) ? { ...i, dev: { ...i.dev, deployed: new Date().toISOString(), deployedBy: 'git' } } : i)) }, result: null }));
  console.log(`Marcados como deployados en main: ${merged.length}`);
} else if (merged.length) console.log('Para marcarlos: node mcp/scripts/iris-check-merged.mjs --apply');
