import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  ArrowUp,
  Trash2,
  ChevronUp
} from 'lucide-react';

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

export function WeeklyPlanner({
  boardNotes,
  plannerTasks,
  onUpdatePlannerTasks,
  onUpdateBoardNotes,
  onTransitionToBoard,
  weekOffset: propWeekOffset,
  onWeekOffsetChange
}) {
  const [localWeekOffset, setLocalWeekOffset] = useState(0);
  const weekOffset = propWeekOffset !== undefined ? propWeekOffset : localWeekOffset;
  const setWeekOffset = onWeekOffsetChange || setLocalWeekOffset;
  const [dayPairIndex, setDayPairIndex] = useState(0);
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
        isoDate: d.toISOString().slice(0, 10),
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

  // Tasks for a day (planner tasks + board notes with eventDate)
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

    return [...pTasks, ...bTasks];
  };

  const updateTask = useCallback((id, updates) => {
    if (typeof id === 'string' && id.startsWith('board_')) {
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
  }, [onUpdatePlannerTasks, onUpdateBoardNotes, boardNotes]);

  const deleteTask = (id) => {
    if (typeof id === 'string' && id.startsWith('board_')) {
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
      <div style={{ padding: '14px 24px', borderBottom: 'var(--border-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(247,244,238,0.97)', backdropFilter: 'blur(8px)', zIndex: 10, flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="brand-title" style={{ fontSize: '1.4rem' }}>Planificador Semanal</span>

          {/* Week Switcher Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn-icon" onClick={() => setWeekOffset(p => p - 1)} title="Semana anterior">
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono" style={{ fontSize: '0.85rem', minWidth: '150px', textAlign: 'center' }}>
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
        </div>

        {/* Subtle Transparent Spatial Navigation Trigger — Centered on X-axis */}
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
      </div>

      {/* Mobile 2-Day View Pair Selector Header */}
      {isMobile && (
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

      {/* Planner Grid */}
      <div className="planner-grid-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="planner-grid-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: '100%' }}>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? `48px repeat(${visibleDays.length}, 1fr)` : '48px repeat(7, 1fr)', borderBottom: 'var(--border-hairline)', flexShrink: 0 }}>
            <div />
            {visibleDays.map(day => (
              <div key={day.key} style={{ padding: '6px 8px', borderLeft: 'var(--border-hairline)', background: day.isToday ? 'var(--bg-active)' : 'rgba(24,24,27,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span className="font-title" style={{ fontSize: '1.05rem', fontStyle: 'italic', fontWeight: day.isToday ? 600 : 400 }}>{day.label}</span>
                  <span className="font-mono" style={{ fontSize: '0.65rem', color: day.isToday ? 'var(--text-ink)' : 'var(--text-muted)' }}>{day.formattedDate}</span>
                </div>
                <button
                  className="btn-icon active"
                  style={{ padding: '2px 6px', fontSize: '0.62rem', borderRadius: '10px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addTimeTask(day, 120);
                  }}
                  title="Añadir Evento"
                >
                  + Evento
                </button>
              </div>
            ))}
          </div>

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
                    if (e.target === colRefs.current[day.key] || e.target.classList?.contains('hour-guide-line')) {
                      const colEl = colRefs.current[day.key];
                      if (!colEl) return;
                      const rect = colEl.getBoundingClientRect();
                      addTimeTask(day, e.clientY - rect.top);
                    }
                  }}
                  onDoubleClick={(e) => {
                    const colEl = colRefs.current[day.key];
                    if (!colEl) return;
                    const rect = colEl.getBoundingClientRect();
                    addTimeTask(day, e.clientY - rect.top);
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
                    return (
                      <div
                        key={task.id}
                        onMouseDown={(e) => startDragMove(e, task, day.key)}
                        onTouchStart={(e) => startDragMove(e, task, day.key)}
                        style={{
                          position: 'absolute',
                          top: `${yPct}%`,
                          left: '2px',
                          right: '2px',
                          height: `${heightPct}%`,
                          minHeight: '20px',
                          background: task.isEvent ? 'var(--text-ink)' : (task.completed ? 'rgba(24,24,27,0.04)' : 'var(--bg-note)'),
                          color: task.isEvent ? '#F7F4EE' : (task.completed ? 'var(--text-muted)' : 'var(--text-ink)'),
                          border: task.isEvent ? '1px solid rgba(24,24,27,0.9)' : 'var(--border-hairline)',
                          borderLeft: task.isEvent ? '3px solid #F7F4EE' : `2px solid rgba(24,24,27,${task.completed ? 0.15 : 0.4})`,
                          borderRadius: '2px',
                          boxShadow: 'var(--shadow-subtle)',
                          padding: '3px 5px',
                          overflow: 'hidden',
                          cursor: 'grab',
                          zIndex: task.isEvent ? 5 : 4,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          userSelect: 'none'
                        }}
                      >
                        {/* Top row: time + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2px', flexShrink: 0 }}>
                          <span className="font-mono" style={{ fontSize: '0.58rem', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {task.timeSlot} — {endStr}
                          </span>
                          <div style={{ display: 'flex', gap: '1px' }}>
                            <button
                              className={`block-checkmark ${task.completed ? 'checked' : ''}`}
                              style={{ width: '12px', height: '12px', flexShrink: 0 }}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); updateTask(task.id, { completed: !task.completed }); }}
                            >
                              {task.completed && <Check size={8} strokeWidth={3} />}
                            </button>
                            <button
                              style={{ background: 'none', border: 'none', color: task.isEvent ? 'rgba(247,244,238,0.7)' : 'var(--text-subtle)', cursor: 'pointer', fontSize: '0.7rem', lineHeight: 1, padding: '0 1px' }}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>

                        {/* Event title */}
                        <input
                          type="text"
                          className="block-text-input"
                          style={{ fontSize: '0.78rem', flex: 1, cursor: 'text', textDecoration: task.completed ? 'line-through' : 'none', color: task.isEvent ? '#F7F4EE' : (task.completed ? 'var(--text-muted)' : 'var(--text-ink)') }}
                          value={task.text}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => updateTask(task.id, { text: e.target.value })}
                          placeholder="Evento..."
                        />

                        {/* Bottom resize handle */}
                        <div
                          onMouseDown={(e) => startDragResize(e, task, day.key)}
                          onTouchStart={(e) => startDragResize(e, task, day.key)}
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '12px',
                            cursor: 'ns-resize',
                            background: 'transparent',
                            borderBottom: '3px solid rgba(24,24,27,0.25)',
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
  </div>
);
}
