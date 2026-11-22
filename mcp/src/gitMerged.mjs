// Read-only git checks: is the branch a ticket was built on already in main? Used to mark tickets "deployado en main" when the user merged by hand.
import { execFileSync } from 'node:child_process';

const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
const ok = (dir, args) => { try { git(dir, args); return true; } catch { return false; } };

// The branch an area's report names: "RAMA: iris/x" or "Rama local iris/x". Last match wins.
export function branchFromReport(text = '') {
  let found = '';
  const re = /(?:\bRAMA\s*:|\bRama(?:\s+local)?)\s+`?([\w./-]*iris\/[\w./-]+)`?/gi;
  let m;
  while ((m = re.exec(String(text)))) found = m[1].replace(/[.,;:)]+$/, '');
  return found;
}

// 'merged' (every commit of the branch has an equivalent in main, by content, so rebases and cherry-picks count), 'unmerged', 'missing' (no such branch).
export function branchState(dir, branch) {
  if (!branch || !ok(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])) return { state: 'missing' };
  for (const base of ['origin/main', 'main']) {
    if (!ok(dir, ['rev-parse', '--verify', '--quiet', base])) continue;
    const lines = git(dir, ['cherry', base, branch]).split('\n').filter(Boolean);
    if (lines.every((l) => l.startsWith('-'))) return { state: 'merged', base, commits: lines.length };
  }
  const lines = git(dir, ['cherry', 'main', branch]).split('\n').filter(Boolean);
  return { state: 'unmerged', ahead: lines.filter((l) => l.startsWith('+')).length };
}

// Words of 5+ letters of a title, accents removed: for a loose "does main talk about this?" hint when no branch is known.
const words = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z]{5,}/g) || [];
export function hintInMain(dir, title) {
  const w = [...new Set(words(title))];
  if (w.length < 2) return '';
  let log = '';
  try { log = git(dir, ['log', 'main', '--since=90 days ago', '--format=%h %s']); } catch { return ''; }
  const best = log.split('\n').filter(Boolean).map((l) => ({ l, n: w.filter((x) => words(l).includes(x)).length })).sort((a, b) => b.n - a.n)[0];
  return best && best.n >= 2 ? best.l.slice(0, 110) : '';
}

// rows: one per dev stack that IRIS built and that is not marked deployed. { id, code, text, branch, state, hint }
export function analyzeStacks(plan, { dirOf, onlyDone = true } = {}) {
  const rows = [];
  plan.items.filter((i) => i.dev && i.dev.r === 'build' && i.iris && i.iris.launch && !i.dev.deployed && !i.dev.nodeploy && (!onlyDone || i.done)).forEach((it) => {
    const dir = dirOf(it.area);
    if (!dir) return;
    const notes = ((plan.iris && plan.iris.notes) || []).filter((n) => n.item === it.id && n.dir === 'to_hub' && n.from !== 'launcher');
    const branch = notes.map((n) => branchFromReport(n.text)).filter(Boolean).pop() || '';
    const st = branch ? branchState(dir, branch) : { state: 'unknown' };
    rows.push({ id: it.id, code: (it.dev && it.dev.code) || '', text: it.text, branch, state: st.state, hint: st.state === 'unknown' || st.state === 'missing' ? hintInMain(dir, it.text) : '' });
  });
  return rows;
}
