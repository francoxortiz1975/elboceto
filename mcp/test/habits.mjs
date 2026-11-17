import { newHabit as _nh } from '../../src/lib/scheduler/generate.js';
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
// preferred day impossible (Sunday fully booked by a locked block) -> falls back to another day instead of doing nothing
const bookedSun = { ...lifeBase([H('casa', 'Limpiar casa', { prefer: [6] })]), items: [{ id: 'busy', area: 'life', text: 'Todo el día', done: false, day: '2026-11-22', at: 8 * 60, dur: 14 * 60, lock: true }] };
const fb = planHabits(bookedSun, '2026-11-16', { nowMin: 0 });
const mine = fb.plan.items.filter((i) => i.gen === 'hb:casa');
ok(mine.length === 1 && mine[0].day !== '2026-11-22', 'preferred day full: placed on another day of the week');
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
// ---- regressions found on the phone ----
// default Perfil: Sunday is a rest day. A chore that prefers Sunday must still land on Sunday.
const restSunday = { areas: [{ id: 'life', name: 'Life', c: 0 }], hidden: [], scheduler: { habits: [H('compras', 'Compras', { prefer: [6] }), H('sab', 'Lavar sábanas', { period: 'month', prefer: [6], dur: 30 })] }, items: [] };
let rs = planHabits(restSunday, '2026-11-17', { nowMin: 20 * 60 });
ok(rs.plan.items.length === 2 && rs.plan.items.every((i) => i.day === '2026-11-22'), 'preferred Sunday works although the Perfil marks Sunday as rest');
ok(planHabits(rs.plan, '2026-11-17', { nowMin: 20 * 60 }).plan === rs.plan, 'and it is stable on re-run');
// editing a habit re-places its upcoming blocks (duration, preferred day) instead of leaving them stale
let ed = { ...rs.plan, scheduler: { ...rs.plan.scheduler, habits: rs.plan.scheduler.habits.map((h) => (h.id === 'compras' ? { ...h, dur: 120, prefer: [5] } : h)) } };
ed = planHabits(ed, '2026-11-17', { nowMin: 20 * 60 }).plan;
const comp = ed.items.find((i) => i.text === 'Compras');
ok(comp && comp.dur === 120 && comp.day === '2026-11-21', 'changing duration and preferred day moves/resizes the upcoming block');
ok(ed.items.filter((i) => i.text === 'Compras').length === 1, 'no duplicate after editing');
// renaming only renames
let rn = { ...ed, scheduler: { ...ed.scheduler, habits: ed.scheduler.habits.map((h) => (h.id === 'compras' ? { ...h, name: 'Mercado' } : h)) } };
const rn2 = planHabits(rn, '2026-11-17', { nowMin: 20 * 60 }).plan;
ok(rn2.items.some((i) => i.text === 'Mercado' && i.day === '2026-11-21') && !rn2.items.some((i) => i.text === 'Compras'), 'renaming a habit renames its upcoming blocks in place');
// done blocks keep their history when the habit is edited
let dn = { ...ed, items: ed.items.map((i) => (i.text === 'Compras' ? { ...i, done: true } : i)) };
dn = { ...dn, scheduler: { ...dn.scheduler, habits: dn.scheduler.habits.map((h) => (h.id === 'compras' ? { ...h, dur: 30 } : h)) } };
ok(planHabits(dn, '2026-11-17', { nowMin: 20 * 60 }).plan.items.some((i) => i.text === 'Compras' && i.done && i.dur === 120), 'a done block is never touched');
// removing or switching off a habit clears its upcoming blocks
const offPlan = planHabits({ ...rs.plan, scheduler: { ...rs.plan.scheduler, habits: rs.plan.scheduler.habits.map((h) => (h.id === 'compras' ? { ...h, on: false } : h)) } }, '2026-11-17', { nowMin: 20 * 60 }).plan;
ok(!offPlan.items.some((i) => i.text === 'Compras') && offPlan.items.some((i) => i.text === 'Lavar sábanas'), 'switching a habit off removes only its upcoming blocks');
const gone = planHabits({ ...rs.plan, scheduler: { ...rs.plan.scheduler, habits: [] } }, '2026-11-17', { nowMin: 20 * 60 }).plan;
ok(gone.items.length === 0, 'removing the habit removes its upcoming blocks');
// blocks created by the older version (no signature) are re-placed once under the current rules
const legacy = { ...rs.plan, items: rs.plan.items.map((i) => { const { gsig: _g, ...r } = i; return { ...r, day: '2026-11-18', at: 21.5 * 60 }; }) };
const fixed = planHabits(legacy, '2026-11-17', { nowMin: 20 * 60 }).plan;
ok(fixed.items.length === 2 && fixed.items.every((i) => i.day === '2026-11-22'), 'old misplaced blocks (Wednesday night) move to the preferred Sunday');
const nh = _nh;
ok(nh('life').on === false, 'a brand-new habit is switched off until it is configured');
