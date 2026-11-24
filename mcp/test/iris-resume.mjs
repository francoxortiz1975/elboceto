// Unit tests for the IRIS+ resume / notify modes (pure helpers + reads of a throw-away ~/.claude).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-resume-'));
process.env.HOME = home;
const R = await import('../src/irisResume.mjs');

ok(R.projectDirName('/Users/francoortiz/Documents/APPS/EL_BOCETO') === '-Users-francoortiz-Documents-APPS-EL-BOCETO', 'project folder name: every non-alphanumeric becomes "-"');
ok(R.projectDirName('/Users/francoortiz/Developer/loginet-web') === '-Users-francoortiz-Developer-loginet-web', 'project folder name for loginet-web');

// sessions on disk
const repo = '/Users/x/Developer/loginet-web';
const dir = R.sessionsDir(repo);
fs.mkdirSync(dir, { recursive: true });
const line = (type, content) => JSON.stringify({ type, message: { role: type, content } });
const mk = (id, text, ageMs) => { const f = path.join(dir, `${id}.jsonl`); fs.writeFileSync(f, `${JSON.stringify({ type: 'queue-operation' })}\n${line('user', '<system-reminder>ignore</system-reminder>')}\n${line('user', text)}\n`); const t = new Date(Date.now() - ageMs); fs.utimesSync(f, t, t); };
mk('aaa-111', 'Arregla el formulario de contacto', 3 * 3600e3);
mk('bbb-222', [{ type: 'text', text: 'Prepara el blog' }], 5 * 60e3);
mk('ccc-333', 'hello', 10 * 60e3);
const list = R.listSessions(repo);
ok(list.map((s) => s.id).join() === 'bbb-222,ccc-333,aaa-111', 'sessions are listed newest first');
ok(list[0].snippet === 'Prepara el blog' && list[2].snippet === 'Arregla el formulario de contacto', 'the snippet is the first real user message (reminders skipped, text blocks joined)');
ok(R.sessionExists(repo, 'bbb-222') && !R.sessionExists(repo, 'nope') && !R.sessionExists(repo, '../x'), 'sessionExists, and ids with a path in them are refused');

// in use
ok(R.sessionInUse(repo, 'aaa-111', { psOut: '' }) === false, 'an old, quiet conversation is not in use');
fs.utimesSync(path.join(dir, 'aaa-111.jsonl'), new Date(), new Date());
ok(R.sessionInUse(repo, 'aaa-111', { psOut: '' }) === true, 'a conversation touched seconds ago is in use');
ok(R.sessionInUse(repo, 'bbb-222', { psOut: '/x/node /x/bin/claude --resume bbb-222' }) === true, 'a claude process started with that id means in use');
ok(R.sessionInUse(repo, 'bbb-222', { psOut: '/usr/bin/vim notes-bbb-222.txt' }) === false, 'a process that is not claude does not count');
ok(R.sessionInUse(repo, 'bbb-222', { psOut: '/bin/zsh -c cat ~/.claude/projects/-Users-x-loginet-web/bbb-222.jsonl' }) === false, 'the id inside a path or command text (not as an argument) does not count');
ok(R.sessionInUse(repo, 'bbb-222', { psOut: '/app/claude --output-format stream-json --resume bbb-222 --effort=medium' }) === true && R.sessionInUse(repo, 'bbb-222', { psOut: '/x/claude -r bbb-222' }) === true && R.sessionInUse(repo, 'bbb-222', { psOut: '/x/claude --session-id=bbb-222 --verbose' }) === true, 'the id as the argument of --resume, -r or --session-id counts');

// mode choice
const conf = (o) => ({ sessions: {}, modes: {}, mode: '', ...o });
ok(R.modeFor(conf({}), 'Loginet') === 'notify', 'nothing pinned: only a notification (never a new conversation)');
ok(R.modeFor(conf({ sessions: { Loginet: { id: 'bbb-222' } } }), 'loginet') === 'resume', 'a pinned conversation: resume (case-insensitive area)');
ok(R.modeFor(conf({ sessions: { Loginet: 'bbb-222' } }), 'Loginet') === 'resume', 'a pinned id given as a plain string also works');
ok(R.modeFor(conf({ sessions: { Loginet: { id: 'x' } }, modes: { Loginet: 'notify' } }), 'Loginet') === 'notify', 'a per-area mode wins over the pin');
ok(R.modeFor(conf({ mode: 'app' }), 'MediLyft') === 'app', 'a global mode still works when asked for explicitly');
ok(R.modeFor(conf({ modes: { Loginet: 'bogus' } }), 'Loginet') === 'notify', 'an unknown mode is ignored');

// text + commands
const item = { id: 'ap_1', text: 'Formulario', at: 21 * 60 };
const msg = R.resumeMessage(item, 'Loginet', '21:00–22:00');
ok(/bloque "Formulario" \(21:00–22:00\) del área Loginet/.test(msg) && /report_progress\(area="Loginet", item_id="ap_1"/.test(msg) && /read_notes/.test(msg) && /sin desplegar ni publicar/.test(msg), 'the resume message names the block, points to the inbox, asks for a branch and for report_progress');
const cmd = R.resumeCommand({ dir: "/Users/x/it's here", sid: 'bbb-222', promptFile: '/tmp/m.txt', claudeBin: '/Users/x/.nvm/versions/node/v22/bin/claude' });
ok(cmd === `cd '/Users/x/it'\\''s here' && unset $(env | sed -n 's/^\\(CLAUDE_CODE_[A-Z0-9_]*\\)=.*/\\1/p') && PATH='/Users/x/.nvm/versions/node/v22/bin':"$PATH" '/Users/x/.nvm/versions/node/v22/bin/claude' --resume 'bbb-222' "$(cat '/tmp/m.txt')"`, 'resume command: quoted folder, claude by full path with its folder on PATH, --resume <id>');
ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p' }) === `cd '/a' && unset $(env | sed -n 's/^\\(CLAUDE_CODE_[A-Z0-9_]*\\)=.*/\\1/p') && claude --resume 's' "$(cat '/p')"`, 'without a known claude path it uses plain `claude`');
ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', model: 'claude-sonnet-5-5', effort: 'medium' }) === `cd '/a' && unset $(env | sed -n 's/^\\(CLAUDE_CODE_[A-Z0-9_]*\\)=.*/\\1/p') && claude --resume 's' "$(cat '/p')" --model 'claude-sonnet-5-5' --effort 'medium'`, 'IRIS runs on Sonnet 5.5 with medium effort: --model and --effort go into the command');
ok(R.modelFlags("x; rm -rf /", 'bogus') === ` --model 'claude-sonnet-5-5' --effort 'medium'`, 'a model or effort with odd characters or an unknown level falls back to the defaults');
ok(R.modelFlags('claude-opus-5-5', 'high') === ` --model 'claude-opus-5-5' --effort 'high'` && R.modelFlags('', '') === '', 'other models and efforts can be configured; none means no flags');
const na = R.notifyArgs('IRIS · Loginet', 'Empieza "x"; rm -rf /');
ok(na[na.length - 1] === 'Empieza "x"; rm -rf /' && !na.slice(0, -2).join(' ').includes('rm -rf'), 'notification text goes as an argument, never inside the script');

// a conversation that lives in another folder than the area's repo
const other = '/Users/x/Library/Mobile Documents/iCloud~md~obsidian/Documents/DEV/LOGINET';
const odir = R.sessionsDir(other); fs.mkdirSync(odir, { recursive: true });
fs.writeFileSync(path.join(odir, 'zzz-999.jsonl'), `${JSON.stringify({ type: 'user', cwd: other, message: { role: 'user', content: 'x' } })}\n`);
const fa = R.findSessionAnywhere('zzz-999');
ok(fa && fa.cwd === other && fa.projectDir === R.projectDirName(other), 'a conversation in another project folder is found, and its original working folder is read from the file');
ok(R.findSessionAnywhere('nope-000') === null && R.findSessionAnywhere('../x') === null, 'unknown ids and ids with a path give nothing');
ok(R.pinnedDir({ sessions: { Loginet: { id: 'zzz-999', dir: other } } }, 'loginet') === other && R.pinnedDir({ sessions: { Loginet: 'zzz-999' } }, 'Loginet') === '', 'pinnedDir: only when one was saved');
ok(!R.notifyArgs('t', 'x').join(' ').includes('sound') && R.notifyArgs('t', 'x', 'Glass').join(' ').includes('sound name "Glass"') && !R.notifyArgs('t', 'x', 'Gl"; do shell script').join(' ').includes('do shell'), 'notification sound: silent by default, only plain sound names are accepted');

// permissions for unattended runs
ok(R.permissionFlags('auto', ['Bash(git push *)', 'Bash(npm publish*)']) === ` --permission-mode 'auto' --disallowedTools 'Bash(git push *),Bash(npm publish*)'`, 'unattended runs: --permission-mode auto plus a comma-joined list of tools that are never allowed');
ok(R.permissionFlags('', []) === '' && R.permissionFlags('bogus', []) === ` --permission-mode 'auto'`, 'no mode means no flag; an unknown mode falls back to auto');
ok(R.cleanDeny(['Bash(git push *)', "x'; rm -rf /", 'a"b', 5]).join('|') === 'Bash(git push *)|5', 'tool patterns with quotes or shell characters are dropped');
const full = R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', model: 'claude-sonnet-5-5', effort: 'medium', permissionMode: 'auto', deny: R.DEFAULT_DENY });
ok(full.indexOf('"$(cat') < full.indexOf('--model') && full.indexOf('"$(cat') < full.indexOf('--disallowedTools') && full.endsWith(`--disallowedTools '${R.DEFAULT_DENY.join(',')}'`), 'the message comes before every flag and the variadic --disallowedTools is last, so it cannot swallow the message');
const lvl1 = R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', permissionMode: 'auto', deny: R.DEFAULT_DENY, allow: R.DEFAULT_ALLOW });
ok(lvl1.indexOf('--allowedTools') > lvl1.indexOf('--permission-mode') && lvl1.indexOf('--allowedTools') < lvl1.indexOf('--disallowedTools') && lvl1.includes(`--allowedTools '${R.DEFAULT_ALLOW.join(',')}'`), 'level 1: --allowedTools gets one comma-joined value, before --disallowedTools');
ok(R.DEFAULT_ALLOW.includes('Edit') && R.DEFAULT_ALLOW.includes('Bash(git commit*)') && !R.DEFAULT_ALLOW.some((x) => /push|publish|vercel|merge|deploy/.test(x)), 'level 1 allows edit and local commits and nothing that uploads or deploys');
ok(['Bash(git push *)', 'Read(.env*)', 'Bash(rm -rf*)'].every((d) => R.DEFAULT_DENY.includes(d)) && R.DEFAULT_ALLOW.every((a) => !R.DEFAULT_DENY.includes(a)), 'the deny list covers push, .env and rm -rf, and nothing is both allowed and denied');
ok(R.DEFAULT_DENY.some((d) => /git push/.test(d)) && R.DEFAULT_DENY.some((d) => /publish/.test(d)) && R.DEFAULT_DENY.some((d) => /vercel/.test(d)), 'the default deny list covers push, publish and deploy');

// ---- iris-wait: what the hub is told about one block ----
const W = await import('../src/irisWait.mjs');
const wplan = (over = {}) => ({
  areas: [{ id: 'm', name: 'MediLyft' }],
  items: [{ id: 'b1', area: 'm', text: 'Botón de login', done: false, iris: { launch: true, state: 'launched' }, ...over }],
  iris: { notes: [
    { id: 'n1', item: 'b1', dir: 'to_hub', from: 'launcher', t: '2026-11-19T17:00:00Z', text: 'Se reanudó la conversación de MediLyft.' },
    { id: 'n2', item: 'b1', dir: 'to_hub', from: 'area', t: '2026-11-19T17:00:30Z', text: 'PLAN: cambiar .btn-submit\na rojo.' },
    { id: 'n3', item: 'other', dir: 'to_hub', from: 'area', t: '2026-11-19T17:00:40Z', text: 'de otro bloque' },
    { id: 'n4', item: 'b1', dir: 'to_area', from: 'hub', t: '2026-11-19T16:59:00Z', text: 'el encargo' }
  ] }
});
const seenW = new Set();
let st = W.stepWait(wplan(), 'b1', seenW);
ok(st.lines.length === 2 && st.lines[0].includes('[IRIS · lanzador]') && st.lines[1] === '[IRIS · MediLyft] PLAN: cambiar .btn-submit a rojo.', 'only the reports of that block that go to the hub are printed, in order, with who said them and on one line');
ok(!st.done && !st.missed, 'a launched block that is not done keeps waiting');
ok(W.stepWait(wplan(), 'b1', seenW).lines.length === 0, 'a report already printed is not printed again');
ok(W.stepWait(wplan({ done: true }), 'b1', seenW).done === true, 'done means the wait can end');
ok(W.stepWait(wplan({ iris: { launch: true, state: 'missed' } }), 'b1', new Set()).missed === true, 'a missed block ends the wait');
st = W.stepWait(wplan(), 'nope', new Set());
ok(st.missed && st.gone && /ya no existe/.test(st.lines[0]), 'a block that no longer exists ends the wait with a clear line');
ok(/Pasaron 3 min/.test(W.timeoutLine(wplan(), 'b1', 3)) && /arrancó pero sin informe final/.test(W.timeoutLine(wplan(), 'b1', 3)) && /sin arrancar/.test(W.timeoutLine(wplan({ iris: { launch: true, state: 'pending' } }), 'b1', 3)), 'the timeout line says how long and what state the block is in');
ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', logFile: '/l.log' }) === `cd '/a' && claude -p --resume 's' "$(cat '/p')" >> '/l.log' 2>&1`, 'background run: print mode, no window, output to a log file');
// ---- night batching (message and cap) ----
const bp = { items: [
  { id: 'a', area: 'm', day: '2026-11-20', at: 60, dur: 30, iris: { launch: true } },
  { id: 'b', area: 'm', day: '2026-11-20', at: 90, dur: 30, iris: { launch: true } },
  { id: 'c', area: 'm', day: '2026-11-20', at: 150, dur: 30, iris: { launch: true } },
  { id: 'd', area: 'm', day: '2026-11-20', at: 600, dur: 30, iris: { launch: true } },
  { id: 'e', area: 'x', day: '2026-11-20', at: 100, dur: 30, iris: { launch: true } },
  { id: 'f', area: 'm', day: '2026-11-20', at: 100, dur: 30, done: true, iris: { launch: true } }
] };
ok(/2 bloques seguidos/.test(R.resumeMessage(bp.items[0], 'M', '', [bp.items[1]])) && /item_id="b"/.test(R.resumeMessage(bp.items[0], 'M', '', [bp.items[1]])), 'batch message lists every block with its id');
ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', logFile: '/l', maxBudget: 5 }).includes(" --max-budget-usd 5 >> '/l'"), 'background runs carry a spending cap');

const tf = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: ['Bash(vercel *)', 'Bash(git push *)'], areaAllow: { MediLyft: ['Bash(vercel *)'] } }, 'medilyft');
ok(tf.allow.includes('Bash(vercel *)') && tf.allow.includes('Edit') && !tf.deny.includes('Bash(vercel *)') && tf.deny.includes('Bash(git push *)'), 'an area exception allows that tool and lifts only that prohibition for that area');
const tg = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: ['Bash(vercel *)'], areaAllow: { MediLyft: ['Bash(vercel *)'] } }, 'Loginet');
ok(!tg.allow.includes('Bash(vercel *)') && tg.deny.includes('Bash(vercel *)'), 'other areas keep the full deny list');
const dz = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: ['Bash(git push *)', 'Bash(git push)', 'Bash(vercel *)', 'Bash(rm -rf*)'] }, 'Loginet', { deploy: true });
ok(dz.allow.includes('Bash(git push*)') && !dz.deny.includes('Bash(git push *)') && dz.deny.includes('Bash(rm -rf*)'), 'a deploy run may push; the other prohibitions stay');
const nz = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: ['Bash(git push *)'] }, 'Loginet');
ok(!nz.allow.includes('Bash(git push*)') && nz.deny.includes('Bash(git push *)'), 'a normal run never gets push');
ok(/SUBIR A MAIN/.test(R.resumeMessage({ id: 'd', text: 'Subir MC001 a main', deploy: { stack: 'f' } }, 'MediLyft')), 'a deploy block gets its own message');

const WN = await import('../src/irisWindows.mjs');
const wins = [{ tty: '/dev/ttys004', sid: 'aaa-1', dir: '/d', openedAt: '2026-11-23T10:00:00Z' }, { tty: '/dev/ttys005', sid: 'bbb-2', dir: '/d', openedAt: '2026-11-23T10:00:00Z' }];
const t0 = Date.parse('2026-11-23T10:30:00Z');
const closing = WN.windowsToClose(wins, { now: t0, idleMs: 5 * 60000, lastActivity: (w) => (w.sid === 'aaa-1' ? t0 - 6 * 60000 : t0 - 2 * 60000) });
ok(closing.length === 1 && closing[0].sid === 'aaa-1', 'a window closes only after 5 minutes without writes to its conversation');
ok(WN.windowsToClose(wins, { now: t0, idleMs: 0, lastActivity: () => 0 }).length === 0, 'with the timeout set to 0 nothing is ever closed');
ok(WN.windowsToClose([{ tty: '/dev/ttys9', sid: 'c', openedAt: new Date(t0 - 60000).toISOString() }], { now: t0, idleMs: 5 * 60000, lastActivity: () => 0 }).length === 0, 'a window opened a minute ago is not closed even if the conversation has no recent writes');
const PS = '  101   0.0 -zsh\n  102   1.2 /Users/x/.nvm/bin/claude --resume aaa-1 hola\n  103   0.1 node /srv/boceto-mcp/server.mjs\n';
ok(WN.claudePidsOnTty(PS, 'aaa-1').join() === '102' && WN.claudePidsOnTty(PS, 'zzz').length === 0, 'only the claude process that carries the conversation id is picked');
ok(!WN.ttyBusy(PS) && WN.ttyBusy(PS + '  104  85.0 node /x/jest --runInBand\n'), 'a tty is busy when something there (not the shell) is using the CPU');

ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p' }).includes("CLAUDE_CODE_[A-Z0-9_]*") && !R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p', logFile: '/l' }).includes('unset'), 'a window run drops the CLAUDE_CODE_* variables it inherited (else Claude does not save the conversation); a background run needs no cleanup');

const dw = [{ tty: '/dev/ttys7', sid: 'd1', openedAt: '2026-11-23T10:00:00Z', items: ['x'] }];
const dnow = Date.parse('2026-11-23T10:30:00Z');
ok(WN.windowsToClose(dw, { now: dnow, idleMs: 120000, doneIdleMs: 20000, lastActivity: () => dnow - 30000, isDone: () => true }).length === 1 && WN.windowsToClose(dw, { now: dnow, idleMs: 120000, doneIdleMs: 20000, lastActivity: () => dnow - 30000, isDone: () => false }).length === 0, 'a window whose blocks are all done closes after 20 s of quiet; one still open waits the full idle time');

const AC = await import('../src/areaContext.mjs');
const md = '# Proyecto\n\nCosas.\n\n## El Boceto: backlog\n\n- Al empezar una sesión: get_today y list_backlog.\n- Trabajamos en este orden.\n\n### Detalle\n\nMás sobre el boceto.\n\n## Otra cosa\n\nNo debe salir.\n';
const ex = AC.extractBocetoRules(md);
ok(/El Boceto: backlog/.test(ex) && /get_today/.test(ex) && /Detalle/.test(ex) && !/Otra cosa/.test(ex) && !/Cosas\./.test(ex), 'the El Boceto section of a CLAUDE.md is extracted with its subsections and nothing else');
ok(AC.asksForCalendar(ex) && !AC.asksForCalendar('Trabaja en una rama.') && AC.extractBocetoRules('# Solo\n\nnada') === '', 'it notices a rule that asks for the calendar; no section means empty');

ok(WN.windowIsOurs('cd x && claude --resume \'e466-aaa\' hola', 'e466-aaa') && !WN.windowIsOurs('francoortiz@mac ~ % ls', 'e466-aaa') && !WN.windowIsOurs('', 'e466-aaa'), 'a window is closed only if its screen shows the conversation we launched in it (a reused tty is left alone)');

const sk = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: R.DEFAULT_DENY }, 'MediLyft', { deploy: true });
const sn = R.toolsFor({ allowedTools: ['Edit'], disallowedTools: R.DEFAULT_DENY }, 'MediLyft');
ok(sk.allow.includes('Bash(SKIP_SEGURIDAD=1 git push origin main)') && !sk.deny.includes('Bash(SKIP_SEGURIDAD=1 git push*)'), 'a push-to-main run may use SKIP_SEGURIDAD=1 git push origin main');
ok(sn.deny.includes('Bash(SKIP_SEGURIDAD=1 git push*)') && !sn.allow.some((x) => /SKIP_SEGURIDAD/.test(x)), 'every other run is denied that command, so a prefixed push cannot slip past the git push rule');
