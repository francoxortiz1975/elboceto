// Reads the deliverables an area names in its reports (documents, PDFs, images), from its branch when it has one, else from the working
// folder, so the web page can show and download them. Read-only. Size caps keep the plan small; nothing outside the repo folder is read.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { docPathsIn, kindOf, extOf, MIME } from '../../src/lib/devFiles.js';
import { branchFromReport } from './gitMerged.mjs';

const MAX_TEXT = 80 * 1024;      // text files: first 80 KB
const MAX_BINARY = 600 * 1024;   // a PDF or image bigger than this is listed without its content
const MAX_TOTAL = 1024 * 1024;   // all binary content of one ticket
const MAX_FILES = 6;

const fromBranch = (dir, branch, rel) => {
  if (!branch) return null;
  try { return execFileSync('git', ['-C', dir, 'show', `${branch}:${rel}`], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024, timeout: 15000 }); } catch { return null; }
};
const fromDisk = (dir, rel) => {
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(path.resolve(dir) + path.sep)) return null; // never outside the repo
  try { return fs.statSync(abs).isFile() ? fs.readFileSync(abs) : null; } catch { return null; }
};

// One item: [{ path, abs, kind, mime, text | b64, bytes, truncated, tooBig, missing, hash }]
export function readFilesFor(plan, item, dir) {
  const notes = ((plan.iris && plan.iris.notes) || []).filter((n) => n.item === item.id && n.dir === 'to_hub' && n.from !== 'launcher');
  const branch = notes.map((n) => branchFromReport(n.text)).filter(Boolean).pop() || '';
  const paths = [];
  [...notes.map((n) => n.text), item.note || ''].forEach((t) => docPathsIn(t).forEach((p) => { if (!paths.includes(p)) paths.push(p); }));
  let binaryTotal = 0;
  return paths.slice(0, MAX_FILES).map((rel) => {
    const base = { path: rel, abs: path.join(dir, rel), kind: kindOf(rel), mime: MIME[extOf(rel)] || 'application/octet-stream' };
    const buf = fromBranch(dir, branch, rel) ?? fromDisk(dir, rel);
    if (buf == null) return { ...base, missing: true };
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
    if (base.kind === 'pdf' || base.kind === 'image') {
      if (buf.length > MAX_BINARY || binaryTotal + buf.length > MAX_TOTAL) return { ...base, bytes: buf.length, tooBig: true, hash };
      binaryTotal += buf.length;
      return { ...base, bytes: buf.length, b64: buf.toString('base64'), hash };
    }
    const raw = buf.toString('utf8');
    const truncated = Buffer.byteLength(raw) > MAX_TEXT;
    return { ...base, bytes: buf.length, text: truncated ? raw.slice(0, MAX_TEXT) : raw, truncated, hash };
  });
}

// All tickets of the plan that have reported: { [itemId]: files } only for those whose files changed since the last time.
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
