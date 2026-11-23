// IRIS+ "resume" and "notify" modes: continue the area's EXISTING Claude Code conversation (same session id, same history)
// instead of opening a new one that has to re-learn the repo. Pure helpers, plus small reads of ~/.claude (no network).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const MODES = ['resume', 'notify', 'app', 'terminal'];
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const lower = (s) => String(s || '').trim().toLowerCase();
const keyOf = (obj, name) => Object.keys(obj || {}).find((k) => lower(k) === lower(name));

// Claude Code stores each folder's sessions in ~/.claude/projects/<path with every non-alphanumeric turned into "-">/<id>.jsonl
export const projectDirName = (repo) => String(repo).replace(/[^a-zA-Z0-9]/g, '-');
export const sessionsDir = (repo) => path.join(os.homedir(), '.claude', 'projects', projectDirName(repo));
export const sessionFile = (repo, id) => path.join(sessionsDir(repo), `${id}.jsonl`);
export const sessionExists = (repo, id) => /^[\w-]+$/.test(String(id || '')) && fs.existsSync(sessionFile(repo, id));

// A conversation belongs to the folder it was started in, and `claude --resume <id>` only finds it from there. When the id is not
// under the area's folder, look in every project folder and read the original working folder from the file itself.
export function findSessionAnywhere(id) {
  if (!/^[\w-]+$/.test(String(id || ''))) return null;
  const root = path.join(os.homedir(), '.claude', 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return null; }
  for (const d of dirs) {
    const f = path.join(root, d, `${id}.jsonl`);
    if (!fs.existsSync(f)) continue;
    let cwd = '';
    try {
      for (const line of fs.readFileSync(f, 'utf8').split('\n').slice(0, 300)) {
        const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(line) || /"relocatedCwd":"((?:[^"\\]|\\.)*)"/.exec(line);
        if (m) { try { cwd = JSON.parse(`"${m[1]}"`); } catch { cwd = m[1]; } break; }
      }
    } catch { /* unreadable */ }
    return { file: f, projectDir: d, cwd };
  }
  return null;
}

// The first real thing the user typed in a session (to recognise it in a list).
function firstUserText(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').slice(0, 400);
    for (const line of lines) {
      if (!line.includes('"type":"user"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== 'user' || !o.message) continue;
      const c = o.message.content;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && p.type === 'text' ? p.text : '')).join(' ') : '';
      const t = text.replace(/\s+/g, ' ').trim();
      if (t && !t.startsWith('<')) return t;
    }
  } catch { /* unreadable */ }
  return '';
}

// Newest first: [{ id, mtime (ms), snippet }]
export function listSessions(repo, limit = 8) {
  let names = [];
  try { names = fs.readdirSync(sessionsDir(repo)).filter((n) => n.endsWith('.jsonl')); } catch { return []; }
  return names
    .map((n) => { const f = path.join(sessionsDir(repo), n); return { id: n.slice(0, -6), mtime: fs.statSync(f).mtimeMs, snippet: firstUserText(f).slice(0, 90) }; })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

// Is that conversation being used right now? Writing to it from a second window would tangle two writers in one history.
//  - its transcript was touched in the last `quietMs`, or
//  - a `claude` process was started with that id (`--resume <id>`).
// A conversation that is open but idle in the desktop app cannot be detected: keep the area's chat in ONE place.
export function sessionInUse(repo, id, { now = Date.now(), quietMs = 30000, psOut } = {}) {
  try { if (now - fs.statSync(sessionFile(repo, id)).mtimeMs < quietMs) return true; } catch { /* no file */ }
  let out = psOut;
  if (out === undefined) { try { out = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8', timeout: 4000 }); } catch { out = ''; } }
  // The id must be an ARGUMENT of a claude process (`--resume <id>`, `-r <id>`, `--session-id <id>`), not just appear in some path or command text.
  const arg = new RegExp(`(--resume|--session-id|\\s-r)(=|\\s)+${String(id).replace(/[^\w-]/g, '')}(\\s|$)`);
  return out.split('\n').some((l) => /claude/.test(l) && arg.test(l));
}

// The folder to run `--resume` from: the one saved with the pin (if the conversation lives elsewhere), else the area's folder.
export const pinnedDir = (conf, areaName) => {
  const k = keyOf(conf.sessions, areaName);
  const v = k ? conf.sessions[k] : null;
  return (v && typeof v === 'object' && v.dir) || '';
};

export const pinnedSession = (conf, areaName) => {
  const k = keyOf(conf.sessions, areaName);
  const v = k ? conf.sessions[k] : null;
  return (v && (typeof v === 'string' ? v : v.id)) || '';
};

// How to wake an area's conversation: its own setting, else "resume" when a conversation is pinned, else the global mode, else "notify".
// Never opens a brand-new conversation unless that is asked for ("app" / "terminal").
export function modeFor(conf, areaName) {
  const k = keyOf(conf.modes, areaName);
  if (k && MODES.includes(conf.modes[k])) return conf.modes[k];
  if (pinnedSession(conf, areaName)) return 'resume';
  return MODES.includes(conf.mode) ? conf.mode : 'notify';
}

// The message sent into the resumed conversation. The full order is in the area's IRIS inbox, which the hook shows.
export function resumeMessage(item, areaName, startTime = '', more = []) {
  if (item.deploy) {
    return [
      `IRIS: el usuario pidió SUBIR A MAIN lo de este bloque del área ${areaName}: "${item.text}".`,
      'Tu buzón de IRIS tiene los pasos exactos (el hook te lo muestra; si no lo ves, léelo con read_notes). Esta ejecución SÍ puede hacer git merge, git push a main y consultar vercel, y solo para esto.',
      'Si hay conflictos, pruebas rotas o algo raro: para, no fuerces nada y cuéntalo.',
      `Al terminar avisa con report_progress(area="${areaName}", item_id="${item.id}", text="…", done=true solo si main quedó subido y el despliegue salió bien). Formato: RESUMEN / HECHO / VERIFICAR / DECISIONES / PENDIENTE / RAMA · COMMIT.`,
      'Los servidores MCP pueden tardar unos segundos en conectar: si no ves report_progress o read_notes, búscalas con ToolSearch antes de decir que no las tienes.'
    ].join('\n');
  }
  if (more.length) {
    const all = [item, ...more];
    return [
      `IRIS: empiezan ${all.length} bloques seguidos del área ${areaName}. Hazlos EN ESTE ORDEN, uno tras otro, en esta misma sesión:`,
      ...all.map((it, i) => `${i + 1}. ${it.dev && it.dev.code ? `[${it.dev.code}] ` : ''}"${it.text}" (item_id="${it.id}")`),
      'Tu buzón de IRIS tiene el encargo completo de cada uno (el hook te lo muestra; si no lo ves, léelo con read_notes).',
      'Trabaja cada uno en su propia rama, sin desplegar ni publicar nada, y no pidas confirmación al usuario: si algo exige una decisión, déjalo anotado y pasa al siguiente.',
      `Al terminar cada uno, o si te bloqueas, avisa con report_progress(area="${areaName}", item_id=<su id>, text="…", done=true si terminó). Un bloque bloqueado no detiene los demás.`,
      'El texto de report_progress va con este formato (una sección por línea, viñetas cortas, sin párrafos): RESUMEN: (una frase) / HECHO: / VERIFICAR: (pasos numerados) / DECISIONES: (todas las que tomaste tú, sin límite ni resumir, una por línea: ¿Pregunta? | A) opción | B) opción | C) opción | RECOMIENDO: B | ELEGIDA: B; ante una duda no te detengas: elige la recomendada, la de menos fricción, e impleméntala) / PENDIENTE: (lo que no pudiste completar y por qué) / RAMA: · COMMIT:. Si dejas un documento .md para leer, escribe su ruta relativa tal cual (docs/x.md).',
      'Los servidores MCP pueden tardar unos segundos en conectar al arrancar: si no ves report_progress, complete_item o read_notes, búscalas con ToolSearch (espera a que conecte boceto) antes de decir que no las tienes.',
      'Si de verdad no existen, cuenta los resultados en tu respuesta.'
    ].join('\n');
  }
  return [
    `IRIS: empieza el bloque ${item.dev && item.dev.code ? `[${item.dev.code}] ` : ''}"${item.text}"${startTime ? ` (${startTime})` : ''} del área ${areaName}.`,
    'Tu buzón de IRIS tiene el encargo completo (el hook te lo muestra; si no lo ves, léelo con read_notes).',
    'Trabaja en una rama, sin desplegar ni publicar nada, y pide confirmación antes de cualquier cosa destructiva.',
    `Al terminar, o si te bloqueas, avisa con report_progress(area="${areaName}", item_id="${item.id}", text="…", done=true si terminó).`,
    'El texto de report_progress va con este formato (una sección por línea, viñetas cortas, sin párrafos): RESUMEN: (una frase) / HECHO: / VERIFICAR: (pasos numerados) / DECISIONES: (todas las que tomaste tú, sin límite ni resumir, una por línea: ¿Pregunta? | A) opción | B) opción | C) opción | RECOMIENDO: B | ELEGIDA: B; ante una duda no te detengas: elige la recomendada, la de menos fricción, e impleméntala) / PENDIENTE: (lo que no pudiste completar y por qué) / RAMA: · COMMIT:. Si dejas un documento .md para leer, escribe su ruta relativa tal cual (docs/x.md).',
    'Los servidores MCP pueden tardar unos segundos en conectar al arrancar: si no ves report_progress, complete_item o read_notes, búscalas con ToolSearch (espera a que conecte boceto) antes de decir que no las tienes.',
    'Si de verdad no existen, cuenta el resultado en tu respuesta.'
  ].join('\n');
}

// Shell command for Terminal.app. `claude` is called by full path with its own folder on PATH (a fresh Terminal window has no nvm).
export function resumeCommand({ dir, sid, promptFile, claudeBin = '', model = '', effort = '', permissionMode = '', deny = [], allow = [], logFile = '', maxBudget = 0 }) {
  const bin = claudeBin ? q(claudeBin) : 'claude';
  const withPath = claudeBin ? `PATH=${q(path.dirname(claudeBin))}:"$PATH" ` : '';
  // The message comes right after the id and every flag after it: --disallowedTools takes a list and would swallow a message placed behind it.
  // logFile = background run: no window, `-p` (print mode: works, answers, exits), everything it prints goes to that file
  const p = logFile ? ' -p' : '';
  const budget = logFile && maxBudget > 0 ? ` --max-budget-usd ${Number(maxBudget)}` : '';
  const tail = logFile ? ` >> ${q(logFile)} 2>&1` : '';
  // A Terminal window can inherit CLAUDE_CODE_* variables from the app that started Terminal; with them Claude thinks it is a child session
  // and does not save the conversation. A window run drops them first.
  const clean = logFile ? '' : `unset $(env | sed -n 's/^\\(CLAUDE_CODE_[A-Z0-9_]*\\)=.*/\\1/p') && `;
  return `cd ${q(dir)} && ${clean}${withPath}${bin}${p} --resume ${q(sid)} "$(cat ${q(promptFile)})"${modelFlags(model, effort)}${permissionFlags(permissionMode, deny, allow)}${budget}${tail}`;
}

// IRIS always runs on one model and effort (default Sonnet 5.5, medium): "model" / "effort" in iris-areas.json change it.
// Only plain values are accepted, so nothing odd can reach the shell command.
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_EFFORT = 'medium';
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const cleanModel = (m) => (/^[\w.-]{1,60}$/.test(String(m || '')) ? String(m) : DEFAULT_MODEL);
export const cleanEffort = (e) => (EFFORTS.includes(e) ? e : DEFAULT_EFFORT);
// Unattended runs: "auto" (a classifier approves or blocks each action, like the desktop app) plus a hard list of things that are never allowed
// (pushing, publishing, deploying, merging). Other modes: manual, acceptEdits, dontAsk, plan, bypassPermissions (not recommended).
export const PERMISSION_MODES = ['manual', 'acceptEdits', 'auto', 'dontAsk', 'plan', 'bypassPermissions'];
export const DEFAULT_PERMISSION_MODE = 'auto';
export const DEFAULT_DENY = ['Bash(git push *)', 'Bash(git push)', 'Bash(npm publish*)', 'Bash(vercel *)', 'Bash(gh pr merge *)', 'Bash(supabase db push*)', 'Bash(supabase functions deploy*)', 'Bash(rm -rf*)', 'Read(.env*)', 'Bash(cat .env*)'];
// Level 1 ("work on your Mac, upload nothing"): read, edit, branch, commit locally, run tests / lint / build. Anything else is left to the auto-mode classifier.
export const DEFAULT_ALLOW = ['Edit', 'Write', 'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)', 'Bash(git add*)', 'Bash(git commit*)', 'Bash(git checkout -b *)', 'Bash(git switch -c *)', 'Bash(git branch*)', 'Bash(npm run test*)', 'Bash(npm test*)', 'Bash(npm run lint*)', 'Bash(npm run build*)', 'Bash(npx tsc*)'];
export const cleanPermissionMode = (m) => (PERMISSION_MODES.includes(m) ? m : DEFAULT_PERMISSION_MODE);
export const cleanDeny = (list) => (Array.isArray(list) ? list : []).map(String).filter((t) => /^[\w ()*.:/@-]{1,80}$/.test(t));
// Both tool flags take a list, so each gets ONE comma-joined value and they go last (after the message).
export const permissionFlags = (mode, deny, allow = []) => {
  const no = cleanDeny(deny);
  const yes = cleanDeny(allow);
  return `${mode ? ` --permission-mode ${q(cleanPermissionMode(mode))}` : ''}${yes.length ? ` --allowedTools ${q(yes.join(','))}` : ''}${no.length ? ` --disallowedTools ${q(no.join(','))}` : ''}`;
};
export const modelFlags = (model, effort) => `${model ? ` --model ${q(cleanModel(model))}` : ''}${effort ? ` --effort ${q(cleanEffort(effort))}` : ''}`;

// osascript arguments for a macOS notification (text passed as arguments, never spliced into the script).
// Silent by default (so it never wakes you at night); set "notifySound": "Glass" in iris-areas.json for a sound.
export const notifyArgs = (title, text, sound = '') => ['-e', 'on run argv', '-e', `display notification (item 2 of argv) with title (item 1 of argv)${/^[A-Za-z]+$/.test(sound) ? ` sound name "${sound}"` : ''}`, '-e', 'end run', title, text];

// Per-area exceptions ("areaAllow" in iris-areas.json): extra tools an area's unattended runs may use. A pattern that is allowed for an area
// is taken out of the deny list for that area only; every other area keeps the full list.
export const DEPLOY_ALLOW = ['Bash(git push*)', 'Bash(git merge*)', 'Bash(git checkout*)', 'Bash(git switch*)', 'Bash(git pull*)', 'Bash(git fetch*)', 'Bash(vercel *)'];
export const DEPLOY_UNDENY = ['Bash(git push *)', 'Bash(git push)', 'Bash(vercel *)'];
// deploy: the run the user asked to push to main. Only that run gets git push / merge; every other run keeps its prohibition.
export function toolsFor(conf, areaName, { deploy = false } = {}) {
  const key = Object.keys(conf.areaAllow || {}).find((k) => k.trim().toLowerCase() === String(areaName || '').trim().toLowerCase());
  const extra = cleanDeny(key ? conf.areaAllow[key] : []);
  const more = deploy ? DEPLOY_ALLOW : [];
  const lift = deploy ? DEPLOY_UNDENY : [];
  return { allow: [...new Set([...(conf.allowedTools || []), ...extra, ...more])], deny: (conf.disallowedTools || []).filter((d) => !extra.includes(d) && !lift.includes(d)) };
}
