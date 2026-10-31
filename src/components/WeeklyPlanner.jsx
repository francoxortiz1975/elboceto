import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  ArrowUp,
  Trash2,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { MonthCalendar } from './MonthCalendar';
import { PlanTabs } from './PlanTabs';
import { AREA_COLORS, BANDS, durOf, fromIso, isoOf, uid as areaUid } from '../lib/areaPlan';
import './AreaPlanner.css';
import './CalendarFit.css';

const DAYS_ES = [
  { key: 'mon', label: 'Lunes',     short: 'Lun' },
  { key: 'tue', label: 'Martes',    short: 'Mar' },
  { key: 'wed', label: 'Miércoles', short: 'Mié' },
  { key: 'thu', label: 'Jueves',    short: 'Jue' },
  { key: 'fri', label: 'Viernes',   short: 'Vie' },
  { key: 'sat', label: 'Sábado',    short: 'Sáb' },
  { key: 'sun', label: 'Domingo',   short: 'Dom' }
];

// Timeline: 07:00 to 24:00 = 17 hours = 1020 minutes
const DAY_START_MIN  = 7 * 60;   // 420
const DAY_END_MIN    = 24 * 60;  // 1440
const DAY_TOTAL_MIN  = DAY_END_MIN - DAY_START_MIN; // 1020
const SNAP_MIN       = 15;
const HOUR_GUIDES    = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const KEY_HOURS      = [7, 9, 12, 15, 18, 21, 24];

function minutesToY(minutes, colHeight) {
  return ((minutes - DAY_START_MIN) / DAY_TOTAL_MIN) * colHeight;
}

function yToMinutes(y, colHeight) {
  return Math.round(((y / colHeight) * DAY_TOTAL_MIN + DAY_START_MIN) / SNAP_MIN) * SNAP_MIN;
}

function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60) % 25;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStrToMinutes(timeStr) {
  if (!timeStr || timeStr === 'all_day') return DAY_START_MIN;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function autoSize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export function WeeklyPlanner({
  boardNotes,
  plannerTasks,
  onUpdatePlannerTasks,
  onUpdateBoardNotes,
  onOpenCalendarModal,
  onTransitionToBoard,
  weekOffset: propWeekOffset,
  onWeekOffsetChange,
  areaPlan,
  onChangeAreaPlan,
  mode: propMode,
  onModeChange
}) {
  const [localWeekOffset, setLocalWeekOffset] = useState(0);
  const weekOffset = propWeekOffset !== undefined ? propWeekOffset : localWeekOffset;
  const setWeekOffset = onWeekOffsetChange || setLocalWeekOffset;
  const [dayPairIndex, setDayPairIndex] = useState(0);
  const [localMode, setLocalMode] = useState('week');
  const mode = propMode || localMode; // 'week' | 'month'
  const setMode = onModeChange || setLocalMode;
  const [monthOffset, setMonthOffset] = useState(0);
  const [createIn, setCreateIn] = useState('planner'); // where new blocks go: 'planner' or an area id
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const colRefs     = useRef({});
  const dragState   = useRef(null);
  const weekDaysRef = useRef([]);

  const getWeekDates = () => {
    const now = new Date();
    const distanceToMon = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon + weekOffset * 7);
    return DAYS_ES.map((day, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isToday = d.toDateString() === new Date().toDateString();
      return {
        ...day,
        dayIdx: idx,
        dateObj: d,
        formattedDate: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        isoDate: isoOf(d), // local date; toISOString() shifts the day by the UTC offset
        isToday
      };
    });
  };

  const weekDays = getWeekDates();
  weekDaysRef.current = weekDays; // keep ref in sync every render

  const visibleDays = isMobile
    ? (dayPairIndex === 3 ? [weekDays[6]] : [weekDays[dayPairIndex * 2], weekDays[dayPairIndex * 2 + 1]])
    : weekDays;

  const currentWeekLabel = `${weekDays[0].formattedDate} — ${weekDays[6].formattedDate}`;

  // ── Plan por áreas layer ──────────────────────────────────────────────────
  const plan = areaPlan || { areas: [], items: [], hidden: [] };
  const areaById = Object.fromEntries(plan.areas.map(a => [a.id, a]));
  const colorOf = (a) => AREA_COLORS[a.c % AREA_COLORS.length];
  const areaItemsOn = (iso) => plan.items.filter(it => it.day === iso && areaById[it.area] && !plan.hidden.includes(it.area));
  const timedAreaTasks = (dayObj) => areaItemsOn(dayObj.isoDate)
    .filter(it => typeof it.at === 'number')
    .map(it => ({
      id: `area_${it.id}`,
      text: it.text,
      completed: !!it.done,
      isArea: true,
      areaName: areaById[it.area].name,
      areaColor: colorOf(areaById[it.area]),
      timeSlot: minutesToTimeStr(it.at),
      durationMin: durOf(it),
      dayIso: dayObj.isoDate,
      dayKey: dayObj.key
    }));
  const untimedAreaItems = (dayObj) => areaItemsOn(dayObj.isoDate).filter(it => typeof it.at !== 'number');
  const changeArea = (fn) => { if (onChangeAreaPlan) onChangeAreaPlan(fn); };

  // Tasks for a day (planner tasks + board notes with eventDate + area plan blocks)
  const getTasksForDay = (dayObj) => {
    const pTasks = plannerTasks.filter(t => {
      const matchesDay = t.dayIso ? t.dayIso === dayObj.isoDate : t.dayKey === dayObj.key;
      return matchesDay && t.timeSlot && t.timeSlot !== 'all_day';
    });

    const bTasks = (boardNotes || [])
      .filter(n => n.eventDate === dayObj.isoDate)
      .map(n => ({
        id: `board_${n.id}`,
        noteId: n.id,
        text: n.blocks?.[0]?.text || 'Evento',
        completed: false,
        isFromBoard: true,
        isEvent: !!n.isEvent,
        timeSlot: n.eventTime || '09:00',
        durationMin: n.eventDurationMin || 60,
        dayIso: dayObj.isoDate,
        dayKey: dayObj.key
      }));

    return [...pTasks, ...bTasks, ...timedAreaTasks(dayObj)];
  };

  const updateTask = useCallback((id, updates) => {
    if (typeof id === 'string' && id.startsWith('area_')) {
      const itemId = id.slice(5);
      const patch = {};
      if (updates.text !== undefined) patch.text = updates.text;
      if (updates.completed !== undefined) patch.done = updates.completed;
      if (updates.timeSlot !== undefined) patch.at = timeStrToMinutes(updates.timeSlot);
      if (updates.durationMin !== undefined) patch.dur = updates.durationMin;
      if (updates.dayIso !== undefined) patch.day = updates.dayIso;
      if (onChangeAreaPlan) {
        onChangeAreaPlan(p => ({ ...p, items: p.items.map(i => (i.id === itemId ? { ...i, ...patch } : i)) }));
      }
    } else if (typeof id === 'string' && id.startsWith('board_')) {
      const noteId = id.replace('board_', '');
      const current = (boardNotes || []).find(n => n.id === noteId);
      if (current && onUpdateBoardNotes) {
        const updated = {
          ...current,
          ...(updates.timeSlot !== undefined ? { eventTime: updates.timeSlot } : {}),
          ...(updates.durationMin !== undefined ? { eventDurationMin: updates.durationMin } : {}),
          ...(updates.dayIso !== undefined ? { eventDate: updates.dayIso } : {}),
          ...(updates.text !== undefined && current.blocks?.[0] ? {
            blocks: [{ ...current.blocks[0], text: updates.text }, ...current.blocks.slice(1)]
          } : {})
        };
        onUpdateBoardNotes(updated);
      }
    } else {
      onUpdatePlannerTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }, [onUpdatePlannerTasks, onUpdateBoardNotes, onChangeAreaPlan, boardNotes]);

  const deleteTask = (id) => {
    if (typeof id === 'string' && id.startsWith('area_')) {
      const itemId = id.slice(5);
      changeArea(p => ({ ...p, items: p.items.filter(i => i.id !== itemId) }));
    } else if (typeof id === 'string' && id.startsWith('board_')) {
      const noteId = id.replace('board_', '');
      const current = (boardNotes || []).find(n => n.id === noteId);
      if (current && onUpdateBoardNotes) {
        onUpdateBoardNotes({ ...current, eventDate: null, eventTime: null });
      }
    } else {
      onUpdatePlannerTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  const addTimeTask = (dayObj, clickY) => {
    const colEl = colRefs.current[dayObj.key];
    if (!colEl) return;
    const colHeight = colEl.getBoundingClientRect().height;
    const startMin = yToMinutes(clickY, colHeight);
    const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - 30, startMin));
    if (createIn !== 'planner' && areaById[createIn]) {
      changeArea(p => ({
        ...p,
        items: [...p.items, { id: areaUid(), area: createIn, text: '', done: false, day: dayObj.isoDate, at: clamped, dur: 60 }]
      }));
      return;
    }
    const newTask = {
      id: 'task_' + Date.now(),
      text: '',
      completed: false,
      dayIso: dayObj.isoDate,
      dayKey: dayObj.key,
      timeSlot: minutesToTimeStr(clamped),
      durationMin: 60
    };
    onUpdatePlannerTasks(prev => [...prev, newTask]);
  };

  // ── Pointer-based drag (move and resize) ──────────────────────────────────
  // Use refs for handlers so removeEventListener always gets the same function instance
  const handleDragMoveRef = useRef(null);
  const stopDragRef       = useRef(null);

  const startDragMove = (e, task, dayKey) => {
    if (e.target.closest('input') || e.target.closest('button')) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const colEl = colRefs.current[dayKey];
    if (!colEl) return;
    const colHeight = colEl.getBoundingClientRect().height;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = {
      type: 'move',
      taskId: task.id,
      startY: clientY,
      origStartMin: timeStrToMinutes(task.timeSlot),
      origDurationMin: task.durationMin || 60,
      dayKey,
      colHeight
    };
    window.addEventListener('mousemove', handleDragMoveRef.current);
    window.addEventListener('mouseup',   stopDragRef.current);
    window.addEventListener('touchmove', handleDragMoveRef.current, { passive: false });
    window.addEventListener('touchend',  stopDragRef.current);
  };

  const startDragResize = (e, task, dayKey) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const colEl = colRefs.current[dayKey];
    if (!colEl) return;
    const colHeight = colEl.getBoundingClientRect().height;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = {
      type: 'resize',
      taskId: task.id,
      startY: clientY,
      origStartMin: timeStrToMinutes(task.timeSlot),
      origDurationMin: task.durationMin || 60,
      dayKey,
      colHeight
    };
    window.addEventListener('mousemove', handleDragMoveRef.current);
    window.addEventListener('mouseup',   stopDragRef.current);
    window.addEventListener('touchmove', handleDragMoveRef.current, { passive: false });
    window.addEventListener('touchend',  stopDragRef.current);
  };

  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;

  // Assign stable handler refs — reassigned each render so they close over latest state
  handleDragMoveRef.current = (e) => {
    const ds = dragState.current;
    if (!ds) return;
    if (e.cancelable) e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const deltaY   = clientY - ds.startY;
    const deltaMin = Math.round((deltaY / ds.colHeight) * DAY_TOTAL_MIN / SNAP_MIN) * SNAP_MIN;

    if (ds.type === 'move') {
      let newStartMin = ds.origStartMin + deltaMin;
      newStartMin = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - (ds.origDurationMin || 60), newStartMin));
      // Cross-day: find which column the cursor X is currently over
      const targetDay = weekDaysRef.current.find(d => {
        const el = colRefs.current[d.key];
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right;
      });
      updateTaskRef.current(ds.taskId, {
        timeSlot: minutesToTimeStr(newStartMin),
        ...(targetDay ? { dayKey: targetDay.key, dayIso: targetDay.isoDate } : {})
      });
    } else if (ds.type === 'resize') {
      let newDuration = ds.origDurationMin + deltaMin;
      newDuration = Math.max(15, Math.min(DAY_TOTAL_MIN, newDuration));
      updateTaskRef.current(ds.taskId, { durationMin: newDuration });
    }
  };

  stopDragRef.current = () => {
    dragState.current = null;
    window.removeEventListener('mousemove', handleDragMoveRef.current);
    window.removeEventListener('mouseup',   stopDragRef.current);
    window.removeEventListener('touchmove', handleDragMoveRef.current);
    window.removeEventListener('touchend',  stopDragRef.current);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleDragMoveRef.current);
      window.removeEventListener('mouseup',   stopDragRef.current);
      window.removeEventListener('touchmove', handleDragMoveRef.current);
      window.removeEventListener('touchend',  stopDragRef.current);
    };
  }, []);

  // ── Drop from LeftPanel (board blocks) ────────────────────────────────────
  const handleColDrop = (e, day) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('panelTaskId');
    const boardBlockRaw = e.dataTransfer.getData('boardBlockData');

    const colEl = colRefs.current[day.key];
    if (!colEl) return;
    const rect = colEl.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const colHeight = rect.height;
    const startMin = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - 60, yToMinutes(clickY, colHeight)));

    if (taskId) {
      updateTask(taskId, {
        dayIso: day.isoDate,
        dayKey: day.key,
        timeSlot: minutesToTimeStr(startMin)
      });
    } else if (boardBlockRaw) {
      try {
        const { text, noteId } = JSON.parse(boardBlockRaw);
        if (text) {
          onUpdatePlannerTasks(prev => [...prev, {
            id: 'task_' + Date.now(),
            text,
            completed: false,
            dayIso: day.isoDate,
            dayKey: day.key,
            timeSlot: minutesToTimeStr(startMin),
            durationMin: 60,
            noteId
          }]);
          if (noteId && onUpdateBoardNotes) {
            const current = (boardNotes || []).find(n => n.id === noteId);
            if (current) {
              onUpdateBoardNotes({
                ...current,
                eventDate: day.isoDate,
                eventTime: minutesToTimeStr(startMin)
              });
            }
          }
        }
      } catch (_) {}
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--bg-book)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div className="wk-head" style={{ borderBottom: 'var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(247,244,238,0.97)', backdropFilter: 'blur(8px)', zIndex: 10, flexShrink: 0, position: 'relative' }}>
        <div className="wk-head-left" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="brand-title wk-title">{mode === 'week' ? 'Plan semanal' : 'Plan mensual'}</span>

          {/* Month Switcher Controls */}
          {mode === 'month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="btn-icon" onClick={() => setMonthOffset(p => p - 1)} title="Mes anterior">
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono wk-range" style={{ fontSize: '0.85rem', textAlign: 'center', textTransform: 'capitalize' }}>
                {new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </span>
              <button className="btn-icon" onClick={() => setMonthOffset(p => p + 1)} title="Mes siguiente">
                <ChevronRight size={14} />
              </button>
              {monthOffset !== 0 && (
                <button className="btn-icon active" onClick={() => setMonthOffset(0)} style={{ fontSize: '0.7rem' }}>
                  Hoy
                </button>
              )}
            </div>
          )}

          {/* Week Switcher Controls */}
          {mode === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn-icon" onClick={() => setWeekOffset(p => p - 1)} title="Semana anterior">
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono wk-range" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
              {currentWeekLabel}
            </span>
            <button className="btn-icon" onClick={() => setWeekOffset(p => p + 1)} title="Semana siguiente">
              <ChevronRight size={14} />
            </button>
            {weekOffset !== 0 && (
              <button className="btn-icon active" onClick={() => setWeekOffset(0)} style={{ fontSize: '0.7rem' }}>
                Hoy
              </button>
            )}
          </div>
          )}
        </div>

        {/* Subtle Transparent Spatial Navigation Trigger — Centered on X-axis */}
        {!isMobile && (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
            <button
              className="subtle-spatial-nav"
              onClick={onTransitionToBoard}
              title="Ir al Lienzo Principal"
            >
              <ChevronUp size={14} />
              <span className="nav-label font-mono">Lienzo</span>
            </button>
          </div>
        )}
      </div>

      {/* View switch + area filters */}
      <div className="wk-toolbar">
        <PlanTabs value={mode} onChange={setMode} />
        {plan.areas.length > 0 && (
          <div className="wk-areas">
            <span className="ap-flabel">Áreas</span>
            {plan.areas.map(a => (
              <button
                key={a.id}
                className="ap-chip"
                style={{ '--c': colorOf(a) }}
                aria-pressed={!plan.hidden.includes(a.id)}
                title="Mostrar u ocultar esta área"
                onClick={() => changeArea(p => ({
                  ...p,
                  hidden: p.hidden.includes(a.id) ? p.hidden.filter(x => x !== a.id) : [...p.hidden, a.id]
                }))}
              >
                <i />{a.name}
              </button>
            ))}
            <button
              className="ap-chip all"
              aria-pressed={plan.hidden.length === 0}
              onClick={() => changeArea(p => ({ ...p, hidden: [] }))}
            >Todas</button>
          </div>
        )}
        {mode === 'week' && plan.areas.length > 0 && (
          <label className="ap-flabel wk-create">
            Nuevo bloque en
            <select
              id="planner-create-in"
              className="ap-btn"
              value={createIn}
              onChange={(e) => setCreateIn(e.target.value)}
            >
              <option value="planner">Planificador</option>
              {plan.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* Mobile 2-Day View Pair Selector Header */}
      {isMobile && mode === 'week' && (
        <div className="mobile-2day-header">
          <div className="mobile-pair-pills">
            <button
              className={`mobile-pair-pill ${dayPairIndex === 0 ? 'active' : ''}`}
              onClick={() => setDayPairIndex(0)}
            >
              Lun - Mar
            </button>
            <button
              className={`mobile-pair-pill ${dayPairIndex === 1 ? 'active' : ''}`}
              onClick={() => setDayPairIndex(1)}
            >
              Mié - Jue
            </button>
            <button
              className={`mobile-pair-pill ${dayPairIndex === 2 ? 'active' : ''}`}
              onClick={() => setDayPairIndex(2)}
            >
              Vie - Sáb
            </button>
            <button
              className={`mobile-pair-pill ${dayPairIndex === 3 ? 'active' : ''}`}
              onClick={() => setDayPairIndex(3)}
            >
              Dom
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn-icon"
              disabled={dayPairIndex === 0}
              style={{ opacity: dayPairIndex === 0 ? 0.4 : 1 }}
              onClick={() => setDayPairIndex(p => Math.max(0, p - 1))}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              className="btn-icon"
              disabled={dayPairIndex === 3}
              style={{ opacity: dayPairIndex === 3 ? 0.4 : 1 }}
              onClick={() => setDayPairIndex(p => Math.min(3, p + 1))}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {mode === 'month' && (
        <MonthCalendar
          areaPlan={plan}
          plannerTasks={plannerTasks}
          monthOffset={monthOffset}
          onChangeAreaPlan={changeArea}
          onOpenDay={(iso) => {
            const mondayOf = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
            setWeekOffset(Math.round((mondayOf(fromIso(iso)) - mondayOf(new Date())) / (7 * 864e5)));
            setDayPairIndex(Math.floor(((fromIso(iso).getDay() + 6) % 7) / 2));
            setMode('week');
          }}
        />
      )}

      {mode === 'week' && (
            <div className="planner-grid-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="planner-grid-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: '100%' }}>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? `48px repeat(${visibleDays.length}, 1fr)` : '48px repeat(7, 1fr)', borderBottom: 'var(--border-hairline)', flexShrink: 0 }}>
            <div />
            {visibleDays.map(day => (
              <div key={day.key} className="wk-dayhead" style={{ borderLeft: 'var(--border-hairline)', background: day.isToday ? 'var(--bg-active)' : 'rgba(24,24,27,0.02)' }}>
                <div className="wk-daytitle">
                  <span className="font-title" style={{ fontSize: '1.05rem', fontStyle: 'italic', fontWeight: day.isToday ? 600 : 400 }}>{day.label}</span>
                  <span className="font-mono" style={{ fontSize: '0.65rem', color: day.isToday ? 'var(--text-ink)' : 'var(--text-muted)' }}>{day.formattedDate}</span>
                </div>
                <button
                  className="btn-icon active wk-add"
                  onClick={(e) => {
                    e.stopPropagation();
                    addTimeTask(day, 120);
                  }}
                  title="Añadir Evento"
                  aria-label="Añadir Evento"
                >
                  +<span className="wk-add-label"> Evento</span>
                </button>
              </div>
            ))}
          </div>

          {/* Area items without a time of day */}
          {(() => {
            const anyUntimed = visibleDays.some(d => untimedAreaItems(d).length > 0);
            if (!anyUntimed && createIn === 'planner') return null;
            const bandLabel = (at) => (BANDS.find(b => b.id === at) || {}).label;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? `48px repeat(${visibleDays.length}, 1fr)` : '48px repeat(7, 1fr)', borderBottom: 'var(--border-hairline)', flexShrink: 0, maxHeight: '150px', overflowY: 'auto' }}>
                <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-subtle)', padding: '5px 6px 0 0', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em' }}>sin hora</div>
                {visibleDays.map(day => (
                  <div key={day.key} style={{ borderLeft: 'var(--border-hairline)', padding: '3px 4px', display: 'grid', gap: '2px', alignContent: 'start', minWidth: 0 }}>
                    {untimedAreaItems(day).map(it => {
                      const a = areaById[it.area];
                      return (
                        <div
                          key={it.id}
                          className={`ap-item wk-untimed${it.done ? ' done' : ''}`}
                          style={{ '--c': colorOf(a), borderLeft: `3px solid ${colorOf(a)}`, background: `color-mix(in srgb, ${colorOf(a)} 12%, var(--bg-note))` }}
                          title={`${a.name}${bandLabel(it.at) ? ' · ' + bandLabel(it.at) : ''}`}
                        >
                          <button className="ap-chk" aria-label={it.done ? 'Marcar pendiente' : 'Marcar hecho'} onClick={() => updateTask(`area_${it.id}`, { completed: !it.done })} />
                          <textarea
                            className="ap-txt wk-untxt"
                            rows={1}
                            ref={autoSize}
                            value={it.text}
                            placeholder="Escribe…"
                            onChange={e => updateTask(`area_${it.id}`, { text: e.target.value })}
                          />
                          <button className="ap-del" aria-label="Borrar tarea" onClick={() => deleteTask(`area_${it.id}`)}>×</button>
                        </div>
                      );
                    })}
                    {createIn !== 'planner' && areaById[createIn] && (
                      <button
                        className="ap-btn"
                        style={{ fontSize: '0.62rem', padding: '1px 6px', justifySelf: 'start' }}
                        onClick={() => changeArea(p => ({
                          ...p,
                          items: [...p.items, { id: areaUid(), area: createIn, text: '', done: false, day: day.isoDate, at: 'any' }]
                        }))}
                        title={`Añadir tarea sin hora en ${areaById[createIn].name}`}
                      >+</button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Scrollable time grid */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? `48px repeat(${visibleDays.length}, 1fr)` : '48px repeat(7, 1fr)', height: '700px', position: 'relative' }}>

            {/* Time gutter */}
            <div style={{ borderRight: 'var(--border-hairline)', position: 'relative', background: 'rgba(247,244,238,0.6)' }}>
              {KEY_HOURS.map(h => {
                const yPct = ((h * 60 - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
                if (yPct < 0 || yPct > 100) return null;
                return (
                  <div key={h} style={{ position: 'absolute', top: `${yPct}%`, right: 0, transform: 'translateY(-50%)', paddingRight: '6px' }}>
                    <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {String(h % 24).padStart(2, '0')}:00
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {visibleDays.map((day) => {
              const tasks = getTasksForDay(day);
              return (
                <div
                  key={day.key}
                  ref={el => colRefs.current[day.key] = el}
                  style={{ position: 'relative', borderLeft: 'var(--border-hairline)', background: day.isToday ? 'rgba(24,24,27,0.018)' : 'var(--bg-book)', cursor: 'crosshair' }}
                  onClick={(e) => {
                    if (isMobile && !e.target.closest('.planner-task-card')) {
                      const colEl = colRefs.current[day.key];
                      if (!colEl) return;
                      const rect = colEl.getBoundingClientRect();
                      addTimeTask(day, e.clientY - rect.top);
                    }
                  }}
                  onDoubleClick={(e) => {
                    if (!isMobile && !e.target.closest('.planner-task-card')) {
                      const colEl = colRefs.current[day.key];
                      if (!colEl) return;
                      const rect = colEl.getBoundingClientRect();
                      addTimeTask(day, e.clientY - rect.top);
                    }
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleColDrop(e, day)}
                >
                  {/* Horizontal hour guide lines */}
                  {HOUR_GUIDES.map(h => {
                    const yPct = ((h * 60 - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
                    if (yPct < 0 || yPct > 100) return null;
                    const isKey = KEY_HOURS.includes(h);
                    return (
                      <div
                        key={h}
                        className="hour-guide-line"
                        style={{
                          position: 'absolute',
                          top: `${yPct}%`,
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: isKey ? 'rgba(24,24,27,0.12)' : 'rgba(24,24,27,0.05)',
                          pointerEvents: 'none'
                        }}
                      />
                    );
                  })}

                  {/* Current time line (today only) */}
                  {day.isToday && (() => {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin < DAY_START_MIN || nowMin > DAY_END_MIN) return null;
                    const yPct = ((nowMin - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
                    return <div style={{ position: 'absolute', top: `${yPct}%`, left: 0, right: 0, height: '2px', background: 'var(--text-ink)', opacity: 0.35, pointerEvents: 'none', zIndex: 5 }} />;
                  })()}

                  {/* Events */}
                  {tasks.map(task => {
                    const startMin   = timeStrToMinutes(task.timeSlot);
                    const durationMin = task.durationMin || 60;
                    const yPct       = ((startMin - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
                    const heightPct  = (durationMin / DAY_TOTAL_MIN) * 100;
                    const endStr     = minutesToTimeStr(startMin + durationMin);
                    const cardBg     = task.isArea ? `color-mix(in srgb, ${task.areaColor} ${task.completed ? 7 : 16}%, var(--bg-note))` : task.isEvent ? 'var(--text-ink)' : (task.completed ? 'rgba(24,24,27,0.04)' : 'var(--bg-note)');

                    const handleOpenModalForTask = (e) => {
                      if (e) e.stopPropagation();
                      if (onOpenCalendarModal) {
                        const targetNote = (boardNotes || []).find(n => n.id === task.noteId || `board_${n.id}` === task.id) || {
                          id: task.id,
                          title: task.text || 'Evento',
                          eventDate: task.dayIso,
                          eventTime: task.timeSlot,
                          eventDurationMin: task.durationMin || 60,
                          isEvent: task.isEvent,
                          blocks: [{ id: 'b_1', text: task.text || 'Evento' }]
                        };
                        onOpenCalendarModal(targetNote);
                      }
                    };

                    return (
                      <div
                        key={task.id}
                        className="planner-task-card"
                        title={`${task.timeSlot} — ${endStr}${task.isArea ? ` · ${task.areaName}` : ''}`}
                        onMouseDown={(e) => startDragMove(e, task, day.key)}
                        onTouchStart={(e) => startDragMove(e, task, day.key)}
                        onDoubleClick={handleOpenModalForTask}
                        style={{
                          position: 'absolute',
                          top: `${yPct}%`,
                          left: '2px',
                          right: '2px',
                          height: `${heightPct}%`,
                          minHeight: '26px',
                          background: cardBg,
                          '--wk-bg': task.completed && !task.isArea ? 'var(--bg-note)' : cardBg,
                          color: task.isEvent ? '#F7F4EE' : (task.completed ? 'var(--text-muted)' : 'var(--text-ink)'),
                          border: task.isEvent ? '1px solid rgba(24,24,27,0.9)' : 'var(--border-hairline)',
                          borderLeft: task.isArea ? `3px solid ${task.areaColor}` : task.isEvent ? '3px solid #F7F4EE' : `2px solid rgba(24,24,27,${task.completed ? 0.15 : 0.4})`,
                          borderRadius: '4px',
                          boxShadow: 'var(--shadow-subtle)',
                          padding: '3px 6px 6px 6px',
                          overflow: 'hidden',
                          cursor: 'grab',
                          zIndex: task.isEvent ? 5 : 4,
                          display: 'flex',
                          flexDirection: 'column',
                          justify: 'center',
                          gap: '2px',
                          userSelect: 'none'
                        }}
                      >
                        {durationMin <= 60 ? (
                          /* Compact 1-row layout for <=60m tasks */
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', flex: 1 }}>
                            <span className="font-mono wk-time" style={{ fontSize: '0.62rem', opacity: 0.75, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {task.timeSlot}
                            </span>
                            <input
                              type="text"
                              className="block-text-input"
                              style={{
                                fontSize: '0.78rem',
                                flex: 1,
                                minWidth: 0,
                                cursor: 'text',
                                textDecoration: task.completed ? 'line-through' : 'none',
                                color: task.isEvent ? '#F7F4EE' : (task.completed ? 'var(--text-muted)' : 'var(--text-ink)'),
                                padding: 0,
                                margin: 0,
                                lineHeight: 1.2
                              }}
                              value={task.text}
                              onMouseDown={e => e.stopPropagation()}
                              onChange={e => updateTask(task.id, { text: e.target.value })}
                              placeholder="Evento..."
                            />
                            <div className="wk-actions">
                              <button
                                style={{display: task.isArea ? 'none' : undefined,  background: 'none', border: 'none', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 1px' }}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={handleOpenModalForTask}
                                title="Configurar / Sincronizar Calendario"
                              >
                                <Calendar size={10} />
                              </button>
                              <button
                                className={`block-checkmark ${task.completed ? 'checked' : ''}`}
                                style={{ width: '12px', height: '12px' }}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateTask(task.id, { completed: !task.completed }); }}
                              >
                                {task.completed && <Check size={8} strokeWidth={3} />}
                              </button>
                              <button
                                style={{ background: 'none', border: 'none', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 1px' }}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Standard 2-row layout for >60m tasks */
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2px', flexShrink: 0 }}>
                              <span className="font-mono wk-label" style={{ fontSize: '0.6rem', opacity: 0.75 }}>
                                {task.timeSlot} — {endStr}{task.isArea && <span className="wk-area-name">{` · ${task.areaName}`}</span>}
                              </span>
                              <div className="wk-actions">
                                <button
                                  style={{display: task.isArea ? 'none' : undefined,  background: 'none', border: 'none', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 1px' }}
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={handleOpenModalForTask}
                                  title="Configurar / Sincronizar Calendario"
                                >
                                  <Calendar size={10} />
                                </button>
                                <button
                                  className={`block-checkmark ${task.completed ? 'checked' : ''}`}
                                  style={{ width: '12px', height: '12px' }}
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); updateTask(task.id, { completed: !task.completed }); }}
                                >
                                  {task.completed && <Check size={8} strokeWidth={3} />}
                                </button>
                                <button
                                  style={{ background: 'none', border: 'none', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 1px' }}
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>

                            <textarea
                              className="wk-title-input"
                              rows={1}
                              style={{
                                textDecoration: task.completed ? 'line-through' : 'none',
                                color: task.isEvent ? '#F7F4EE' : (task.completed ? 'var(--text-muted)' : 'var(--text-ink)')
                              }}
                              value={task.text}
                              onMouseDown={e => e.stopPropagation()}
                              onChange={e => updateTask(task.id, { text: e.target.value })}
                              placeholder="Evento..."
                            />
                          </>
                        )}

                        {/* Bottom resize handle */}
                        <div
                          onMouseDown={(e) => startDragResize(e, task, day.key)}
                          onTouchStart={(e) => startDragResize(e, task, day.key)}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '6px',
                            cursor: 'ns-resize',
                            background: 'transparent',
                            borderBottom: '2px solid rgba(24,24,27,0.2)',
                            touchAction: 'none'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
      )}
  </div>
);
}
