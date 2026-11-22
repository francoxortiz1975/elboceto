import { findDue, launchPrompt, setLaunchState, isAutoStart } from '../../src/lib/irisLaunch.js';
import { addNotes } from '../../src/lib/iris.js';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const at = (h, m) => new Date(2026, 10, 18, h, m);   // Wed 18 Nov 2026, local time
const blk = (id, extra) => ({ id, area: 'm', text: id, done: false, day: '2026-11-18', at: 21 * 60, dur: 60, iris: { launch: true, state: 'pending' }, ...extra });
let plan = { areas: [{ id: 'm', name: 'MediLyft', c: 3 }, { id: 'l', name: 'Loginet', c: 5 }], items: [blk('a'), blk('b', { area: 'l' }), { id: 'plain', area: 'm', text: 'x', done: false, day: '2026-11-18', at: 1260, dur: 60 }] };
plan = addNotes(plan, [{ area: 'm', kind: 'order', item: 'a', text: 'Hacer el botón de reagendar. Criterio: probado en rama.' }]);
const areas = { medilyft: '/Users/x/MEDILYFT', Loginet: '/Users/x/loginet-web' };
let r = findDue(plan, at(20, 59), areas); ok(!r.due.length && !r.missed.length, 'a minute before the block: nothing is due');
r = findDue(plan, at(21, 0), areas); ok(r.due.length === 2 && r.due.every((d) => d.dir), 'at the start time: both are due, each with its area folder (area names match case-insensitively)');
ok(findDue(plan, at(21, 40), areas).due.length === 2, 'a late pass inside the block still opens it (e.g. the Mac woke up late)');
r = findDue(plan, at(22, 0), areas); ok(!r.due.length && r.missed.length === 2, 'after the block ended without opening: missed, never opened late');
ok(!findDue(plan, at(21, 0), areas).due.some((d) => d.item.id === 'plain'), 'a block without the autostart mark is never opened');
r = findDue(plan, at(21, 0), { MediLyft: '/x' }); ok(r.due.length === 1 && r.noDir.length === 1 && r.noDir[0].id === 'b', 'an area with no folder is reported, not opened');
plan = { ...plan, items: plan.items.map((i) => (i.id === 'a' ? { ...i, done: true } : i)) };
ok(findDue(plan, at(21, 0), areas).due.length === 1, 'a block already done is not opened');
const after = setLaunchState(plan, ['b'], 'launched'); ok(after.items.find((i) => i.id === 'b').iris.state === 'launched' && findDue(after, at(21, 5), areas).due.length === 0, 'once launched it is not opened again');
ok(findDue({ ...plan, items: plan.items.map((i) => (i.id === 'b' ? { ...i, day: '2026-11-19' } : i)) }, at(21, 0), areas).due.length === 0, 'if the planner moved the block to another day, the start moves with it');
ok(findDue({ ...plan, items: [blk('c', { day: '2026-11-17' })] }, at(9, 0), areas).missed.length === 1, 'a block of a past day that never opened is marked missed');
const p = launchPrompt(addNotes({ ...plan, items: [blk('a')] }, [{ area: 'm', kind: 'order', item: 'a', text: 'Hacer el botón.' }]), blk('a'));
ok(/área MediLyft/.test(p) && /Hacer el botón/.test(p) && /21:00–22:00/.test(p) && /report_progress\(area="MediLyft", item_id="a"/.test(p) && /sin desplegar ni publicar/.test(p), 'the prompt names the area, carries the order, the time and how to report, and forbids deploying');
ok(isAutoStart(blk('z')) && !isAutoStart({ id: 'q' }), 'isAutoStart');
// ---- the link that opens the Claude desktop app ----
import { deepLink } from '../../src/lib/irisLaunch.js';
const url = deepLink('/Users/franco/Desktop/MEDILYFT/teledox', 'Hola: "x" & y\nlínea 2');
ok(url.startsWith('claude://code/new?folder=%2FUsers%2Ffranco%2FDesktop%2FMEDILYFT%2Fteledox&q='), 'the link targets a new Code session in the area folder');
const q = new URL(url).searchParams;
ok(q.get('folder') === '/Users/franco/Desktop/MEDILYFT/teledox' && q.get('q') === 'Hola: "x" & y\nlínea 2', 'folder and message survive the encoding (quotes, &, newlines, accents)');
const long = launchPrompt({ ...plan, items: [blk('a')], iris: { notes: [] } }, blk('a'));
const bigPlan = addNotes({ ...plan, items: [blk('a')] }, [{ area: 'm', kind: 'order', item: 'a', text: 'X'.repeat(4000) }]);
const cut = launchPrompt(bigPlan, blk('a'));
ok(cut.length < 2400 && /buzón de IRIS/.test(cut) && /report_progress/.test(cut), 'a very long order is cut to fit in a link; the rest stays in the inbox and the how-to-report line is kept');
ok(launchPrompt(bigPlan, blk('a'), { max: 5000 }).length > 2400, 'the cut is configurable');

// ---- orders finished without a report_progress ----
import { findFinished, markReported } from '../../src/lib/irisLaunch.js';
const fp = { ...plan, items: [blk('f1', { done: true, iris: { launch: true, state: 'launched' } }), blk('f2', { done: false, iris: { launch: true, state: 'launched' } }), blk('f3', { done: true, iris: { launch: true, state: 'launched', reported: true } }), blk('f4', { done: true, iris: { launch: true, state: 'pending' } })] };
ok(findFinished(fp).map((i) => i.id).join() === 'f1', 'finished = opened by IRIS+, now done, not yet reported (not-done, already-reported and never-opened ones are ignored)');
ok(findFinished(markReported(fp, ['f1'])).length === 0, 'once reported it is not reported again');
ok(/complete_item/.test(launchPrompt({ ...plan, items: [blk('a')] }, blk('a'))), 'the prompt tells the conversation what to do if it has no report_progress');

import { findCompanions, isNight } from '../../src/lib/irisLaunch.js';
const L = { findCompanions, isNight };
const bp2 = { items: [
  { id: 'a', area: 'm', day: '2026-11-20', at: 60, dur: 30, iris: { launch: true } },
  { id: 'b', area: 'm', day: '2026-11-20', at: 90, dur: 30, iris: { launch: true } },
  { id: 'c', area: 'm', day: '2026-11-20', at: 150, dur: 30, iris: { launch: true } },
  { id: 'd', area: 'm', day: '2026-11-20', at: 600, dur: 30, iris: { launch: true } },
  { id: 'e', area: 'x', day: '2026-11-20', at: 100, dur: 30, iris: { launch: true } },
  { id: 'f', area: 'm', day: '2026-11-20', at: 100, dur: 30, done: true, iris: { launch: true } }
] };
ok(L.findCompanions(bp2, bp2.items[0]).map((i) => i.id).join() === 'b,c', 'batch: next blocks of the same area within 3 h, in time order, max 3 in total');
ok(L.findCompanions(bp2, bp2.items[0], { max: 2 }).map((i) => i.id).join() === 'b', 'batch size is capped');
ok(L.findCompanions(bp2, bp2.items[0], { windowMin: 20 }).length === 0, 'blocks outside the window do not join');
ok(L.isNight(90) && L.isNight(22 * 60) && !L.isNight(10 * 60), 'night is 21:00-07:00');

import { completePastClasses } from '../../src/lib/areaPlan.js';
const cp = { items: [
  { id: 'im-g2:2026-11-20:08:30', day: '2026-11-20', at: 510, dur: 90, done: false },
  { id: 'im-g2:2026-11-20:12:00', day: '2026-11-20', at: 720, dur: 90, done: false },
  { id: 'im-g2:2026-11-19:08:30', day: '2026-11-19', at: 510, dur: 90, done: false },
  { id: 'ap_x', day: '2026-11-20', at: 60, dur: 30, done: false }
] };
const cn = completePastClasses(cp, new Date(2026, 10, 20, 12, 44));
ok(cn.items.map((i) => i.done).join() === 'true,false,true,false', 'classes that ended are done; one in progress and other blocks are not touched');
ok(completePastClasses(cn, new Date(2026, 10, 20, 12, 44)) === cn, 'nothing to change returns the same plan');

import { devStacks, addDevStack, addDevSlot, moveDevStack, removeDevItem } from '../../src/lib/devStacks.js';
let dp = { items: [{ id: 'z', area: 'm', text: 'otro', done: false, day: '2026-11-21', at: 'any' }] };
const a1 = addDevStack(dp, { area: 'm', name: 'Recordatorios', day: '2026-11-23' });
const a2 = addDevStack(a1.plan, { area: 'm', name: 'Login', day: '2026-11-22' });
ok(addDevStack(dp, { area: 'm', name: '  ' }).id === null, 'a stack needs a name');
ok(devStacks(a2.plan, 'm').map((s) => s.main.text).join() === 'Login,Recordatorios', 'stacks of an area come ordered by day; blocks that are not dev are ignored');
const s1 = addDevSlot(a2.plan, a1.id, 'check');
ok(devStacks(s1.plan, 'm').find((s) => s.id === a1.id).check.day === '2026-11-23' && addDevSlot(s1.plan, a1.id, 'check').id === null, 'plan / check pieces follow the feature day and are created once');
const mv = moveDevStack(s1.plan, a1.id, '2026-11-25');
ok(mv.items.filter((i) => i.dev && i.dev.s === a1.id).every((i) => i.day === '2026-11-25'), 'moving a stack moves all its pieces');
ok(removeDevItem(mv, a1.id).items.every((i) => !(i.dev && i.dev.s === a1.id)) && removeDevItem(mv, s1.id).items.length === mv.items.length - 1, 'removing the feature removes the stack; removing a piece removes only that piece');

import { migrateToDev, dropDev, detachDev, nudgeDevStack, setDevTime, setDevLaunch, devBrief } from '../../src/lib/devStacks.js';
const mp = { items: [
  { id: 'm1', area: 'm', text: 'A', done: false, day: '2026-11-23', at: 'any' },
  { id: 'm2', area: 'm', text: 'B', done: false, day: '2026-11-23', at: 'any', note: 'detalle' },
  { id: 'm3', area: 'm', text: 'ya hecha', done: true, day: '2025-01-01', at: 'any' },
  { id: 'r1', area: 'm', text: 'reel', done: false, day: '2026-11-23', at: 'any', reel: 'x' },
  { id: 'o1', area: 'other', text: 'otra área', done: false, day: '2026-11-23', at: 'any' }
] };
const mg = migrateToDev(mp, 'm');
ok(devStacks(mg, 'm').map((s) => s.id).join() === 'm1,m2' && migrateToDev(mg, 'm') === mg, 'import: open tasks of the area become stacks; very old done, generated and other-area ones do not; running it again changes nothing');
const dd = dropDev(mg, 'm2', 'm1', 'check');
ok(devStacks(dd.plan, 'm').length === 1 && devStacks(dd.plan, 'm')[0].check.id === 'm2', 'dropping a stack on an empty slot folds it into the other stack with that role');
ok(dropDev(dd.plan, 'm1', 'm1', 'plan').plan === dd.plan, 'a stack cannot be dropped on itself');
ok(detachDev(dd.plan, 'm2').items.find((i) => i.id === 'm2').dev.r === 'build', 'a piece can become its own stack again');
const nn = nudgeDevStack(mg, 'm2', -1);
ok(devStacks(nn, 'm').map((s) => s.id).join() === 'm2,m1' && nudgeDevStack(mg, 'm1', -1) === mg, 'stacks move up and down within their day; the first one cannot go higher');
ok(setDevLaunch(mg, 'm1', true) === mg, 'launching by itself needs a time');
const lt = setDevLaunch(setDevTime(mg, 'm2', 1290), 'm2', true);
ok(lt.items.find((i) => i.id === 'm2').iris.launch === true && lt.iris.notes.length === 1 && /detalle/.test(lt.iris.notes[0].text) && lt.iris.notes[0].kind === 'order' && lt.iris.notes[0].item === 'm2', 'turning the launch on marks the block and leaves the order (with the comments) in the area inbox');
ok(setDevLaunch(lt, 'm2', false).items.find((i) => i.id === 'm2').iris.launch === false, 'and it can be turned off');

import { needsReview, isValidated, toggleDevDone, setDevValid, stackSettled, reportOf } from '../../src/lib/devStacks.js';
const rp = { items: [
  { id: 'd1', area: 'm', text: 'hecha hoy', done: true, day: '2026-11-22', at: 'any' },
  { id: 'd2', area: 'm', text: 'hecha hace un mes y medio', done: true, day: '2026-10-01', at: 'any' },
  { id: 'd3', area: 'm', text: 'hecha hace 10 días', done: true, day: '2026-11-12', at: 'any' }
], iris: { notes: [{ id: 'n', item: 'd1', dir: 'to_hub', from: 'area', kind: 'report', text: 'LISTO: 2 usuarios demo' }, { id: 'l', item: 'd1', dir: 'to_hub', from: 'launcher', kind: 'report', text: 'aviso' }] } };
const rm = migrateToDev(rp, 'm', '2026-11-22');
ok(rm.items.find((i) => i.id === 'd1').dev.v === undefined && rm.items.find((i) => i.id === 'd3').dev.v === true && !rm.items.find((i) => i.id === 'd2').dev, 'import: done work from the last days waits for validation, older done work is already validated, very old is left out');
ok(needsReview(rm.items[0]) && !isValidated(rm.items[0]), 'a finished piece needs review');
const vv = setDevValid(rm, 'd1', true);
ok(isValidated(vv.items[0]) && stackSettled({ main: vv.items[0], plan: null, check: null }), 'once validated the stack settles (it leaves the default view)');
ok(needsReview(toggleDevDone(toggleDevDone(vv, 'd1'), 'd1').items[0]), 'finishing it again starts a new review');
ok(reportOf(rm, 'd1') === 'LISTO: 2 usuarios demo', 'the report shown is the area’s own, not the launcher’s notice');

import { setDevBatch } from '../../src/lib/devStacks.js';
const bb = { items: ['x', 'y', 'z'].map((id) => ({ id, area: 'm', text: id, done: false, day: '2026-11-30', at: 'any', dev: { s: id, r: 'build' } })) };
const bo = setDevBatch(bb, ['x', 'y', 'z'], { day: '2026-11-30', time: 600 });
ok(!bo.error && bo.plan.items.every((i) => i.iris.batch === bo.batch) && bo.plan.items.map((i) => i.at).join() === '600,660,720', 'a batch lines the features up one after another');
const lead = bo.plan.items[0];
ok(findCompanions(bo.plan, lead, { windowMin: 1, max: 2 }).map((i) => i.id).join() === 'y,z', 'a user batch ignores the night window and the size cap: every feature of the batch rides along');
ok(setDevBatch(bb, ['x'], { day: '2026-11-30', time: 600 }).error !== '' && setDevBatch(bb, ['x', 'y'], { day: 'later', time: 600 }).error !== '', 'a batch needs two features and an exact day and time');

import { unbatch } from '../../src/lib/devStacks.js';
const ub = unbatch(bo.plan, bo.batch);
ok(ub.items.every((i) => !i.iris.batch && i.iris.launch === true), 'undoing a batch keeps each feature launching on its own');

import { parseReport } from '../../src/lib/devStacks.js';
const sr = parseReport('RESUMEN: Botón rojo listo\nHECHO:\n- Cambié .btn-submit\n- Probé el hover\nVERIFICAR:\n1. Abre /login\n2. Mira el botón\nDECISIONES:\n- Dejé --primary igual\nPENDIENTE:\n- Nada\nRAMA: iris/boton · COMMIT: 93f8c16');
ok(sr.structured && sr.summary === 'Botón rojo listo' && sr.done.length === 2 && sr.verify.join() === 'Abre /login,Mira el botón' && sr.decisions.length === 1 && sr.branch === 'iris/boton' && sr.commit === '93f8c16', 'a report with sections is split into summary, done, verify steps, decisions, pending and branch/commit');
const fr = parseReport('LISTO bloque X. Rama local iris/demo-nova, commit 93f8c16 sobre main, sin push. QUÉ HACE: lista de servicios. Decisión que quedó para Franco: encender las variables. No pude leer las variables de Vercel porque me fue denegado.');
ok(!fr.structured && fr.branch === 'iris/demo-nova,' .replace(',', '') && fr.commit === '93f8c16' && fr.decisions.length === 1 && fr.pending.length === 1 && fr.done.length >= 1, 'a free-form report is split into sentences and sorted: decisions, things left undone, the rest as done; branch and commit are picked out');
ok(parseReport('').done.length === 0, 'an empty report parses to nothing');

import { batchStatus, addToBatch } from '../../src/lib/devStacks.js';
import { staleLaunched, markEnded } from '../../src/lib/irisLaunch.js';
const mk = (o) => ({ iris: { launch: true, state: 'launched', batch: 'b1', at: '2026-11-22T10:40:00Z', ...o.iris }, ...o, iris: { launch: true, state: 'launched', batch: 'b1', at: '2026-11-22T10:40:00Z', ...(o.iris || {}) } });
const st = (m) => ({ main: m });
ok(batchStatus([st(mk({ id: 'a', done: true })), st(mk({ id: 'b', done: false }))]).key === 'running', 'running while the other features are not finished and the run has not ended');
ok(batchStatus([st(mk({ id: 'a', done: true })), st(mk({ id: 'b', done: false, iris: { ended: 'x' } }))]).key === 'ended', 'the run ended with a feature left open: says so instead of "en marcha"');
ok(batchStatus([st(mk({ id: 'a', done: true })), st(mk({ id: 'b', done: true }))]).key === 'done' && batchStatus([st(mk({ id: 'a', iris: { state: 'pending' } }))]).key === 'pending', 'done and pending batches');
const sp = { items: [mk({ id: 'a', done: false }), mk({ id: 'b', done: true }), mk({ id: 'c', done: false, iris: { at: new Date().toISOString() } })] };
ok(staleLaunched(sp, Date.parse('2026-11-22T11:00:00Z')).map((i) => i.id).join() === 'a', 'only blocks launched a while ago and still open count as stale');
ok(markEnded(sp, ['a']).items[0].iris.ended && !markEnded(sp, ['a']).items[1].iris.ended, 'the end is stamped on the chosen blocks only');
const pb = { items: [
  { id: 'p1', area: 'm', text: 'P1', done: false, day: '2026-11-23', at: 600, dur: 60, dev: { s: 'p1', r: 'build' }, iris: { launch: true, state: 'pending', batch: 'bb' } },
  { id: 'p2', area: 'm', text: 'P2', done: false, day: '2026-11-23', at: 660, dur: 60, dev: { s: 'p2', r: 'build' }, iris: { launch: true, state: 'pending', batch: 'bb' } },
  { id: 'n1', area: 'm', text: 'N1', done: false, day: '2026-11-25', at: 'any', dev: { s: 'n1', r: 'build' } }
] };
const ab = addToBatch(pb, 'bb', ['n1']);
ok(!ab.error && ab.plan.items.find((i) => i.id === 'n1').at === 720 && ab.plan.items.find((i) => i.id === 'n1').day === '2026-11-23' && ab.plan.items.find((i) => i.id === 'n1').iris.batch === 'bb' && ab.plan.iris.notes.length === 1, 'adding to a pending batch puts the feature after the last one, same day, with its order');
const started = { items: pb.items.map((i) => (i.id === 'p1' ? { ...i, iris: { ...i.iris, state: 'launched' } } : i)) };
ok(addToBatch(started, 'bb', ['n1']).error.includes('ya empezó'), 'a batch that already started refuses new features');
ok(addToBatch({ items: [...pb.items, ...['x', 'y', 'z'].map((id) => ({ id, area: 'm', text: id, done: false, day: '2026-11-23', at: 'any', dev: { s: id, r: 'build' } }))] }, 'bb', ['n1', 'x', 'y', 'z']).error.includes('5'), 'a batch holds at most 5');

import { findByRef, assignCode, addModification, suggestModule, bulkAssign, nextFeatureCode, codeOf } from '../../src/lib/devCodes.js';
const cp2 = { areas: [{ id: 'medilyft', name: 'MediLyft' }], items: [
  { id: 'k1', area: 'medilyft', text: 'Chat: flujo del bot', done: false, day: '2026-11-25', at: 'any', dev: { s: 'k1', r: 'build' } },
  { id: 'k2', area: 'medilyft', text: 'Agendamiento 1/3', done: false, day: '2026-11-24', at: 'any', dev: { s: 'k2', r: 'build' } },
  { id: 'k3', area: 'medilyft', text: 'Algo sin clasificar', done: false, day: '2026-11-24', at: 'any', dev: { s: 'k3', r: 'build' } },
  { id: 'k4', area: 'medilyft', text: 'Otro del bot de WhatsApp', done: false, day: '2026-11-26', at: 'any', dev: { s: 'k4', r: 'build' } }
] };
const a1c = assignCode(cp2, 'k1', 'CB');
ok(a1c.code === 'MCB001' && assignCode(a1c.plan, 'k1', 'CB').error.includes('no cambian') && assignCode(cp2, 'k1', 'ZZ').error !== '', 'the first ticket of a module is 001, a code never changes and an unknown module is refused');
const a2c = assignCode(a1c.plan, 'k4', 'CB');
ok(a2c.code === 'MCB002' && nextFeatureCode(a2c.plan, 'medilyft', 'A') === 'MA001', 'numbers run per module (MCB002 after MCB001, MA starts at 001)');
const md = addModification(a2c.plan, 'mcb001', 'Cambiar el saludo');
const md2 = addModification(md.plan, 'MCB001', 'Otro ajuste');
ok(md.code === 'MCB001.1' && md2.code === 'MCB001.2' && addModification(md2.plan, 'MCB001.1', 'Sobre una modificación').code === 'MCB001.3', 'modifications are numbered under their feature (.1, .2, .3), even when asked from another modification');
ok(addModification(cp2, 'k1', 'x').error.includes('código'), 'a feature without a code cannot have modifications');
ok(findByRef(md2.plan, 'mcb001.2').id === md2.id && findByRef(md2.plan, 'k2').id === 'k2', 'a stack can be found by id or by code, in any case');
ok(suggestModule('Agendamiento 3/3: Mis citas', 'medilyft') === 'A' && suggestModule('Demo Nova: ensayo', 'medilyft') === 'D' && suggestModule('Adaptar métricas del panel de psicología', 'medilyft') === 'P' && suggestModule('Notificaciones a la psicóloga (WhatsApp)', 'medilyft') === 'P' && suggestModule('xyz', 'medilyft') === '' && suggestModule('bot', 'otra') === '', 'module suggestions by title; none when unsure or for an area without codes');
const bk = bulkAssign(cp2, 'medilyft');
ok(bk.n === 3 && bk.left === 1 && codeOf(bk.plan.items.find((i) => i.id === 'k2')) === 'MA001' && !codeOf(bk.plan.items.find((i) => i.id === 'k3')), 'bulk assign gives codes to the ones with a suggestion and leaves the rest for the user');

import { ticketStatus, launchNow, requestDeploy, applyDeploys, setNoDeploy, needsDeploy } from '../../src/lib/devStacks.js';
const lp = (m, extra = []) => ({ items: [{ id: 'f1', area: 'm', text: 'Feature', done: false, day: 'later', at: 'any', dev: { s: 'f1', r: 'build', code: 'MC001' }, ...m }, ...extra] });
const stOf = (p) => ({ id: 'f1', main: p.items[0] });
ok(ticketStatus(lp({}), stOf(lp({}))).key === 'pending' && ticketStatus(lp({}), stOf(lp({}))).action === 'schedule', 'a feature with no time is pending and offers to schedule');
const sc = lp({ day: '2026-11-25', at: 600, iris: { launch: true, state: 'pending' } });
ok(ticketStatus(sc, stOf(sc)).key === 'scheduled' && ticketStatus(sc, stOf(sc)).action === 'now', 'day + time + launch = scheduled, with a "launch now" action');
const rn = lp({ iris: { launch: true, state: 'launched' } });
ok(ticketStatus(rn, stOf(rn)).key === 'running', 'launched and open = running');
const dn = lp({ done: true, iris: { launch: true, state: 'launched' } });
ok(ticketStatus(dn, stOf(dn)).key === 'done' && ticketStatus(dn, stOf(dn)).action === 'validate', 'done waits for validation');
const vl = lp({ done: true, iris: { launch: true, state: 'launched' }, dev: { s: 'f1', r: 'build', code: 'MC001', v: true } });
ok(ticketStatus(vl, stOf(vl)).action === 'deploy' && needsDeploy(vl.items[0]) && !stackSettled({ main: vl.items[0] }), 'validated work that IRIS built still needs to reach main, so it does not leave the view');
ok(stackSettled({ main: setNoDeploy(vl, 'f1').items[0] }), 'marking "sin deploy" settles it');
const manual = lp({ done: true, dev: { s: 'f1', r: 'build', v: true } });
ok(!needsDeploy(manual.items[0]) && stackSettled({ main: manual.items[0] }), 'work IRIS never ran (no branch) never asks for a deploy');
ok(requestDeploy(dn, 'f1').error.includes('validado'), 'only validated work can be pushed to main');
const rd = requestDeploy(vl, 'f1', new Date(2026, 10, 22, 14, 5));
const di = rd.plan.items.find((i) => i.deploy);
ok(!rd.error && di.at === 845 && di.day === '2026-11-22' && di.iris.deploy === true && di.iris.launch === true && /iris\/MC001-/.test(rd.plan.iris.notes[0].text) && /--force|force/.test(rd.plan.iris.notes[0].text), 'asking for a deploy creates a block that starts now and leaves the exact steps (branch by code, no force)');
ok(requestDeploy(rd.plan, 'f1').error.includes('Ya se está'), 'a second request while one is running is refused');
ok(ticketStatus(rd.plan, { id: 'f1', main: rd.plan.items[0] }).key === 'deploying', 'while the block runs the status is "subiendo a main"');
const fin = { ...rd.plan, items: rd.plan.items.map((i) => (i.deploy ? { ...i, done: true } : i)) };
const ap = applyDeploys(fin, '2026-11-22T14:30:00Z');
ok(ap.items[0].dev.deployed === '2026-11-22T14:30:00Z' && applyDeploys(ap) === ap && ticketStatus(ap, { id: 'f1', main: ap.items[0] }).key === 'deployed' && stackSettled({ main: ap.items[0] }), 'a finished deploy block marks the feature as deployed and it settles');
const failed = { ...rd.plan, items: rd.plan.items.map((i) => (i.deploy ? { ...i, iris: { ...i.iris, state: 'launched', ended: 'x' } } : i)) };
ok(ticketStatus(failed, { id: 'f1', main: failed.items[0] }).action === 'retry' && !requestDeploy(failed, 'f1').error, 'a deploy run that ended without finishing offers a retry');
const ln = launchNow(lp({}), 'f1', new Date(2026, 10, 22, 9, 30));
ok(ln.items[0].at === 570 && ln.items[0].day === '2026-11-22' && ln.items[0].iris.launch === true, 'launch now = today at this minute');

import { stackVisible } from '../../src/lib/devStacks.js';
const vv1 = lp({ done: true, iris: { launch: true, state: 'launched' }, dev: { s: 'f1', r: 'build', code: 'MC001', v: true } });
const sv = { id: 'f1', main: vv1.items[0] };
ok(!stackVisible(vv1, sv, 'work') && stackVisible(vv1, sv, 'deploy') && stackVisible(vv1, sv, 'all'), 'validated work: hidden in the default view, listed under "por subir a main", shown in "todo"');
const dpl = { ...vv1, items: [{ ...vv1.items[0], dev: { ...vv1.items[0].dev, deployed: 'x' } }] };
ok(!stackVisible(dpl, { id: 'f1', main: dpl.items[0] }, 'work') && !stackVisible(dpl, { id: 'f1', main: dpl.items[0] }, 'deploy') && stackVisible(dpl, { id: 'f1', main: dpl.items[0] }, 'all'), 'deployed work is only in "todo"');
const pend = lp({});
ok(stackVisible(pend, { id: 'f1', main: pend.items[0] }, 'work') && !stackVisible(pend, { id: 'f1', main: pend.items[0] }, 'deploy'), 'open work is in the default view only');
const pushing = requestDeploy(vv1, 'f1', new Date(2026, 10, 22, 14, 5)).plan;
ok(stackVisible(pushing, { id: 'f1', main: pushing.items[0] }, 'work') && stackVisible(pushing, { id: 'f1', main: pushing.items[0] }, 'deploy'), 'a push in progress shows in both working views');

import { validateAndDeploy } from '../../src/lib/devStacks.js';
const vd = validateAndDeploy(dn, 'f1', new Date(2026, 10, 22, 14, 5));
ok(!vd.error && vd.plan.items[0].dev.v === true && vd.plan.items.some((i) => i.deploy && i.iris.deploy), 'one click validates and starts the push to main for work IRIS built');
const mv2 = validateAndDeploy(manual, 'f1');
ok(!mv2.error && !mv2.plan.items.some((i) => i.deploy), 'work with no branch is only validated, nothing is pushed');

const ms = lp({ day: '2026-11-27', at: 660, iris: { launch: true, state: 'missed' } });
ok(ticketStatus(ms, { id: 'f1', main: ms.items[0] }).key === 'missed' && ticketStatus(ms, { id: 'f1', main: ms.items[0] }).action === 'schedule', 'a block that was never opened shows as lost, with "agendar" to try again');
