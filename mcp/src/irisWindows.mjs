// Terminal windows opened by the launcher are closed after a stretch of inactivity (nothing written to the conversation).
// Only windows the launcher opened itself are touched, found by the tty it recorded, and only a `claude` process that carries that
// conversation's id on its command line is ended.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';

export const WIN_FILE = path.join(os.homedir(), '.config', 'boceto-mcp', 'windows.json');
export const loadWins = () => { try { const l = JSON.parse(fs.readFileSync(WIN_FILE, 'utf8')); return Array.isArray(l) ? l : []; } catch { return []; } };
export const saveWins = (list) => { fs.mkdirSync(path.dirname(WIN_FILE), { recursive: true }); fs.writeFileSync(WIN_FILE, JSON.stringify(list, null, 1), { mode: 0o600 }); };
export const addWin = (rec) => { const list = loadWins().filter((w) => w.tty !== rec.tty); list.push(rec); saveWins(list.slice(-20)); };

// Pure: which recorded windows have had no activity for `idleMs`? lastActivity(w) = ms timestamp of the last write to its conversation.
export function windowsToClose(wins, { now = Date.now(), idleMs, lastActivity }) {
  if (!(idleMs > 0)) return [];
  return wins.filter((w) => now - Math.max(Number(lastActivity(w)) || 0, Date.parse(w.openedAt) || 0) > idleMs);
}

// Pure: rows of `ps -o pid=,pcpu=,command=` for one tty.
export const parsePs = (psOut) => String(psOut || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => /^(\d+)\s+([\d.,]+)\s+(.*)$/.exec(l)).filter(Boolean)
  .map((m) => ({ pid: Number(m[1]), cpu: Number(String(m[2]).replace(',', '.')), cmd: m[3] }));
// the claude process of this conversation (its command line carries the conversation id)
export const claudePidsOnTty = (psOut, sid) => parsePs(psOut).filter((r) => /(^|[\s/])claude(\s|$)/.test(r.cmd) && r.cmd.includes(sid)).map((r) => r.pid);
// Something is working on that tty (the agent or a command it started, e.g. a long test run) when the processes there, the shell aside, use CPU.
export const ttyBusy = (psOut, { cpuLimit = 10 } = {}) => parsePs(psOut).filter((r) => !/(^|\/)-?(zsh|bash|sh|login)(\s|$)/.test(r.cmd)).reduce((t, r) => t + r.cpu, 0) > cpuLimit;

// What the window shows (text) as a short hash: while the agent works the screen keeps changing (spinner, output), at an idle prompt it does not.
const HISTORY_SCRIPT = ['on run argv', 'set target to item 1 of argv', 'tell application "Terminal"', 'repeat with w in windows', 'repeat with t in tabs of w', 'try', 'if (tty of t) is target then return history of t', 'end try', 'end repeat', 'end repeat', 'end tell', 'return "gone"', 'end run'];
export async function screenHash(tty) {
  const text = await new Promise((resolve) => execFile('osascript', [...HISTORY_SCRIPT.flatMap((l) => ['-e', l]), tty], { maxBuffer: 16 * 1024 * 1024 }, (e, out) => resolve(e ? '' : String(out || ''))));
  if (!text || text.trim() === 'gone') return '';
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${h}`;
}

const CLOSE_SCRIPT = ['on run argv', 'set target to item 1 of argv', 'tell application "Terminal"', 'repeat with w in windows', 'repeat with t in tabs of w', 'try',
  'if (tty of t) is target then', 'if (count of tabs of w) is 1 then', 'close w', 'return "closed"', 'else', 'return "multi"', 'end if', 'end if', 'end try', 'end repeat', 'end repeat', 'end tell', 'return "gone"', 'end run'];
const osa = (lines, arg) => new Promise((resolve, reject) => execFile('osascript', [...lines.flatMap((l) => ['-e', l]), arg], (e, out) => (e ? reject(e) : resolve(String(out || '').trim()))));

// Ends the conversation's claude process on that tty (SIGTERM; the conversation is already saved) and closes the window if it was alone.
export async function closeWindow(w) {
  const ttyName = String(w.tty).replace('/dev/', '');
  if (!/^ttys?\d+$/.test(ttyName)) return 'bad-tty';
  let ps = '';
  try { ps = execFileSync('ps', ['-t', ttyName, '-o', 'pid=,pcpu=,command='], { encoding: 'utf8' }); } catch { /* no processes on that tty */ }
  if (ttyBusy(ps)) return 'busy';
  claudePidsOnTty(ps, w.sid).forEach((pid) => { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } });
  await new Promise((r) => setTimeout(r, 2500));
  return osa(CLOSE_SCRIPT, w.tty);
}
