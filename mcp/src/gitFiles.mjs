// Reads the markdown files an area mentions in its reports (from its branch when it has one, else from the working folder) so the web
// page can show and download them. Read-only. Files are capped; nothing outside the repo folder is ever read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mdPathsIn } from '../../src/lib/devFiles.js';
import { branchFromReport } from './gitMerged.mjs';

const MAX_BYTES = 80 * 1024;
const MAX_FILES = 6;

const fromBranch = (dir, branch, rel) => {
  if (!branch) return null;
  try { return execFileSync('git', ['-C', dir, 'show', `${branch}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2 * 1024 * 1024, timeout: 15000 }); } catch { return null; }
};
const fromDisk = (dir, rel) => {
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(path.resolve(dir) + path.sep)) return null; // never outside the repo
  try { return fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null; } catch { return null; }
};

// One item: { files: [{ path, abs, text, truncated, hash, at }] } from its reports and its note.
export function readFilesFor(plan, item, dir) {
  const notes = ((plan.iris && plan.iris.notes) || []).filter((n) => n.item === item.id && n.dir === 'to_hub' && n.from !== 'launcher');
  const texts = [...notes.map((n) => n.text), item.note || ''];
  const branch = notes.map((n) => branchFromReport(n.text)).filter(Boolean).pop() || '';
  const paths = [];
  texts.forEach((t) => mdPathsIn(t).forEach((p) => { if (!paths.includes(p)) paths.push(p); }));
  const files = [];
  paths.slice(0, MAX_FILES).forEach((rel) => {
    const raw = fromBranch(dir, branch, rel) ?? fromDisk(dir, rel);
    if (raw == null) { files.push({ path: rel, abs: path.join(dir, rel), text: '', missing: true }); return; }
    const truncated = Buffer.byteLength(raw) > MAX_BYTES;
    const text = truncated ? raw.slice(0, MAX_BYTES) : raw;
    files.push({ path: rel, abs: path.join(dir, rel), text, truncated, hash: crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10) });
  });
  return files;
}

// All tickets of the plan that have reported: returns { [itemId]: files } only for those whose files changed since the last time.
export function collectFiles(plan, dirOf, { sinceMs = 7 * 864e5, now = Date.now() } = {}) {
  const out = {};
  const notes = (plan.iris && plan.iris.notes) || [];
  plan.items.filter((i) => i.dev && i.dev.r === 'build' && i.iris && i.iris.launch).forEach((it) => {
    const last = notes.filter((n) => n.item === it.id && n.dir === 'to_hub' && n.from !== 'launcher').map((n) => Date.parse(n.t)).filter(Boolean).sort().pop();
    if (!last || now - last > sinceMs) return;
    const dir = dirOf(it.area);
    if (!dir) return;
    const files = readFilesFor(plan, it, dir);
    if (!files.length) return;
    const prev = (plan.devFiles && plan.devFiles[it.id]) || [];
    const key = (l) => l.map((f) => `${f.path}:${f.hash || (f.missing ? 'x' : '')}`).join('|');
    if (key(prev) !== key(files)) out[it.id] = files.map((f) => ({ ...f, at: new Date().toISOString() }));
  });
  return out;
}
