// Which folder (repo) belongs to each area on THIS computer, for IRIS+ (opening conversations by themselves).
// File: ~/.config/boceto-mcp/iris-areas.json  { "areas": { "MediLyft": "/path/to/repo", ... }, "opener": "optional script", "maxPerTick": 3 }
// `npm run iris:install -- "MediLyft" /path` fills it in. IRIS_AREAS (a JSON string) overrides the file, for tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const areasFile = () => path.join(os.homedir(), '.config', 'boceto-mcp', 'iris-areas.json');

export function loadAreas() {
  let raw = {};
  try {
    raw = process.env.IRIS_AREAS ? JSON.parse(process.env.IRIS_AREAS) : JSON.parse(fs.readFileSync(areasFile(), 'utf8'));
  } catch { /* no file yet */ }
  return { areas: raw.areas || {}, opener: process.env.IRIS_OPENER || raw.opener || '', maxPerTick: raw.maxPerTick || 3 };
}
