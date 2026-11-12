// The scheduler's settings live inside the plan (plan.scheduler), so they sync to the cloud like everything else:
//   profile (sleep, meals, work window, energy, caps, buffers, places), fixed (recurring events, with rotating weeks),
//   areaOrder (priority stack of area ids), weights, attrs (per-item attributes, only what differs from the defaults).

import { addDays, durOf, isoOf } from '../areaPlan';
import { WEIGHTS, HORIZON } from './engine';

export const DEFAULT_PROFILE = {
  wake: '07:30', bed: '23:30',
  meals: [
    { name: 'Desayuno', start: '08:00', dur: 20, on: true },
    { name: 'Almuerzo', start: '13:00', dur: 60, on: true },
    { name: 'Cena', start: '20:30', dur: 45, on: true }
  ],
  window: { from: '08:00', to: '22:00' },
  open: [true, true, true, true, true, true, false],
  energy: { am: 4, pm: 3, ev: 2 },
  deepCap: 5, buffer: 10, bufferFixed: 15,
  places: [{ name: 'Casa', min: 0 }, { name: 'Campus', min: 35 }, { name: 'Trabajo', min: 25 }, { name: 'Cualquiera', min: 0 }]
};

export const DEFAULT_ATTRS = { prio: 3, effort: 'light', place: 'Casa' };

// The plan's scheduler settings with every missing piece filled in.
export function getScheduler(plan) {
  const s = (plan && plan.scheduler) || {};
  const areaIds = (plan.areas || []).map((a) => a.id);
  const order = (s.areaOrder || []).filter((id) => areaIds.includes(id));
  return {
    profile: {
      ...DEFAULT_PROFILE, ...(s.profile || {}),
      window: { ...DEFAULT_PROFILE.window, ...((s.profile || {}).window || {}) },
      energy: { ...DEFAULT_PROFILE.energy, ...((s.profile || {}).energy || {}) }
    },
    fixed: s.fixed || [],
    areaOrder: [...order, ...areaIds.filter((id) => !order.includes(id))],
    weights: { ...Object.fromEntries(WEIGHTS.map((w) => [w.id, w.def])), ...(s.weights || {}) },
    attrs: s.attrs || {}
  };
}

export const attrsOf = (cfg, itemId) => ({ ...DEFAULT_ATTRS, ...(cfg.attrs[itemId] || {}) });

export const mondayOfIso = (iso) => { const d = new Date(`${iso}T00:00:00`); return addDays(iso, -((d.getDay() + 6) % 7)); };

export const newFixed = (areaId) => ({
  id: `fx_${Math.random().toString(36).slice(2, 8)}`, name: 'Nuevo evento fijo', days: [0], from: '09:00', to: '13:00',
  place: 'Casa', area: areaId || '', optional: false, cycle: 1, weeks: [0], anchor: mondayOfIso(isoOf(new Date())), start: '', end: '', skip: []
});

// What the engine gets from the real plan: tasks to place, and fixed blocks that are already in the calendar.
//  - items with a time from today on are fixed blocks (unless marked movable); past ones are not done, so they are tasks
//  - Reels / Stories bound to a stack keep their date: blocks if timed, ignored otherwise
//  - untimed items inside the next 7 days are tasks; "Más adelante" only with includeLater
export function buildEngineInput(plan, today, { includeLater = false } = {}) {
  const cfg = getScheduler(plan);
  const end = addDays(today, HORIZON - 1);
  const tasks = []; const blocks = [];
  plan.items.forEach((it) => {
    if (it.done) return;
    const a = attrsOf(cfg, it.id);
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(it.day || '') ? it.day : null;
    const asBlock = () => { if (iso && iso >= today && iso <= end && typeof it.at === 'number') blocks.push({ day: iso, from: it.at, to: it.at + durOf(it), name: it.text, area: it.area, place: a.place === 'Casa' ? '' : a.place }); };
    if (it.reel && it.stackId) { asBlock(); return; }
    if (iso && iso >= today && typeof it.at === 'number' && !a.flex) { asBlock(); return; }
    if (!iso && !includeLater) return;
    if (iso && iso > end) return;
    tasks.push({
      id: it.id, title: it.text, area: it.area, prio: a.prio, effort: a.effort, dur: a.dur || it.dur || 60,
      orig: iso || today, dl: a.dl || '', dlHard: !!a.dlHard, place: a.place, notBefore: a.notBefore || ''
    });
  });
  return { cfg, tasks, blocks };
}

export const nowMinutes = (d = new Date()) => Math.ceil((d.getHours() * 60 + d.getMinutes()) / 30) * 30;
