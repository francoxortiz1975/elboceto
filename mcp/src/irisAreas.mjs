// Which folder (repo) belongs to each area on THIS computer, for IRIS+ (opening conversations by themselves).
// File: ~/.config/boceto-mcp/iris-areas.json
//   { "areas": { "Loginet": "/path/to/repo" },
//     "sessions": { "Loginet": { "id": "<claude session id>" } },   <- the area's conversation to continue (`npm run iris:pin`)
//     "modes": { "Loginet": "resume" | "notify" | "app" | "terminal" },  <- per area; default: resume if a session is pinned, else notify
//     "mode": "notify" | "app" | "terminal", "opener": "optional script", "maxPerTick": 3, "claudeBin": "/path/to/claude" }
// `npm run iris:install -- "MediLyft" /path` fills it in. IRIS_AREAS (a JSON string) overrides the file, for tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Terminal.app opens a clean login shell: a `claude` installed through nvm (or Homebrew) is often NOT on its PATH.
// So the launcher calls it by its full path. Order: "claudeBin" in the file, then the usual places.
export function findClaude(configured = '') {
  const home = os.homedir();
  const candidates = [configured, path.join(home, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  try {
    const nvm = path.join(home, '.nvm', 'versions', 'node');
    fs.readdirSync(nvm).sort().reverse().forEach((v) => candidates.push(path.join(nvm, v, 'bin', 'claude')));
  } catch { /* no nvm */ }
  return candidates.find((c) => c && fs.existsSync(c)) || '';
}

export const areasFile = () => path.join(os.homedir(), '.config', 'boceto-mcp', 'iris-areas.json');

export function loadAreas() {
  let raw = {};
  try {
    raw = process.env.IRIS_AREAS ? JSON.parse(process.env.IRIS_AREAS) : JSON.parse(fs.readFileSync(areasFile(), 'utf8'));
  } catch { /* no file yet */ }
  return { areas: raw.areas || {}, sessions: raw.sessions || {}, modes: raw.modes || {}, opener: process.env.IRIS_OPENER || raw.opener || '', mode: ['notify', 'app', 'terminal', 'resume'].includes(raw.mode) ? raw.mode : '', maxPerTick: raw.maxPerTick || 3, notifySound: raw.notifySound || '', claudeBin: findClaude(process.env.IRIS_CLAUDE || raw.claudeBin || '') };
}
