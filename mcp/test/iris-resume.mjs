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
ok(cmd === `cd '/Users/x/it'\\''s here' && PATH='/Users/x/.nvm/versions/node/v22/bin':"$PATH" '/Users/x/.nvm/versions/node/v22/bin/claude' --resume 'bbb-222' "$(cat '/tmp/m.txt')"`, 'resume command: quoted folder, claude by full path with its folder on PATH, --resume <id>');
ok(R.resumeCommand({ dir: '/a', sid: 's', promptFile: '/p' }) === `cd '/a' && claude --resume 's' "$(cat '/p')"`, 'without a known claude path it uses plain `claude`');
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
