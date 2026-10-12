import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import {
  AREA_COLORS, SLOTS, BANDS, SLOT_STEP, DAY_TO,
  uid, isoOf, addDays, dayLabel, fmtMin, durLabel, effectiveSlot, computeLanes
} from '../lib/areaPlan';
import './AreaPlanner.css';

const LAST_BLOCK_START = DAY_TO - SLOT_STEP;
const isTimed = (e, today) => e.eff.day === today && typeof e.eff.at === 'number';

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
  const [toast, setToast] = useState('');
  const dragId = useRef(null);
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
    if (col.kind === 'day') return entries.filter((e) => !isHidden(e.it.area) || isTimed(e, today));
    return entries.filter((e) => isHidden(e.it.area) && isTimed(e, today));
  };
  const colData = cols.map((col) => {
    const list = colEntries(col);
    return { col, list, lanes: computeLanes(list, today) };
  });

  const sections = [
    {
      id: 'hoy', title: 'Hoy', sub: `${dayLabel(today)} · cada 30 min`,
      rows: [
        { day: today, at: 'any', label: 'Cuando sea', tall: true },
        ...SLOTS.map((m) => ({ day: today, at: m, label: fmtMin(m), slot: true, half: m % 60 === 30 }))
      ]
    },
    {
      id: 'man', title: 'Mañana', sub: `${dayLabel(tomorrow)} · por franja`,
      rows: BANDS.map((b) => ({ day: tomorrow, at: b.id, label: b.label, note: b.note }))
    },
    {
      id: 'sem', title: 'Próximos días', sub: 'por día',
      rows: [2, 3, 4, 5, 6].map((i) => ({ day: addDays(today, i), at: 'any', label: dayLabel(addDays(today, i)) }))
    },
    { id: 'later', title: 'Más adelante', sub: 'sin fecha', rows: [{ day: 'later', at: 'any', label: 'Backlog', tall: true }] }
  ];

  const timedToday = entries.filter((e) => isTimed(e, today));
  const plannedBlocks = timedToday.reduce((s, e) => s + (e.it.d || 2), 0);
  const aheadBlocks = timedToday
    .filter((e) => !e.it.done && e.eff.at + (e.it.d || 2) * SLOT_STEP > curMin)
    .reduce((s, e) => s + (e.it.d || 2), 0);
  const todaySub = `${dayLabel(today)} · cada 30 min · ${plannedBlocks ? durLabel(plannedBlocks) : '0h'} planificadas · ${aheadBlocks ? durLabel(aheadBlocks) : '0h'} por delante`;

  // ── mutations ──────────────────────────────────────────────────────────
  const makeItem = (area, pos, d) => ({
    id: uid(), area, text: '', done: false, day: pos.day, at: pos.at,
    ...(typeof pos.at === 'number' ? { d: d || 2 } : {})
  });
  const insertAfter = (items, afterId, item) => {
    const idx = afterId ? items.findIndex((i) => i.id === afterId) + 1 : items.length;
    return [...items.slice(0, idx), item, ...items.slice(idx)];
  };
  const addItem = (row, areaId) => {
    const item = makeItem(areaId, { day: row.day, at: row.at });
    mutate((p) => ({ ...p, items: [...p.items, item] }));
    setFocusId(item.id);
  };
  const patchItem = (id, patch) => mutate((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id) => mutate((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  const moveItem = (id, row, areaId) => {
    mutate((p) => {
      const found = p.items.find((i) => i.id === id);
      if (!found) return p;
      const moved = { ...found, day: row.day, at: row.at };
      if (areaId) moved.area = areaId;
      if (typeof row.at === 'number') moved.d = found.d || 2; else delete moved.d;
      return { ...p, items: [...p.items.filter((i) => i.id !== id), moved] };
    });
  };

  const onTextKeyDown = (e, it, eff) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.currentTarget.value.trim();
      if (!text) { e.currentTarget.blur(); return; }
      // In today's grid the next block starts where this one ends.
      const next = typeof eff.at === 'number'
        ? { day: eff.day, at: Math.min(eff.at + (it.d || 2) * SLOT_STEP, LAST_BLOCK_START) }
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

  const startResize = (e, it, eff) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startD = it.d || 2;
    const maxD = (DAY_TO - eff.at) / SLOT_STEP;
    const move = (ev) => {
      const d = Math.max(1, Math.min(maxD, startD + Math.round((ev.clientY - startY) / 30)));
      patchItem(it.id, { d });
    };
    const up = () => {
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
    const timed = typeof eff.at === 'number' && eff.day === today;
    const d = it.d || 2;
    const cls = 'ap-item' + (it.done ? ' done' : '') + (ghost ? ' ghost' : '') + (timed ? ' block' : '');
    const style = { '--c': colorOf(area) };
    if (timed) {
      style['--d'] = d;
      if (lane) { style['--l'] = lane.lane; style['--n'] = lane.n; }
    }
    const head = (
      <>
        <span
          className="ap-grip" title="Arrastrar" draggable={!ghost}
          onDragStart={(ev) => {
            dragId.current = it.id;
            try { ev.dataTransfer.setData('text/plain', it.id); ev.dataTransfer.effectAllowed = 'move'; } catch { /* some browsers refuse setData */ }
            const li = ev.currentTarget.closest('li');
            if (li) ev.dataTransfer.setDragImage(li, 12, 12);
          }}
          onDragEnd={() => { dragId.current = null; setOverKey(null); }}
        >⋮⋮</span>
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
        <li key={it.id} className={cls} style={style} data-d={d}>
          <div className="ap-bh">{head}</div>
          <div className="ap-meta">
            {tagged ? `${area.name} · ` : ''}{fmtMin(eff.at)}–{fmtMin(eff.at + d * SLOT_STEP)} · {durLabel(d)}
          </div>
          {!ghost && (
            <div className="ap-rs" title="Estirar para cambiar la duración" onPointerDown={(ev) => startResize(ev, it, eff)} />
          )}
        </li>
      );
    }
    return (
      <li key={it.id} className={cls} style={style}>
        {head}
        {tagged && <span className="ap-tag">{area.name}</span>}
      </li>
    );
  };

  const onCellClick = (row, col) => {
    if (col.kind === 'rest') return;
    if (col.kind === 'day') {
      const target = visibleAreas[0];
      if (!target) { flash('Activa un área para añadir tareas'); return; }
      addItem(row, target.id);
      return;
    }
    addItem(row, col.id);
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
    <div className={`ap-root${compact ? ' compact' : ''}`}>
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
                </div>
              </div>
              {sec.rows.map((row) => {
                const rowKey = `${row.day}|${row.at}`;
                const isNow = row.slot && curMin >= row.at && curMin < row.at + SLOT_STEP;
                const past = row.slot && row.at + SLOT_STEP <= curMin;
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
                      const here = list.filter((e) => e.eff.day === row.day && e.eff.at === row.at);
                      return (
                        <div
                          key={cellKey}
                          className={`ap-cell${sx}${isNow ? ' nowrow' : ''}${row.tall ? ' tall' : ''}${col.kind === 'rest' ? ' rest' : ''}${overKey === cellKey ? ' over' : ''}`}
                          style={nowp}
                          onClick={() => onCellClick(row, col)}
                          onDragOver={(ev) => {
                            if (!dragId.current || col.kind === 'rest') return;
                            ev.preventDefault();
                            if (overKey !== cellKey) setOverKey(cellKey);
                          }}
                          onDrop={(ev) => {
                            if (!dragId.current || col.kind === 'rest') return;
                            ev.preventDefault();
                            moveItem(dragId.current, row, col.kind === 'area' ? col.id : null);
                            dragId.current = null;
                            setOverKey(null);
                          }}
                        >
                          <ul>{here.map((e) => renderItem(e, col, lanes[e.it.id]))}</ul>
                        </div>
                      );
                    })}
                    {areaMode && <div className="ap-cell rest" style={{ cursor: 'default' }} />}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p className="ap-hint">
        Clic en una casilla para escribir · <kbd>Enter</kbd> crea la siguiente (en Hoy empieza donde termina la anterior) · <kbd>Esc</kbd> termina · estira el borde de un bloque para cambiar su duración · arrastra con ⋮⋮
      </p>
      {toast && <div className="ap-toast" role="status">{toast}</div>}
    </div>
  );
}
