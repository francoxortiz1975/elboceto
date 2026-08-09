import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, GripVertical, Check, CheckSquare } from 'lucide-react';

// ── shared time helpers ────────────────────────────────────────────────────────
const DAY_START = 7 * 60;   // 420
const DAY_END   = 24 * 60;  // 1440
const DAY_TOTAL = DAY_END - DAY_START; // 1020
const SNAP      = 15;
const ALL_GUIDES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const PANEL_H   = 680; // internal px height for the timeline column

function toStr(min) {
  const h = Math.floor(min / 60) % 25;
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function toMin(s) {
  if (!s || s === 'all_day') return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}
function yPct(min) {
  return ((min - DAY_START) / DAY_TOTAL) * 100;
}
function hPct(dur) {
  return (dur / DAY_TOTAL) * 100;
}
function yToMin(y) {
  const raw = (y / PANEL_H) * DAY_TOTAL + DAY_START;
  return Math.round(raw / SNAP) * SNAP;
}

// ── Board view: mini day timeline ─────────────────────────────────────────────
function TodayPanel({ plannerTasks, boardNotes, onUpdatePlannerTasks, onUpdateBoardNotes }) {
  const today     = new Date();
  const todayIso  = today.toISOString().slice(0, 10);
  const todayKey  = ['sun','mon','tue','wed','thu','fri','sat'][today.getDay()];
  const nowMin    = today.getHours() * 60 + today.getMinutes();
  const colRef    = useRef(null);
  const dragState = useRef(null);

  const todayLabel = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

  // planner tasks for today
  const tasks = plannerTasks.filter(t => {
    const match = t.dayIso === todayIso || t.dayKey === todayKey;
    return match && t.timeSlot && t.timeSlot !== 'all_day';
  });

  // board notes for today (events & scheduled tasks)
  const eventNotes = boardNotes.filter(n => n.eventDate === todayIso);

  const updateTask = useCallback((id, updates) => {
    if (typeof id === 'string' && id.startsWith('board_')) {
      const noteId = id.replace('board_', '');
      const note = (boardNotes || []).find(n => n.id === noteId);
      if (note && onUpdateBoardNotes) {
        onUpdateBoardNotes({
          ...note,
          ...(updates.timeSlot !== undefined ? { eventTime: updates.timeSlot } : {}),
          ...(updates.durationMin !== undefined ? { eventDurationMin: updates.durationMin } : {})
        });
      }
    } else {
      onUpdatePlannerTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }, [onUpdatePlannerTasks, onUpdateBoardNotes, boardNotes]);

  const deleteTask = useCallback((id) => {
    onUpdatePlannerTasks(prev => prev.filter(t => t.id !== id));
  }, [onUpdatePlannerTasks]);

  // ── Stable ref-based drag handlers ──────────────────────────────────────
  const handleDragMoveRef = useRef(null);
  const stopDragRef       = useRef(null);
  const updateTaskRef     = useRef(updateTask);
  updateTaskRef.current   = updateTask;

  const startMove = (e, task) => {
    if (e.target.closest('input') || e.target.closest('button')) return;
    e.stopPropagation();
    e.preventDefault();
    const colH = colRef.current?.getBoundingClientRect().height || PANEL_H;
    dragState.current = {
      type: 'move',
      taskId: task.id,
      startY: e.clientY,
      origMin: toMin(task.timeSlot) ?? DAY_START,
      origDur: task.durationMin || 60,
      colH
    };
    window.addEventListener('mousemove', handleDragMoveRef.current);
    window.addEventListener('mouseup',   stopDragRef.current);
    window.addEventListener('touchmove', handleDragMoveRef.current, { passive: false });
    window.addEventListener('touchend',  stopDragRef.current);
  };

  const startResize = (e, task) => {
    e.stopPropagation();
    e.preventDefault();
    const colH = colRef.current?.getBoundingClientRect().height || PANEL_H;
    dragState.current = {
      type: 'resize',
      taskId: task.id,
      startY: e.clientY,
      origMin: toMin(task.timeSlot) ?? DAY_START,
      origDur: task.durationMin || 60,
      colH
    };
    window.addEventListener('mousemove', handleDragMoveRef.current);
    window.addEventListener('mouseup',   stopDragRef.current);
    window.addEventListener('touchmove', handleDragMoveRef.current, { passive: false });
    window.addEventListener('touchend',  stopDragRef.current);
  };

  handleDragMoveRef.current = (e) => {
    const ds = dragState.current;
    if (!ds) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scale   = PANEL_H / ds.colH;
    const dy      = (clientY - ds.startY) * scale;
    const dMin    = Math.round((dy / PANEL_H) * DAY_TOTAL / SNAP) * SNAP;

    if (ds.type === 'move') {
      const newMin = Math.max(DAY_START, Math.min(DAY_END - ds.origDur, ds.origMin + dMin));
      updateTaskRef.current(ds.taskId, { timeSlot: toStr(newMin) });
    } else if (ds.type === 'resize') {
      const newDur = Math.max(15, Math.min(DAY_TOTAL, ds.origDur + dMin));
      updateTaskRef.current(ds.taskId, { durationMin: newDur });
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

  // double-click empty area → new task
  const addAtClick = e => {
    const el = colRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relY = ((e.clientY - rect.top) / rect.height) * PANEL_H;
    const startMin = Math.max(DAY_START, Math.min(DAY_END - 60, yToMin(relY)));
    onUpdatePlannerTasks(prev => [...prev, {
      id: 'task_' + Date.now(),
      text: '',
      completed: false,
      dayIso: todayIso,
      dayKey: todayKey,
      timeSlot: toStr(startMin),
      durationMin: 60
    }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: 'var(--border-hairline)', flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: '0.56rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>hoy</span>
        <div className="font-title" style={{ fontSize: '1.1rem', fontStyle: 'italic', marginTop: '2px', lineHeight: 1.2 }}>
          {todayLabel}
        </div>
        <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-subtle)', display: 'block', marginTop: '4px' }}>
          doble clic para añadir
        </span>
      </div>

      {/* scrollable mini timeline */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          ref={colRef}
          style={{ position: 'relative', height: `${PANEL_H}px`, cursor: 'crosshair' }}
          onDoubleClick={addAtClick}
        >
          {/* hour guide lines */}
          {ALL_GUIDES.map(h => {
            const p = yPct(h * 60);
            if (p < 0 || p > 100) return null;
            const isKey = [7, 9, 12, 15, 18, 21, 24].includes(h);
            return (
              <div key={h} style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                {isKey ? (
                  <span className="font-mono" style={{ fontSize: '0.56rem', color: 'var(--text-subtle)', padding: '0 6px', whiteSpace: 'nowrap', background: 'transparent' }}>
                    {String(h % 24).padStart(2,'0')}
                  </span>
                ) : (
                  <div style={{ width: '22px' }} />
                )}
                <div style={{ flex: 1, height: '1px', background: isKey ? 'rgba(24,24,27,0.09)' : 'rgba(24,24,27,0.04)' }} />
              </div>
            );
          })}

          {/* now line */}
          {nowMin >= DAY_START && nowMin <= DAY_END && (
            <div style={{
              position: 'absolute',
              top: `${yPct(nowMin)}%`,
              left: 0, right: 0,
              height: '1px',
              background: 'var(--text-ink)',
              opacity: 0.3,
              pointerEvents: 'none',
              zIndex: 5
            }}>
              <div style={{ position: 'absolute', left: '26px', top: '-3px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-ink)', opacity: 0.35 }} />
            </div>
          )}

          {/* board event notes — draggable & resizable on mini timeline */}
          {eventNotes.map(note => {
            const startMin = toMin(note.eventTime) ?? DAY_START;
            const dur = note.eventDurationMin || 60;
            const itemTask = { id: `board_${note.id}`, timeSlot: note.eventTime || '07:00', durationMin: dur };
            return (
              <div
                key={note.id}
                onMouseDown={e => startMove(e, itemTask)}
                onTouchStart={e => startMove(e, itemTask)}
                style={{
                  position: 'absolute',
                  top: `${yPct(startMin)}%`,
                  left: '32px', right: '4px',
                  height: `${hPct(dur)}%`,
                  minHeight: '20px',
                  background: note.isEvent ? 'var(--text-ink)' : 'var(--bg-note)',
                  border: note.isEvent ? 'none' : '1px solid rgba(24,24,27,0.18)',
                  borderRadius: '2px',
                  padding: '3px 6px',
                  overflow: 'hidden',
                  zIndex: 4,
                  cursor: 'grab',
                  userSelect: 'none'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: note.isEvent ? 'var(--bg-book)' : 'var(--text-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.blocks?.[0]?.text || 'Tarea'}
                </div>
                {note.eventTime && (
                  <span className="font-mono" style={{ fontSize: '0.56rem', color: note.isEvent ? 'rgba(247,244,238,0.5)' : 'var(--text-muted)' }}>{note.eventTime}</span>
                )}
                {/* Resize handle */}
                <div
                  onMouseDown={e => startResize(e, itemTask)}
                  onTouchStart={e => startResize(e, itemTask)}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize', zIndex: 10 }}
                />
              </div>
            );
          })}

          {/* planner tasks — draggable & resizable */}
          {tasks.map(task => {
            const startMin = toMin(task.timeSlot) ?? DAY_START;
            const dur = task.durationMin || 60;
            const endStr = toStr(startMin + dur);
            const isPast = startMin + dur < nowMin;
            return (
              <div
                key={task.id}
                onMouseDown={e => startMove(e, task)}
                onTouchStart={e => startMove(e, task)}
                style={{
                  position: 'absolute',
                  top: `${yPct(startMin)}%`,
                  left: '32px', right: '4px',
                  height: `${hPct(dur)}%`,
                  minHeight: '24px',
                  background: task.completed ? 'rgba(24,24,27,0.04)' : 'var(--bg-note)',
                  border: '1px solid rgba(24,24,27,0.15)',
                  borderLeft: `2px solid rgba(24,24,27,${task.completed ? 0.15 : 0.45})`,
                  borderRadius: '2px',
                  boxShadow: 'var(--shadow-subtle)',
                  padding: '2px 5px',
                  overflow: 'hidden',
                  zIndex: 4,
                  cursor: 'grab',
                  opacity: isPast && !task.completed ? 0.5 : 1,
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {task.timeSlot} — {endStr}
                  </span>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteTask(task.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.7rem', lineHeight: 1, padding: '0 1px' }}
                    title="Eliminar tarea"
                  >×</button>
                </div>
                <input
                  type="text"
                  value={task.text}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => updateTask(task.id, { text: e.target.value })}
                  placeholder="Tarea..."
                  style={{
                    fontSize: '0.73rem',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    padding: '1px 0',
                    flex: 1,
                    minHeight: 0,
                    textDecoration: task.completed ? 'line-through' : 'none',
                    color: task.completed ? 'var(--text-muted)' : 'var(--text-ink)',
                    cursor: 'text'
                  }}
                />
                {/* Resize handle */}
                <div
                  onMouseDown={e => startResize(e, task)}
                  onTouchStart={e => startResize(e, task)}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '6px', cursor: 'ns-resize', zIndex: 10 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Planner view: board tasks without a date ───────────────────────────────────
function BoardTasksPanel({ boardNotes, plannerTasks, onUpdatePlannerTasks, onUpdateBoardNotes }) {
  const [newText, setNewText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Collect checkmark task blocks from board notes that have no event date
  const boardItems = React.useMemo(() => {
    const items = [];
    (boardNotes || []).forEach(note => {
      // skip notes that already have a date assigned
      const hasSchedule = !!note.eventDate;
      (note.blocks || []).forEach(b => {
        const isCheckmarkTask = Boolean(b.isCheck || b.type === 'check');
        const hasText = b.text?.trim();

        if (isCheckmarkTask && hasText) {
          items.push({
            id: `board_${note.id}_${b.id}`,
            text: b.text.trim(),
            noteId: note.id,
            blockId: b.id,
            completed: !!b.completed,
            noteTitle: note.blocks?.[0]?.text || '',
            isScheduled: hasSchedule
          });
        }
      });
    });
    // show unscheduled first
    return items.filter(i => !i.isScheduled);
  }, [boardNotes]);

  // Existing unscheduled planner tasks (created in the panel directly)
  const ownTasks = plannerTasks.filter(t => !t.dayIso && !t.dayKey);

  const handleToggleBoardItem = (noteId, blockId) => {
    const note = (boardNotes || []).find(n => n.id === noteId);
    if (!note || !onUpdateBoardNotes) return;
    const newBlocks = (note.blocks || []).map(b =>
      b.id === blockId ? { ...b, completed: !b.completed } : b
    );
    onUpdateBoardNotes({ ...note, blocks: newBlocks });
  };

  const handleToggleOwnTask = (taskId) => {
    onUpdatePlannerTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    onUpdatePlannerTasks(prev => [...prev, {
      id: 'task_' + Date.now(),
      text: newText.trim(),
      completed: false,
      dayIso: null, dayKey: null,
      timeSlot: 'all_day',
      durationMin: 60
    }]);
    setNewText('');
  };

  const handleDeleteOwn = (id) => onUpdatePlannerTasks(prev => prev.filter(t => t.id !== id));

  const makeDragStart = (id, text, isBoardItem, noteId, blockId) => e => {
    if (isBoardItem) {
      e.dataTransfer.setData('boardBlockData', JSON.stringify({ text, noteId, blockId }));
    } else {
      e.dataTransfer.setData('panelTaskId', id);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const renderRow = (id, text, isCompleted, onToggle, draggable, onDragStart, onDelete) => (
    <div
      key={id}
      draggable={draggable}
      onDragStart={onDragStart}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '5px 12px',
        cursor: 'grab',
        opacity: isCompleted ? 0.45 : 1,
        transition: 'background 0.1s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <GripVertical size={10} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
      <button
        className={`block-checkmark ${isCompleted ? 'checked' : ''}`}
        style={{ width: '13px', height: '13px', flexShrink: 0 }}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {isCompleted && <Check size={8} strokeWidth={3} />}
      </button>
      <span style={{
        flex: 1,
        fontSize: '0.8rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textDecoration: isCompleted ? 'line-through' : 'none',
        color: isCompleted ? 'var(--text-muted)' : 'var(--text-ink)'
      }}>
        {text || <span style={{ fontStyle: 'italic', color: 'var(--text-subtle)' }}>sin título</span>}
      </span>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.7rem', padding: '0 1px', flexShrink: 0 }}>×</button>
      )}
    </div>
  );

  const visibleBoardItems = showCompleted ? boardItems : boardItems.filter(i => !i.completed);
  const visibleOwnTasks   = showCompleted ? ownTasks : ownTasks.filter(t => !t.completed);
  const totalVisibleCount = visibleBoardItems.length + visibleOwnTasks.length;
  const completedCount    = boardItems.filter(i => i.completed).length + ownTasks.filter(t => t.completed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: 'var(--border-hairline)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="font-mono" style={{ fontSize: '0.56rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>sin fecha</span>
          <button
            className={`btn-icon ${showCompleted ? 'active' : ''}`}
            onClick={() => setShowCompleted(p => !p)}
            title={showCompleted ? "Ocultar completadas" : "Mostrar completadas"}
            style={{ padding: '2px 5px', fontSize: '0.66rem', gap: '3px' }}
          >
            <CheckSquare size={10} />
            <span className="font-mono">{showCompleted ? 'Ocultar' : `Done (${completedCount})`}</span>
          </button>
        </div>
        <div className="font-title" style={{ fontSize: '1.1rem', fontStyle: 'italic', marginTop: '2px' }}>
          Pendientes
        </div>
        <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-subtle)', display: 'block', marginTop: '4px' }}>
          ↠ arrastra al planificador
        </span>
      </div>

      {/* quick add */}
      <div style={{ padding: '8px 12px', borderBottom: 'var(--border-hairline)', display: 'flex', gap: '6px', flexShrink: 0 }}>
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nueva tarea..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', fontFamily: 'inherit', color: 'var(--text-ink)' }}
        />
        <button onClick={handleAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}>
          <Plus size={13} />
        </button>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '4px' }}>
        {totalVisibleCount === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center' }}>
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
              {completedCount > 0 && !showCompleted ? `${completedCount} tarea(s) completada(s) oculta(s)` : 'sin tareas pendientes'}
            </span>
          </div>
        ) : (
          <>
            {/* own planner tasks */}
            {visibleOwnTasks.length > 0 && (
              <>
                {visibleOwnTasks.map(t => renderRow(
                  t.id, t.text, t.completed,
                  () => handleToggleOwnTask(t.id),
                  true, makeDragStart(t.id, t.text, false),
                  () => handleDeleteOwn(t.id)
                ))}
                {visibleBoardItems.length > 0 && <div style={{ height: '1px', background: 'rgba(24,24,27,0.08)', margin: '6px 0' }} />}
              </>
            )}
            {/* board checkmark blocks */}
            {visibleBoardItems.map(item => renderRow(
              item.id,
              item.text,
              item.completed,
              () => handleToggleBoardItem(item.noteId, item.blockId),
              true,
              makeDragStart(item.id, item.text, true, item.noteId, item.blockId),
              null // no delete — it's from the board
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export function LeftEdgePanel({ activeView, plannerTasks, onUpdatePlannerTasks, boardNotes, onUpdateBoardNotes }) {
  const [visible, setVisible] = useState(false);
  const closeTimeout = useRef(null);

  const open = () => { clearTimeout(closeTimeout.current); setVisible(true); };
  const close = () => { closeTimeout.current = setTimeout(() => setVisible(false), 250); };

  return (
    <>
      {/* invisible hotzone */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, width: '16px', height: '100vh', zIndex: 190 }}
        onMouseEnter={open}
        onMouseLeave={close}
      />

      {/* sliding panel */}
      <div
        className={`left-edge-panel ${visible ? 'left-edge-panel--open' : ''}`}
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {activeView === 'board'
          ? <TodayPanel plannerTasks={plannerTasks} boardNotes={boardNotes} onUpdatePlannerTasks={onUpdatePlannerTasks} onUpdateBoardNotes={onUpdateBoardNotes} />
          : <BoardTasksPanel boardNotes={boardNotes} plannerTasks={plannerTasks} onUpdatePlannerTasks={onUpdatePlannerTasks} onUpdateBoardNotes={onUpdateBoardNotes} />
        }
      </div>
    </>
  );
}
