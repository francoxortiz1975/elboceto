import React, { useRef, useState } from 'react';
import { AREA_COLORS, addDays, fromIso, isoOf, fmtMin, rollingMonth } from '../lib/areaPlan';
import './MonthCalendar.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS = 4;

// Rolling month (today up to one month ahead) of the area plan, plus the
// planner's dated tasks in neutral. Days outside that window are dimmed.
// Clicking a day opens its week; area chips can be dragged to another day.
export function MonthCalendar({ areaPlan, plannerTasks, monthOffset, onOpenDay, onChangeAreaPlan }) {
  const [overIso, setOverIso] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const gestureEnd = useRef(0);

  const todayIso = isoOf(new Date());
  const { anchor, end, gridStart, rows } = rollingMonth(monthOffset, todayIso);
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const iso = addDays(gridStart, i);
    const d = fromIso(iso);
    const label = d.getDate() === 1 || i === 0
      ? `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`
      : String(d.getDate());
    return { iso, label, first: d.getDate() === 1, inWindow: iso >= anchor && iso <= end };
  });

  const areas = areaPlan?.areas || [];
  const hidden = areaPlan?.hidden || [];
  const areaById = Object.fromEntries(areas.map((a) => [a.id, a]));
  const colorOf = (a) => AREA_COLORS[a.c % AREA_COLORS.length];

  const chipsFor = (iso) => {
    const fromAreas = (areaPlan?.items || [])
      .filter((it) => it.day === iso && areaById[it.area] && !hidden.includes(it.area))
      .map((it) => ({
        key: it.id, item: it, text: it.text, done: !!it.done,
        color: colorOf(areaById[it.area]), area: areaById[it.area].name, note: it.note,
        at: typeof it.at === 'number' ? it.at : null
      }));
    const fromPlanner = (plannerTasks || [])
      .filter((t) => t.dayIso === iso && t.timeSlot && t.timeSlot !== 'all_day')
      .map((t) => ({
        key: t.id, item: null, text: t.text, done: !!t.completed, color: null, area: 'Planificador',
        at: Number(t.timeSlot.slice(0, 2)) * 60 + Number(t.timeSlot.slice(3, 5))
      }));
    return [...fromAreas, ...fromPlanner].sort((x, y) => (x.at ?? 1e6) - (y.at ?? 1e6));
  };

  const startMove = (e, chip) => {
    if (e.button !== 0 || !chip.item) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let active = false;
    let last = chip.item.day;
    const move = (ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        active = true;
        setMovingId(chip.key);
        document.body.classList.add('ap-moving');
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = hit && hit.closest('[data-iso]');
      if (!cell) return;
      setOverIso(cell.dataset.iso);
      if (cell.dataset.iso === last) return;
      last = cell.dataset.iso;
      onChangeAreaPlan((p) => ({
        ...p, items: p.items.map((i) => (i.id === chip.key ? { ...i, day: last } : i))
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('ap-moving');
      if (active) gestureEnd.current = Date.now();
      setMovingId(null);
      setOverIso(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="mc-wrap">
      <div className="mc-grid" style={{ gridTemplateRows: `auto repeat(${rows}, minmax(92px, 1fr))` }}>
        {WEEKDAYS.map((w) => <div key={w} className="mc-weekday font-mono">{w}</div>)}
        {cells.map((c) => {
          const chips = chipsFor(c.iso);
          const extra = chips.length - MAX_CHIPS;
          return (
            <div
              key={c.iso}
              data-iso={c.iso}
              className={`mc-cell${c.inWindow ? '' : ' out'}${c.first ? ' first' : ''}${c.iso === todayIso ? ' today' : ''}${overIso === c.iso ? ' over' : ''}`}
              onClick={() => { if (Date.now() - gestureEnd.current > 400) onOpenDay(c.iso); }}
              title={fromIso(c.iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <span className="mc-num font-mono">{c.label}</span>
              <div className="mc-chips">
                {chips.slice(0, MAX_CHIPS).map((chip) => (
                  <div
                    key={chip.key}
                    className={`mc-chip${chip.done ? ' done' : ''}${chip.item ? '' : ' plain'}${movingId === chip.key ? ' moving' : ''}`}
                    style={chip.color ? { '--c': chip.color } : undefined}
                    title={`${chip.area}${chip.at !== null ? ` · ${fmtMin(chip.at)}` : ''}${chip.note ? ` · ${chip.note}` : ''}`}
                    onPointerDown={(e) => startMove(e, chip)}
                  >
                    {chip.at !== null && <span className="mc-time font-mono">{fmtMin(chip.at)}</span>}
                    <span className="mc-text">{chip.text || '…'}</span>
                  </div>
                ))}
                {extra > 0 && <div className="mc-more font-mono">+{extra}<span className="mc-more-label"> más</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
