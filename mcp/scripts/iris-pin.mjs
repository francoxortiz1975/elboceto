// Pins the Claude Code conversation that IRIS+ should CONTINUE (claude --resume <id>) for an area.
// Usage: npm run iris:pin -- "Loginet"                 lists the area's recent conversations
//        npm run iris:pin -- "Loginet" <session-id>    pins that one
//        npm run iris:pin -- "Loginet" --latest        pins the most recent one
//        npm run iris:pin -- "Loginet" --clear         unpins (the area goes back to notifications only)
import fs from 'node:fs';
import path from 'node:path';
import { areasFile } from '../src/irisAreas.mjs';
import { listSessions, sessionExists, pinnedSession, findSessionAnywhere } from '../src/irisResume.mjs';

const [area, arg] = process.argv.slice(2);
if (!area) { console.error('Uso: npm run iris:pin -- "Loginet" [id-de-sesión | --latest | --clear]'); process.exit(1); }
const file = areasFile();
let conf = {};
try { conf = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
conf.areas = conf.areas || {}; conf.sessions = conf.sessions || {};
const key = Object.keys(conf.areas).find((k) => k.trim().toLowerCase() === area.trim().toLowerCase());
if (!key) { console.error(`El área "${area}" no tiene carpeta registrada. Primero: npm run iris:install -- "${area}" /ruta/al/repo\nÁreas registradas: ${Object.keys(conf.areas).join(', ') || '(ninguna)'}`); process.exit(1); }
const repo = conf.areas[key];
const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(conf, null, 2)}\n`); };
const fmt = (ms) => new Date(ms).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

if (arg === '--clear') { delete conf.sessions[key]; save(); console.log(`${key}: conversación desfijada. IRIS+ solo avisará por notificación.`); process.exit(0); }

const list = listSessions(repo, 10);
if (!arg) {
  const cur = pinnedSession(conf, key);
  console.log(`Conversaciones de ${key} (${repo}), de la más reciente a la más antigua:\\n`.replace(/\\n/g, '\n'));
  if (!list.length) console.log('  (no hay ninguna todavía)');
  list.forEach((s) => console.log(`${s.id === cur ? ' ★' : '  '} ${s.id}  ${fmt(s.mtime)}  ${s.snippet || '(sin texto)'}`));
  console.log(`\nPara fijar una: npm run iris:pin -- "${key}" <id>${cur ? `\nFijada ahora: ${cur}` : ''}`);
  process.exit(0);
}
const id = arg === '--latest' ? (list[0] && list[0].id) : arg;
let dir = '';
if (id && !sessionExists(repo, id)) {
  // not under the area's folder: it may have been started somewhere else (e.g. a notes/dev folder); resume must run from there
  const found = findSessionAnywhere(id);
  if (found && found.cwd && fs.existsSync(found.cwd)) dir = found.cwd;
  else { console.error(`No existe esa conversación ni en ${repo} ni en el resto de ~/.claude/projects. Mira la lista con: npm run iris:pin -- "${key}"`); process.exit(1); }
}
if (!id) { console.error(`No hay conversaciones en ${repo}.`); process.exit(1); }
conf.sessions[key] = { id, ...(dir ? { dir } : {}), pinnedAt: new Date().toISOString() };
save();
console.log(`${key}: IRIS+ continuará la conversación ${id}\n  carpeta: ${dir || repo}${dir ? ' (distinta de la del área: así la guardó Claude)' : ''}\n  A la hora de un bloque con "abre sola" hará: cd <carpeta> && claude --resume ${id} "<mensaje>" (si no está en uso; si lo está, solo avisa).\n  Necesita el comando \`claude\` con sesión iniciada en la terminal (\`claude\` y luego /login).`);
