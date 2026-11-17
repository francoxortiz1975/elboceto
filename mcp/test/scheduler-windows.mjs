import { buildEngineInput } from '../../src/lib/scheduler/config.js';
import { runEngine, fmtMin } from '../../src/lib/scheduler/engine.js';
const today = '2026-11-17'; // Tuesday
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const plan = {
  areas: [{ id: 'm', name: 'MediLyft', c: 3 }, { id: 'l', name: 'Loginet', c: 5 }], hidden: [],
  scheduler: {
    profile: { meals: [{ name: 'Cena', start: '19:30', dur: 45, on: true }] },
    areaRules: { m: { from: '21:00', to: '22:00' }, l: { from: '21:00', to: '21:30', taskMin: 30, meetFrom: '21:00', meetTo: '22:00', meetMin: 60 } }
  },
  items: [
    { id: 'm1', area: 'm', text: 'MediLyft ayer 1', done: false, day: '2026-11-16', at: 1260, dur: 60 },
    { id: 'm2', area: 'm', text: 'MediLyft ayer 2', done: false, day: '2026-11-16', at: 1260, dur: 60 },
    { id: 'l1', area: 'l', text: 'Loginet t1', done: false, day: '2026-11-16', at: 'any', dur: 90 },
    { id: 'l2', area: 'l', text: 'Loginet t2', done: false, day: '2026-11-16', at: 'any' },
    { id: 'lm', area: 'l', text: 'Loginet reunión', done: false, day: '2026-11-16', at: 1260, dur: 30, kind: 'meeting' },
    { id: 'lock', area: 'm', text: 'Viernes con lock', done: false, day: '2026-11-20', at: 1260, dur: 60, lock: true }
  ]
};
const inp = buildEngineInput(plan, today);
const res = runEngine(inp.cfg, inp.tasks, { today, nowMin: 8 * 60, blocks: inp.blocks });
const at = (id) => { const p = res.placed.find((x) => x.task.id === id); return p ? `${res.G.days[p.choice.d]} ${fmtMin(p.choice.start)} (${p.task.dur}min)` : 'NO'; };
res.placed.forEach((p) => console.log('  ', p.task.title.padEnd(20), at(p.task.id)));
res.unplaced.forEach((p) => console.log('   NO:', p.task.title, '->', p.reason));
ok(res.placed.every((p) => { const s = p.choice.start; const w = p.task.win; return !w || (s >= w[0] && s + p.need * 30 <= w[1]); }), 'every placement is inside its area window');
ok(inp.tasks.find((t) => t.id === 'l1').dur === 30 && inp.tasks.find((t) => t.id === 'l2').dur === 30, 'Loginet tasks last 30 min whatever they had');
ok(inp.tasks.find((t) => t.id === 'lm').dur === 60 && inp.tasks.find((t) => t.id === 'lm').kind === 'meeting', 'Loginet meeting lasts 60 min');
ok(inp.tasks.find((t) => t.id === 'm1').dur === 60, 'MediLyft keeps its own length');
ok(!res.placed.some((p) => res.G.days[p.choice.d] === '2026-11-20' && p.choice.start === 1260 && p.task.area === 'm'), 'nothing lands on the locked Friday 21:00 MediLyft block');
const days = res.placed.map((p) => res.G.days[p.choice.d] + p.choice.start);
ok(new Set(days).size === days.length, 'no two tasks share a slot');
// saturate: 9 Loginet tasks, only 7 nightly 30-min slots in 7 days
plan.items.push(...Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, area: 'l', text: 'extra ' + i, done: false, day: '2026-11-16', at: 'any' })));
const inp2 = buildEngineInput(plan, today); const r2 = runEngine(inp2.cfg, inp2.tasks, { today, nowMin: 8 * 60, blocks: inp2.blocks });
ok(r2.unplaced.length > 0 && r2.unplaced.every((u) => /21:00–21:30|21:00–22:00/.test(u.reason)), 'overflow is reported with the area hours as the reason');
