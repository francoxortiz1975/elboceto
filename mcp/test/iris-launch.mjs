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
