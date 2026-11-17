import { buildEngineInput, proposalChanges } from '../../src/lib/scheduler/config.js';
import { runEngine } from '../../src/lib/scheduler/engine.js';
import { placeAreaItem } from '../../src/lib/areaPlan.js';
const today = '2026-11-17';
const plan = {
  areas: [{ id: 'm', name: 'MediLyft', c: 4 }], hidden: [],
  scheduler: { attrs: { f1: { flex: true } } },
  items: [
    { id: 'late', area: 'm', text: 'Feature de ayer', done: false, day: '2026-11-16', at: 1260, dur: 60 },
    { id: 'f1', area: 'm', text: 'Feature viernes (lock)', done: false, day: '2026-11-20', at: 1260, dur: 60, lock: true },
    { id: 'f2', area: 'm', text: 'Feature jueves', done: false, day: '2026-11-19', at: 1260, dur: 60, flex: false },
    { id: 'lateLock', area: 'm', text: 'Atrasado con lock', done: false, day: '2026-11-16', at: 1200, dur: 60, lock: true }
  ]
};
const inp = buildEngineInput(plan, today);
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
ok(inp.blocks.some((b) => b.name.includes('viernes')), 'locked + flex item is a fixed block');
ok(!inp.tasks.some((t) => t.id === 'f1' || t.id === 'lateLock'), 'locked items are never tasks (even late)');
ok(inp.tasks.some((t) => t.id === 'late'), 'unlocked late item is still a task');
const res = runEngine(inp.cfg, inp.tasks, { today, nowMin: 0, blocks: inp.blocks });
const ch = proposalChanges(plan, res);
ok(!ch.some((c) => c.id === 'f1' || c.id === 'lateLock'), 'proposalChanges never touches locked items');
const pl = res.placed.find((p) => p.task.id === 'late');
ok(pl && !(res.G.days[pl.choice.d] === '2026-11-20' && pl.choice.start === 1260), 'engine does not place a task on top of the lock');
const moved = placeAreaItem(plan, 'f1', { day: '2026-11-21', at: 600 });
ok(moved === plan, 'placeAreaItem ignores a locked item');
