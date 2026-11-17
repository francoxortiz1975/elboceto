// Connects one repo (one conversation per area) to IRIS: adds the two hooks to <repo>/.claude/settings.local.json
// (the "local" file is private to this computer and git ignores it).
// Usage: node mcp/scripts/iris-install.mjs "MediLyft" /path/to/the/repo
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const [area, repoArg] = process.argv.slice(2);
if (!area || !repoArg) { console.error('Uso: npm run iris:install -- "MediLyft" /ruta/al/repo'); process.exit(1); }
const repo = path.resolve(repoArg.replace(/^~(?=$|\/)/, process.env.HOME || '~'));
if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) { console.error(`No existe la carpeta ${repo}`); process.exit(1); }
const hook = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'iris-hook.mjs');
if (!fs.existsSync(hook)) { console.error(`Falta ${hook}. Corre primero: npm run mcp:build`); process.exit(1); }

const q = (s) => `"${s.replace(/(["\\$`])/g, '\\$1')}"`;
const command = (mode) => `IRIS_AREA=${q(area)} node ${q(hook)} ${mode}`;
const file = path.join(repo, '.claude', 'settings.local.json');
let cfg = {};
if (fs.existsSync(file)) { try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { console.error(`${file} existe pero no es JSON válido; arréglalo o bórralo.`); process.exit(1); } }
cfg.hooks = cfg.hooks || {};
let added = 0;
for (const [event, mode] of [['SessionStart', 'session'], ['UserPromptSubmit', 'prompt']]) {
  const groups = cfg.hooks[event] = cfg.hooks[event] || [];
  const mine = groups.some((g) => (g.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('iris-hook.mjs') && h.command.includes(`IRIS_AREA=${q(area)}`)));
  // replace an older IRIS hook (e.g. other area or old path) instead of stacking them
  cfg.hooks[event] = groups.map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !(typeof h.command === 'string' && h.command.includes('iris-hook.mjs'))) })).filter((g) => (g.hooks || []).length);
  cfg.hooks[event].push({ hooks: [{ type: 'command', command: command(mode), timeout: 10 }] });
  if (!mine) added += 1;
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
// Keep the file out of git without touching the repo's own .gitignore: .git/info/exclude is private to this computer.
try {
  const exclude = path.join(repo, '.git', 'info', 'exclude');
  if (fs.existsSync(path.join(repo, '.git'))) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    const cur = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
    if (!cur.split('\n').some((l) => l.trim() === '.claude/settings.local.json')) fs.appendFileSync(exclude, `${cur && !cur.endsWith('\n') ? '\n' : ''}.claude/settings.local.json\n`);
  }
} catch { /* not a git repo or no permission: harmless */ }
// IRIS+ needs to know which folder is this area's repo on this computer.
try {
  const areasFile = path.join(os.homedir(), '.config', 'boceto-mcp', 'iris-areas.json');
  let conf = {};
  try { conf = JSON.parse(fs.readFileSync(areasFile, 'utf8')); } catch { /* new file */ }
  conf.areas = { ...(conf.areas || {}), [area]: repo };
  fs.mkdirSync(path.dirname(areasFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(areasFile, `${JSON.stringify(conf, null, 2)}\n`, { mode: 0o600 });
} catch (e) { console.error(`(No pude guardar la carpeta del área para IRIS+: ${e.message})`); }
console.log(`IRIS conectado: ${repo}\n  área: ${area}\n  hooks: SessionStart + UserPromptSubmit en ${file}\nAbre una conversación nueva en esa carpeta: lo primero que verá es su buzón.`);
