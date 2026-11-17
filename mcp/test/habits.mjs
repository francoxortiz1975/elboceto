import { planHabits, generateFixed, runGenerators } from '../../src/lib/scheduler/generate.js';
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const base = (extra = {}) => ({
  areas: [{ id: 'g', name: 'Gym', c: 1 }, { id: 'w', name: 'Work', c: 2 }], hidden: [],
  scheduler: { profile: { open: [true, true, true, true, true, true, true] }, habits: [{ id: 'h1', name: 'Gym', area: 'g', perWeek: 4, dur: 60, from: '18:00', to: '21:00', maxPerDay: 1, on: true }],
    fixed: [{ id: 'f1', name: 'Trabajo', days: [0, 1, 2], from: '09:00', to: '13:00', place: 'Casa', area: 'w', calendar: true, cycle: 1, weeks: [0] }], ...extra },
  items: []
});
const week = (plan, id) => plan.items.filter((i) => i.gen === `hb:${id}`).map((i) => `${i.day}${i.done ? '✓' : ''}@${i.at / 60}`).sort().join(' ');
// Monday 2026-11-16: plans 4 gym blocks this week, one per day
let r = planHabits(base(), '2026-11-16', { nowMin: 0 });
console.log('  Mon:', week(r.plan, 'h1'));
ok(r.added === 4 && new Set(r.plan.items.map((i) => i.day)).size === 4, 'Monday: 4 blocks on 4 different days');
ok(r.plan.items.every((i) => i.at >= 18 * 60 && i.at + 60 <= 21 * 60), 'all inside the habit hours 18-21');
const again = planHabits(r.plan, '2026-11-16', { nowMin: 0 });
ok(again.plan === r.plan && again.added === 0, 'running twice changes nothing');
// Wednesday evening: Mon done, Tue missed, Wed planned not done -> remaining 3
let p = r.plan; const monItem = p.items.find((i) => i.day === '2026-11-16'); monItem.done = true;
p = { ...p, items: p.items.map((i) => (i.day === '2026-11-16' ? { ...i, done: true } : i)) };
const wed = planHabits(p, '2026-11-18', { nowMin: 0 });
console.log('  Wed:', week(wed.plan, 'h1'));
const pend = wed.plan.items.filter((i) => !i.done);
ok(wed.plan.items.filter((i) => i.done).length === 1 && pend.length === 3 && pend.every((i) => i.day >= '2026-11-18' && i.day <= '2026-11-22'), 'missed ones are re-placed later the SAME week (3 left, Wed..Sun)');
ok(wed.missed >= 1, 'missed blocks are counted');
// Friday with 1 done: remaining 3, days left Fri Sat Sun = 3 -> 3 planned. Saturday: 1 done -> max 2
const fri = planHabits({ ...base(), items: [{ id: 'hb:h1:2026-11-16', area: 'g', text: 'Gym', done: true, day: '2026-11-16', at: 1080, dur: 60, gen: 'hb:h1' }] }, '2026-11-20', { nowMin: 0 });
ok(fri.plan.items.filter((i) => !i.done).length === 3, 'Friday, 1 done of 4: plans 3 (Fri, Sat, Sun)');
const sat = planHabits({ ...base(), items: [{ id: 'hb:h1:2026-11-16', area: 'g', text: 'Gym', done: true, day: '2026-11-16', at: 1080, dur: 60, gen: 'hb:h1' }] }, '2026-11-21', { nowMin: 0 });
ok(sat.plan.items.filter((i) => !i.done).length === 2, 'Saturday, 1 done of 4: only 2 days left -> plans 2 (the most that fits)');
// no carry-over: next Monday starts fresh
const nxt = planHabits(sat.plan, '2026-11-23', { nowMin: 0 });
ok(nxt.plan.items.filter((i) => !i.done && i.day >= '2026-11-23').length === 4, 'next Monday starts again from the full target (4)');
// closed Sunday (default profile) -> fewer fit
const closed = base({ profile: { open: [true, true, true, true, true, true, false] } });
const c2 = planHabits({ ...closed, items: [] }, '2026-11-20', { nowMin: 0 });
ok(c2.plan.items.filter((i) => !i.done).length === 2, 'Friday with Sunday closed: only Fri+Sat fit -> 2');
// fixed events -> locked blocks, only when marked
let f = generateFixed(base(), '2026-11-16');
ok(f.added === 12 && f.plan.items.every((i) => i.lock && i.gen === 'fx:f1'), 'marked fixed event creates locked blocks (Mon/Tue/Wed x 4 weeks)');
const off = generateFixed(base({ fixed: [{ id: 'f1', name: 'Trabajo', days: [0], from: '09:00', to: '13:00', area: 'w', cycle: 1, weeks: [0] }] }), '2026-11-16');
ok(off.added === 0, 'unmarked fixed event creates nothing');
const del = { ...f.plan, items: f.plan.items.filter((i) => i.day !== '2026-11-17') };
ok(generateFixed(del, '2026-11-16').added === 0, 'a block deleted by hand is not recreated');
const turnedOff = generateFixed({ ...f.plan, scheduler: { ...f.plan.scheduler, fixed: f.plan.scheduler.fixed.map((x) => ({ ...x, calendar: false })) } }, '2026-11-16');
ok(turnedOff.removed === 12 && turnedOff.plan.items.length === 0, 'turning the button off removes the upcoming generated blocks');
const all = runGenerators(base(), '2026-11-16', { nowMin: 0 }); ok(all.changed && all.fixedAdded === 12 && all.habitsAdded === 4, 'runGenerators does both');
// ---- chores: preferred days and monthly cadence (Fase 3b) ----
const lifeBase = (habits, extra = {}) => ({ areas: [{ id: 'life', name: 'Life', c: 0 }], hidden: [], scheduler: { profile: { open: [true, true, true, true, true, true, true] }, habits, ...extra }, items: [] });
const H = (id, name, extra) => ({ id, name, area: 'life', perWeek: 1, period: 'week', prefer: [], dur: 60, from: '', to: '', maxPerDay: 1, on: true, ...extra });
const dayOfItems = (plan) => plan.items.map((i) => `${i.text}:${i.day}@${i.at / 60}`).join(' ');
// Mon 2026-11-16: laundry prefers the weekend, house cleaning and groceries prefer Sunday
let ch = planHabits(lifeBase([H('lav', 'Lavadora', { prefer: [5, 6], dur: 30 }), H('casa', 'Limpiar casa', { prefer: [6], dur: 90 }), H('compras', 'Compras', { prefer: [6] })]), '2026-11-16', { nowMin: 0 });
console.log('  chores:', dayOfItems(ch.plan));
const by = (t) => ch.plan.items.find((i) => i.text === t);
ok(['2026-11-21', '2026-11-22'].includes(by('Lavadora').day), 'laundry (1/week, prefers weekend) lands on Sat or Sun');
ok(by('Limpiar casa').day === '2026-11-22' && by('Compras').day === '2026-11-22', 'cleaning and groceries (prefer Sunday) both land on Sunday');
const sunday = ch.plan.items.filter((i) => i.day === '2026-11-22').sort((a, b) => a.at - b.at);
ok(sunday.every((i, k) => k === 0 || i.at >= sunday[k - 1].at + sunday[k - 1].dur), 'same-day chores do not overlap');
// preferred day impossible (Sunday closed) -> falls back to another day instead of doing nothing
const closedSun = planHabits(lifeBase([H('casa', 'Limpiar casa', { prefer: [6] })], { profile: { open: [true, true, true, true, true, true, false] } }), '2026-11-16', { nowMin: 0 });
ok(closedSun.plan.items.length === 1 && closedSun.plan.items[0].day !== '2026-11-22', 'preferred day closed: placed on another day of the week');
// Sunday evening, not done: the week is over, next Monday starts fresh (nothing carried)
const nextWeek = planHabits(ch.plan, '2026-11-23', { nowMin: 0 });
ok(nextWeek.plan.items.filter((i) => !i.done && i.day >= '2026-11-23').length === 3, 'next week all three chores are planned again');
// Monthly: sheets once a month, preferably Sunday
const mo = planHabits(lifeBase([H('sab', 'Lavar sábanas', { period: 'month', prefer: [6], dur: 30 })]), '2026-11-17', { nowMin: 0 });
ok(mo.plan.items.length === 1 && mo.plan.items[0].day === '2026-11-22', 'monthly chore lands on the next preferred Sunday');
const moDone = { ...mo.plan, items: mo.plan.items.map((i) => ({ ...i, done: true })) };
ok(planHabits(moDone, '2026-11-25', { nowMin: 0 }).plan.items.length === 1, 'monthly chore done: nothing more this month');
ok(planHabits(moDone, '2026-12-01', { nowMin: 0 }).plan.items.filter((i) => !i.done).length === 1, 'new month: planned again');
// Not done by the end of the month: counted missed, nothing carries into the new month beyond the new month's own one
const moMissed = planHabits(mo.plan, '2026-11-30', { nowMin: 0 });
ok(moMissed.missed === 1 && moMissed.plan.items.filter((i) => !i.done).length === 1 && moMissed.plan.items.find((i) => !i.done).day === '2026-11-30', 'monthly chore missed: last-chance slot on the last day of the month');
