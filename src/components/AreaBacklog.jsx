import React, { useState } from 'react';
import { Plus, GripVertical, Check } from 'lucide-react';
import { AREA_COLORS, AREA_DRAG_TYPE, uid } from '../lib/areaPlan';
import './AreaBacklog.css';

// The plan's "Más adelante" items (no date yet), filterable by area. Rows can
// be dragged onto the week, the month, the board or the full-day view.
export function AreaBacklog({ plan, onChange, showCompleted }) {
  const [newText, setNewText] = useState('');
  const [newArea, setNewArea] = useState('');

  const isHidden = (id) => plan.hidden.includes(id);
  const areaById = Object.fromEntries(plan.areas.map((a) => [a.id, a]));
  const colorOf = (a) => AREA_COLORS[a.c % AREA_COLORS.length];
  const visibleAreas = plan.areas.filter((a) => !isHidden(a.id));

  const later = plan.items.filter((it) => it.day === 'later' && areaById[it.area] && !isHidden(it.area));
  const shown = later.filter((it) => showCompleted || !it.done);
  const targetId = visibleAreas.some((a) => a.id === newArea) ? newArea : (visibleAreas[0] && visibleAreas[0].id) || '';

  const toggleArea = (id) => onChange((p) => ({
    ...p,
    hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id]
  }));
  const patch = (id, fields) => onChange((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...fields } : it)) }));
  const remove = (id) => onChange((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
  const add = () => {
    const text = newText.trim();
    if (!text || !targetId) return;
    onChange((p) => ({ ...p, items: [...p.items, { id: uid(), area: targetId, text, done: false, day: 'later', at: 'any' }] }));
    setNewText('');
  };

  return (
    <div className="ab">
      <div className="ab-head">
        <span className="ab-title">Más adelante</span>
        <span className="ab-count">{shown.length}</span>
      </div>

      <div className="ab-pills">
        {plan.areas.map((a) => (
          <button
            key={a.id} className="ap-chip" style={{ '--c': colorOf(a) }}
            aria-pressed={!isHidden(a.id)} title="Mostrar u ocultar esta área"
            onClick={() => toggleArea(a.id)}
          >
            <i />{a.name}
          </button>
        ))}
        <button
          className="ap-chip all" aria-pressed={plan.hidden.length === 0}
          onClick={() => onChange((p) => ({ ...p, hidden: [] }))}
        >Todas</button>
      </div>

      {visibleAreas.length > 0 && (
        <div className="ab-add">
          <input
            id="ab-new-text" type="text" value={newText} placeholder="Añadir aquí…"
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          />
          <select id="ab-new-area" className="ap-btn" value={targetId} onChange={(e) => setNewArea(e.target.value)} aria-label="Área de la tarea nueva">
            {visibleAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={add} aria-label="Añadir"><Plus size={13} /></button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="ab-empty">
          {visibleAreas.length === 0 ? 'todas las áreas están ocultas' : 'nada pendiente para más adelante'}
        </div>
      ) : (
        shown.map((it) => {
          const a = areaById[it.area];
          return (
            <div
              key={it.id}
              className={`ab-row${it.done ? ' done' : ''}`}
              style={{ '--c': colorOf(a) }}
              title={a.name}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(AREA_DRAG_TYPE, it.id);
                e.dataTransfer.setData('text/plain', it.text);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <GripVertical size={10} style={{ color: 'var(--text-subtle)', flexShrink: 0, marginTop: 3 }} />
              <button
                className={`block-checkmark ${it.done ? 'checked' : ''}`}
                style={{ width: '13px', height: '13px', flexShrink: 0, marginTop: 2 }}
                aria-label={it.done ? 'Marcar pendiente' : 'Marcar hecho'}
                onClick={(e) => { e.stopPropagation(); patch(it.id, { done: !it.done }); }}
              >
                {it.done && <Check size={8} strokeWidth={3} />}
              </button>
              <span className="ab-text">{it.text || 'sin título'}</span>
              <button className="ab-del" aria-label="Borrar tarea" onClick={(e) => { e.stopPropagation(); remove(it.id); }}>×</button>
            </div>
          );
        })
      )}
    </div>
  );
}
