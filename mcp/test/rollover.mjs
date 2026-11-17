import { rollover, undoRollover } from '../../src/lib/scheduler/rollover.js';
import { overdueItems } from '../../src/lib/scheduler/overdue.js';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const today = '2026-11-18'; // Wednesday, 00:00
const rules = { m: { from: '21:00', to: '22:00' }, l: { from: '21:00', to: '21:30', taskMin: 30, meetFrom: '21:00', meetTo: '22:00', meetMin: 60 } };
const mk = () => ({
  areas: [{ id: 'm', name: 'MediLyft', c: 3 }, { id: 'l', name: 'Loginet', c: 5 }, { id: 'life', name: 'Life', c: 0 }], hidden: [],
  scheduler: { profile: { meals: [{ name: 'Cena', start: '19:30', dur: 45, on: true }], open: [true, true, true, true, true, true, true] }, areaRules: rules,
    habits: [{ id: 'g', name: 'Gym', area: 'life', perWeek: 4, dur: 60, from: '18:00', to: '21:00', maxPerDay: 1, on: true }],
    fixed: [{ id: 'f1', name: 'Trabajo', days: [0, 1, 2, 3, 4], from: '09:00', to: '13:00', place: 'Casa', area: 'life', cycle: 1, weeks: [0], calendar: true }] },
  items: [
    { id: 'a', area: 'm', text: 'Feature de ayer', done: false, day: '2026-11-17', at: 1260, dur: 60 },
    { id: 'b', area: 'm', text: 'Feature de hoy', done: false, day: '2026-11-18', at: 1260, dur: 60, lock: true },
    { id: 'c', area: 'l', text: 'Factura Loginet', done: false, day: '2026-11-17', at: 'any' },
    { id: 'd', area: 'l', text: 'Reunión cliente', done: false, day: '2026-11-17', at: 1260, dur: 60, kind: 'meeting' },
    { id: 'e', area: 'm', text: 'Bloque con candado de ayer', done: false, day: '2026-11-17', at: 1200, dur: 60, lock: true },
    { id: 'f', area: 'life', text: 'La dejé así', done: false, day: '2026-11-16', at: 'any' },
    { id: 'fx:f1:2026-11-17', area: 'life', text: 'Trabajo', done: false, day: '2026-11-17', at: 540, dur: 240, lock: true, gen: 'fx:f1' },
    { id: 'hb:g:2026-11-17', area: 'life', text: 'Gym', done: false, day: '2026-11-17', at: 1080, dur: 60, gen: 'hb:g' }
  ]
});
let base = mk(); base.scheduler.history = [{ kind: 'skip', id: 'f', t: '2026-11-17T10:00:00Z' }];
const r = rollover(base, today, { nowMin: 0, now: '2026-11-17T23:00:00Z' });
const it = (id) => r.plan.items.find((i) => i.id === id);
ok(r.ran, 'rollover runs');
ok(it('a').day >= today && it('a').at >= 21 * 60 && it('a').at + 60 <= 22 * 60, 'MediLyft feature moved inside its 21:00–22:00 hours');
ok(!(it('a').day === '2026-11-18' && it('a').at === 1260), 'and not on top of the locked block of today');
ok(it('c').at >= 21 * 60 && it('c').at + 30 <= 21.5 * 60 && it('c').dur === 30, 'Loginet task moved to its 21:00–21:30 slot, 30 min');
ok(it('b').day === today && it('b').at === 1260 && it('b').lock, 'a locked block today stays exactly where it is');
ok(it('e').day === '2026-11-17' && it('e').lock, 'a missed locked block is not moved');
ok(it('d').day === '2026-11-17' && it('d').at === 1260, 'a missed meeting is not moved by itself');
ok(it('f').day === '2026-11-16', 'something the user chose to leave ("Dejar") is not moved');
ok(it('fx:f1:2026-11-17').done === true, 'a past fixed-event block is closed, not pending');
ok(!r.plan.items.some((i) => i.id === 'hb:g:2026-11-17') && r.summary.habitsMissed === 1, 'the missed gym block is counted as missed and re-placed in the same week');
ok(r.plan.items.filter((i) => i.gen === 'hb:g' && !i.done).length === 4 && r.plan.items.filter((i) => i.gen === 'hb:g' && !i.done).every((i) => i.day >= today && i.day <= '2026-11-22'), '0 done this week and 5 days left (Wed–Sun): all 4 gym blocks fit, one per day');
const pend = overdueItems(r.plan, today).map((i) => i.id).sort();
ok(JSON.stringify(pend) === JSON.stringify(['d', 'e', 'f']), 'what is left for Pendientes: meeting, locked, left-on-purpose (' + pend.join(',') + ')');
ok(r.summary.moves.length === 2 && r.summary.left.length === 3, 'summary: 2 moved, 3 left');
const again = rollover(r.plan, today, { nowMin: 0 }); ok(!again.ran && again.plan === r.plan, 'second run the same day does nothing');
const u = undoRollover(r.plan);
ok(u.items.find((i) => i.id === 'a').day === '2026-11-17' && u.items.find((i) => i.id === 'c').day === '2026-11-17', 'undo puts the moved tasks back');
ok(u.scheduler.lastRollover.undone && !rollover(u, today, { nowMin: 0 }).ran, 'after undo it does not run again the same day');
const tomorrow = rollover(r.plan, '2026-11-19', { nowMin: 0 }); ok(tomorrow.ran, 'next day it runs again');
// no room: a MediLyft task with all its hours taken stays in Pendientes
const full = mk(); full.scheduler.history = [];
for (let n = 0; n < 7; n++) { const d = `2026-11-${18 + n}`; full.items.push({ id: 'blk' + n, area: 'm', text: 'lleno', done: false, day: d, at: 1260, dur: 60, lock: true }); }
const nf = rollover(full, today, { nowMin: 0 });
ok(nf.summary.left.some((l) => l.id === 'a' && l.why === 'sin hueco en 21:00–22:00') && nf.plan.items.find((i) => i.id === 'a').day === '2026-11-17', 'no free slot in its hours: left for the user (sin hueco)');
// ---- IRIS notes from the nightly rollover ----
const nts = (r.plan.iris && r.plan.iris.notes) || [];
ok(nts.filter((n) => n.area === 'm' && n.from === 'rollover' && /Feature de ayer/.test(n.text) && /pasó de/.test(n.text)).length === 1, 'rollover tells the MediLyft inbox what moved');
ok(nts.some((n) => n.area === 'l' && /Factura Loginet/.test(n.text)), 'rollover tells the Loginet inbox what moved');
ok(nts.some((n) => /Reunión cliente/.test(n.text) && /reunión/.test(n.text)) && nts.some((n) => /candado/.test(n.text)), 'things left for the user are also reported to their area');
ok(nts.every((n) => n.dir === 'to_area' && !n.read), 'all of them are unread notes for the areas');
ok(((undoRollover(r.plan).iris || {}).notes || []).some((n) => n.from === 'user' && /deshizo/.test(n.text)), 'undoing the rollover tells the areas too');
