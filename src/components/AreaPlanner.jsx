import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import {
  AREA_COLORS, SLOTS, BANDS, SLOT_STEP, SNAP, DAY_FROM, DAY_TO,
  uid, isoOf, addDays, dayLabel, fmtMin, durLabel, durOf, rowStart, effectiveSlot, computeLanes
} from '../lib/areaPlan';
import './AreaPlanner.css';

const LAST_BLOCK_START = DAY_TO - SNAP;
// One grid row (30 min) is ROW_PX tall; the same value feeds the --row CSS
// variable, so block geometry can never drift from the rows it sits on.
const ROW_PX = 36;
const PX_PER_MIN = ROW_PX / SLOT_STEP;
const isTimed = (e) => typeof e.eff.at === 'number';

function autoSize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// plan: { view: 'areas' | 'day', hidden: [areaId], areas: [{id,name,c}], items: [...] }
// onChange receives an updater function (prev => next), so edits made in the
// same tick (blur + Enter) never overwrite each other.
export function AreaPlanner({ plan, onChange, onBack, compact }) {
  const [clock, setClock] = useState(() => new Date());
  const [focusId, setFocusId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [toast, setToast] = useState('');
  const gestureEnd = useRef(0); // time a stretch/drag last ended; swallows its trailing click
  const wrapRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = isoOf(clock);
  const tomorrow = addDays(today, 1);
  const curMin = clock.getHours() * 60 + clock.getMinutes();

  // Open at the current hour.
  useEffect(() => {
    const wrap = wrapRef.current;
    const now = wrap && wrap.querySelector('.ap-rail.now');
    if (now) wrap.scrollTop = Math.max(0, now.offsetTop - 180);
  }, []);

  const mutate = (fn) => onChange(fn);
  const isHidden = (id) => plan.hidden.includes(id);
  const areaOf = (id) => plan.areas.find((a) => a.id === id) || plan.areas[0];
  const colorOf = (area) => AREA_COLORS[area.c % AREA_COLORS.length];
  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const entries = plan.items.map((it) => ({ it, eff: effectiveSlot(it, today) }));
  const visibleAreas = plan.areas.filter((a) => !isHidden(a.id));
  const areaMode = plan.view === 'areas';

  const cols = !areaMode
    ? [{ id: '__day', kind: 'day' }]
    : [
        ...visibleAreas.map((a) => ({ id: a.id, kind: 'area', area: a })),
        ...(visibleAreas.length < plan.areas.length ? [{ id: '__rest', kind: 'rest' }] : [])
      ];

  const colEntries = (col) => {
    if (col.kind === 'area') return entries.filter((e) => e.it.area === col.id);
    if (col.kind === 'day') return entries.filter((e) => !isHidden(e.it.area) || isTimed(e));
    return entries.filter((e) => isHidden(e.it.area) && isTimed(e));
  };
  const colData = cols.map((col) => {
    const list = colEntries(col);
    return { col, list, lanes: computeLanes(list) };
  });

  const detailedRows = (day) => [
    { day, at: 'any', label: 'Cuando sea', tall: true },
    ...SLOTS.map((m) => ({ day, at: m, label: fmtMin(m), slot: true, half: m % 60 === 30 }))
  ];
  const dayAfter = addDays(today, 2);
  const tomorrowOpen = !plan.tomorrowCollapsed;
  const sections = [
    {
      id: 'hoy', title: 'Hoy', sub: `${dayLabel(today)} · bloques de 15 min`,
      rows: detailedRows(today)
    },
    {
      id: 'man', title: 'Mañana', sub: `${dayLabel(tomorrow)} · bloques de 15 min`,
      rows: tomorrowOpen ? detailedRows(tomorrow) : [{ day: tomorrow, at: 'any', label: 'Cuando sea', tall: true }]
    },
    {
      id: 'pas', title: 'Pasado mañana', sub: `${dayLabel(dayAfter)} · por franja`,
      rows: BANDS.map((b) => ({ day: dayAfter, at: b.id, label: b.label, note: b.note }))
    },
    {
      id: 'sem', title: 'Próximos días', sub: 'por día',
      rows: [3, 4, 5, 6].map((i) => ({ day: addDays(today, i), at: 'any', label: dayLabel(addDays(today, i)) }))
    },
    { id: 'later', title: 'Más adelante', sub: 'sin fecha', rows: [{ day: 'later', at: 'any', label: 'Backlog', tall: true }] }
  ];

  const timedToday = entries.filter((e) => isTimed(e) && e.eff.day === today);
  const plannedMin = timedToday.reduce((s, e) => s + durOf(e.it), 0);
  const aheadMin = timedToday
    .filter((e) => !e.it.done && e.eff.at + durOf(e.it) > curMin)
    .reduce((s, e) => s + durOf(e.it), 0);
  const todaySub = `${dayLabel(today)} · bloques de 15 min · ${plannedMin ? durLabel(plannedMin) : '0h'} planificadas · ${aheadMin ? durLabel(aheadMin) : '0h'} por delante`;

  // ── mutations ──────────────────────────────────────────────────────────
  const makeItem = (area, pos, dur) => ({
    id: uid(), area, text: '', done: false, day: pos.day, at: pos.at,
    ...(typeof pos.at === 'number' ? { dur: dur || 60 } : {})
  });
  // Minute of the day under the pointer: the top half of a 30-min row is :00,
  // the bottom half is :15.
  const pointAt = (row, ev) => {
    if (!row.slot) return row.at;
    const r = ev.currentTarget.getBoundingClientRect();
    const steps = SLOT_STEP / SNAP;
    const k = Math.floor(((ev.clientY - r.top) / r.height) * steps);
    return row.at + Math.max(0, Math.min(k, steps - 1)) * SNAP;
  };
  const insertAfter = (items, afterId, item) => {
    const idx = afterId ? items.findIndex((i) => i.id === afterId) + 1 : items.length;
    return [...items.slice(0, idx), item, ...items.slice(idx)];
  };
  const addItem = (row, areaId, at) => {
    const item = makeItem(areaId, { day: row.day, at: at === undefined ? row.at : at });
    mutate((p) => ({ ...p, items: [...p.items, item] }));
    setFocusId(item.id);
  };
  const patchItem = (id, patch) => mutate((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id) => mutate((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  const onTextKeyDown = (e, it, eff) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.currentTarget.value.trim();
      if (!text) { e.currentTarget.blur(); return; }
      // In today's grid the next block starts where this one ends.
      const next = typeof eff.at === 'number'
        ? { day: eff.day, at: Math.min(eff.at + durOf(it), LAST_BLOCK_START) }
        : { day: eff.day, at: eff.at };
      const item = makeItem(it.area, next);
      mutate((p) => ({
        ...p,
        items: insertAfter(p.items.map((i) => (i.id === it.id ? { ...i, text } : i)), it.id, item)
      }));
      setFocusId(item.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault();
      removeItem(it.id);
    }
  };

  // Move a block (or list item) by grabbing it anywhere that isn't a control.
  // The block follows the pointer: the cell under it picks the day/area, and
  // inside the detailed grid the minute snaps to SNAP.
  const startMove = (e, it, eff) => {
    if (e.button !== 0) return;
    const onGrip = e.target.closest('.ap-grip');
    if (e.target.closest('textarea, .ap-chk, .ap-del, .ap-rs')) return;
    if (e.pointerType === 'touch' && !onGrip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const grabMin = typeof eff.at === 'number' ? (e.clientY - rect.top) / PX_PER_MIN : 0;
    const startX = e.clientX;
    const startY = e.clientY;
    const dur = durOf(it);
    let active = false;
    let last = '';
    const move = (ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        active = true;
        setMovingId(it.id);
        document.body.classList.add('ap-moving');
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = hit && hit.closest('.ap-cell');
      if (!cell || !cell.dataset.kind || cell.dataset.kind === 'rest') return;
      let at;
      if (cell.dataset.slot) {
        const r = cell.getBoundingClientRect();
        const minute = Number(cell.dataset.at) + (ev.clientY - r.top) / PX_PER_MIN - grabMin;
        at = Math.max(DAY_FROM, Math.min(DAY_TO - dur, Math.round(minute / SNAP) * SNAP));
      } else {
        at = Number.isNaN(Number(cell.dataset.at)) ? cell.dataset.at : Number(cell.dataset.at);
      }
      const area = cell.dataset.kind === 'area' ? cell.dataset.col : null;
      const key = `${cell.dataset.day}|${at}|${area}`;
      setOverKey(`${cell.dataset.day}|${cell.dataset.at}|${cell.dataset.col}`);
      if (key === last) return;
      last = key;
      patchItem(it.id, {
        day: cell.dataset.day,
        at,
        ...(area ? { area } : {}),
        ...(typeof at === 'number' ? { dur } : {})
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('ap-moving');
      if (active) gestureEnd.current = Date.now();
      setMovingId(null);
      setOverKey(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const startResize = (e, it, eff) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startDur = durOf(it);
    const maxDur = DAY_TO - eff.at;
    const move = (ev) => {
      const delta = Math.round((ev.clientY - startY) / PX_PER_MIN / SNAP) * SNAP;
      patchItem(it.id, { dur: Math.max(SNAP, Math.min(maxDur, startDur + delta)) });
    };
    const up = () => {
      gestureEnd.current = Date.now();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const addArea = () => {
    const used = plan.areas.map((a) => a.c);
    const c = AREA_COLORS.findIndex((_, i) => !used.includes(i));
    const area = { id: uid(), name: 'Nueva área', c: c < 0 ? plan.areas.length % AREA_COLORS.length : c };
    mutate((p) => ({ ...p, areas: [...p.areas, area] }));
    setFocusId(area.id);
  };
  const toggleChip = (id) => mutate((p) => ({
    ...p,
    hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id]
  }));
  const soloArea = (area) => {
    mutate((p) => ({ ...p, hidden: p.areas.map((a) => a.id).filter((x) => x !== area.id) }));
    flash(`Solo ${area.name} · el resto aparece como ocupado`);
  };

  // ── render pieces ──────────────────────────────────────────────────────
  const renderItem = (e, col, lane) => {
    const { it, eff } = e;
    const area = areaOf(it.area);
    const ghost = col.kind !== 'area' && isHidden(it.area);
    const tagged = col.kind !== 'area';
    const timed = typeof eff.at === 'number';
    const dur = durOf(it);
    const cls = 'ap-item' + (it.done ? ' done' : '') + (ghost ? ' ghost' : '') + (timed ? ' block' : '') + (movingId === it.id ? ' moving' : '');
    const grab = ghost ? undefined : (ev) => startMove(ev, it, eff);
    const style = { '--c': colorOf(area) };
    if (timed) {
      style['--dur'] = dur;
      style['--off'] = eff.at % SLOT_STEP;
      if (lane) { style['--l'] = lane.lane; style['--n'] = lane.n; }
    }
    const head = (
      <>
        <span className="ap-grip" title="Arrastrar">⋮⋮</span>
        <button
          className="ap-chk" aria-label={it.done ? 'Marcar pendiente' : 'Marcar hecho'}
          onClick={() => patchItem(it.id, { done: !it.done })}
        />
        <textarea
          className="ap-txt" rows={1} defaultValue={it.text} placeholder="Escribe…" spellCheck={false}
          readOnly={ghost} tabIndex={ghost ? -1 : 0}
          autoFocus={focusId === it.id}
          ref={autoSize}
          onFocus={(ev) => {
            if (focusId === it.id) setFocusId(null);
            const n = ev.currentTarget.value.length;
            ev.currentTarget.setSelectionRange(n, n);
          }}
          onInput={(ev) => autoSize(ev.currentTarget)}
          onBlur={(ev) => {
            const text = ev.currentTarget.value.trim();
            if (!text) removeItem(it.id);
            else if (text !== it.text) patchItem(it.id, { text });
          }}
          onKeyDown={(ev) => onTextKeyDown(ev, it, eff)}
          onClick={(ev) => ev.stopPropagation()}
        />
        <button className="ap-del" aria-label="Borrar tarea" onClick={() => removeItem(it.id)}>×</button>
      </>
    );
    if (timed) {
      return (
        <li key={it.id} className={cls} style={style} onPointerDown={grab} data-short={dur <= SNAP ? 2 : dur <= SLOT_STEP ? 1 : undefined}>
          <div className="ap-bh">{head}</div>
          <div className="ap-meta">
            {tagged ? `${area.name} · ` : ''}{fmtMin(eff.at)}–{fmtMin(eff.at + dur)} · {durLabel(dur)}
          </div>
          {!ghost && (
            <div className="ap-rs" title="Estirar para cambiar la duración" onPointerDown={(ev) => startResize(ev, it, eff)} />
          )}
        </li>
      );
    }
    return (
      <li key={it.id} className={cls} style={style} onPointerDown={grab}>
        {head}
        {tagged && <span className="ap-tag">{area.name}</span>}
      </li>
    );
  };

  const onCellClick = (row, col, ev) => {
    if (col.kind === 'rest') return;
    // Releasing a stretch fires a click on whatever is under the pointer, and
    // clicking a block's padding or time label bubbles up here too; neither
    // should create a new block.
    if (Date.now() - gestureEnd.current < 400) return;
    if (ev.target.closest('.ap-item')) return;
    const at = pointAt(row, ev);
    if (col.kind === 'day') {
      const target = visibleAreas[0];
      if (!target) { flash('Activa un área para añadir tareas'); return; }
      addItem(row, target.id, at);
      return;
    }
    addItem(row, col.id, at);
  };

  // Columns share the full width equally, so every area is visible without
  // sideways scrolling; they only scroll once they would drop under their minimum.
  const RAIL_PX = 84;
  const ADD_PX = 44;
  const colMin = (c) => (c.kind === 'rest' ? 110 : c.kind === 'day' ? 280 : 128);
  const gridTemplate = `${RAIL_PX}px `
    + cols.map((c) => (c.kind === 'rest' ? 'minmax(110px, 0.6fr)' : c.kind === 'day' ? 'minmax(280px, 820px)' : 'minmax(128px, 1fr)')).join(' ')
    + (areaMode ? ` ${ADD_PX}px` : '');
  const boardMinWidth = RAIL_PX + cols.reduce((sum, c) => sum + colMin(c), 0) + (areaMode ? ADD_PX : 0);

  return (
    <div className={`ap-root${compact ? ' compact' : ''}`} style={{ '--row': `${ROW_PX}px` }}>
      <div className="ap-head">
        <h1 className="font-title">Plan por áreas</h1>
        <span className="ap-sub">{areaMode ? 'tiempo ↓ · áreas →' : 'día completo'}</span>
        {onBack && (
          <button className="ap-btn ap-back" onClick={onBack}>
            <ChevronUp size={12} style={{ verticalAlign: '-2px' }} /> Lienzo
          </button>
        )}
      </div>

      <div className="ap-filters">
        <div className="ap-seg">
          <button aria-pressed={areaMode} onClick={() => mutate((p) => ({ ...p, view: 'areas' }))}>Por áreas</button>
          <button aria-pressed={!areaMode} onClick={() => mutate((p) => ({ ...p, view: 'day' }))}>Día completo</button>
        </div>
        <span className="ap-flabel">Mostrar</span>
        {plan.areas.map((a) => (
          <button
            key={a.id} className="ap-chip" style={{ '--c': colorOf(a) }}
            aria-pressed={!isHidden(a.id)}
            title="Clic: mostrar u ocultar · Doble clic: solo esta área"
            onClick={() => toggleChip(a.id)}
            onDoubleClick={() => soloArea(a)}
          >
            <i />{a.name}
          </button>
        ))}
        <button
          className="ap-chip all" aria-pressed={plan.hidden.length === 0}
          onClick={() => mutate((p) => ({ ...p, hidden: [] }))}
        >Todas</button>
      </div>

      <div className="ap-wrap" ref={wrapRef}>
        <div className="ap-board" style={{ gridTemplateColumns: gridTemplate, minWidth: boardMinWidth }}>
          <div className="ap-hcell corner">{areaMode ? 'Tiempo ↓ / Área →' : 'Tiempo ↓'}</div>
          {cols.map((col) => {
            if (col.kind !== 'area') {
              return (
                <div key={col.id} className={`ap-hcell pseudo ${col.kind}`}>
                  <div className="ap-aname"><i /><span>{col.kind === 'day' ? 'Día completo' : 'Resto del día'}</span></div>
                  <div className="ap-acount">
                    {col.kind === 'day'
                      ? `${visibleAreas.length} de ${plan.areas.length} áreas · el color indica el área`
                      : 'ocupado en áreas ocultas'}
                  </div>
                </div>
              );
            }
            const a = col.area;
            const open = entries.filter((e) => e.it.area === a.id && e.eff.day === today && !e.it.done).length;
            const total = entries.filter((e) => e.it.area === a.id && e.eff.day === today).length;
            return (
              <div key={col.id} className="ap-hcell" style={{ '--c': colorOf(a) }}>
                <div className="ap-aname">
                  <i />
                  <input
                    defaultValue={a.name} spellCheck={false} aria-label="Nombre del área"
                    autoFocus={focusId === a.id}
                    onFocus={(ev) => { if (focusId === a.id) setFocusId(null); ev.currentTarget.select(); }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === 'Escape') ev.currentTarget.blur(); }}
                    onBlur={(ev) => {
                      const name = ev.currentTarget.value.trim();
                      if (!name) { ev.currentTarget.value = a.name; return; }
                      if (name !== a.name) mutate((p) => ({ ...p, areas: p.areas.map((x) => (x.id === a.id ? { ...x, name } : x)) }));
                    }}
                  />
                </div>
                <div className="ap-acount">
                  {total ? `${open} pendiente${open === 1 ? '' : 's'} hoy` : 'nada hoy'}
                </div>
              </div>
            );
          })}
          {areaMode && (
            <div className="ap-addcol"><button onClick={addArea} title="Añadir área" aria-label="Añadir área">+</button></div>
          )}

          {sections.map((sec) => (
            <React.Fragment key={sec.id}>
              <div className="ap-band">
                <div>
                  <h2 className="font-title">{sec.title}</h2>
                  <span className="ap-sub">{sec.id === 'hoy' ? todaySub : sec.sub}</span>
                  {sec.id === 'man' && (
                    <button
                      className="ap-btn ap-fold"
                      onClick={() => mutate((p) => ({ ...p, tomorrowCollapsed: !p.tomorrowCollapsed }))}
                    >
                      {tomorrowOpen ? 'Ocultar horas' : 'Mostrar horas'}
                    </button>
                  )}
                </div>
              </div>
              {sec.rows.map((row) => {
                const rowKey = `${row.day}|${row.at}`;
                const isToday = row.day === today;
                const isNow = isToday && row.slot && curMin >= row.at && curMin < row.at + SLOT_STEP;
                const past = isToday && row.slot && row.at + SLOT_STEP <= curMin;
                const sx = (row.slot ? ' slot' : '') + (row.half ? ' half' : '') + (past ? ' past' : '');
                const nowp = isNow ? { '--nowp': `${((curMin - row.at) / SLOT_STEP) * 100}%` } : undefined;
                return (
                  <React.Fragment key={rowKey}>
                    <div className={`ap-rail${sx}${isNow ? ' now' : ''}`} style={nowp}>
                      {row.label}
                      {row.note && <small>{row.note}</small>}
                    </div>
                    {colData.map(({ col, list, lanes }) => {
                      const cellKey = `${rowKey}|${col.id}`;
                      const here = list.filter((e) => e.eff.day === row.day
                        && (typeof e.eff.at === 'number' ? rowStart(e.eff.at) : e.eff.at) === row.at);
                      return (
                        <div
                          key={cellKey}
                          className={`ap-cell${sx}${isNow ? ' nowrow' : ''}${row.tall ? ' tall' : ''}${col.kind === 'rest' ? ' rest' : ''}${overKey === cellKey ? ' over' : ''}`}
                          style={nowp}
                          onClick={(ev) => onCellClick(row, col, ev)}
                          data-day={row.day} data-at={String(row.at)} data-slot={row.slot ? '1' : undefined}
                          data-col={col.id} data-kind={col.kind}
                        >
                          <ul>{here.map((e) => renderItem(e, col, lanes[e.it.id]))}</ul>
                        </div>
                      );
                    })}
                    {areaMode && <div className={`ap-cell rest${sx}`} style={{ cursor: 'default' }} />}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p className="ap-hint">
        Clic en una casilla para escribir · <kbd>Enter</kbd> crea la siguiente (en las horas empieza donde termina la anterior) · <kbd>Esc</kbd> termina · arrastra un bloque para moverlo y estira su borde inferior para cambiar la duración (de 15 en 15 min)
      </p>
      {toast && <div className="ap-toast" role="status">{toast}</div>}
    </div>
  );
}
