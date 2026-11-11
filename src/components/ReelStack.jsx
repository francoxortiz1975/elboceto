import React, { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical, Check } from 'lucide-react';
import { AREA_COLORS, dayLabel } from '../lib/areaPlan';
import { slotDate, moveReel, nudgeReel, togglePosted, reelText, openReel, addReel } from '../lib/contentPlan';
import './ReelStack.css';

// The next posts to publish, in order. Each position has a date, so reordering the
// list moves the blocks in the calendar. Posted ones keep their slot.
function Stack({ plan, stackId, onChange }) {
  const stack = plan.stacks[stackId];
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [newName, setNewName] = useState('');

  const area = plan.areas.find((a) => a.id === stack.area);
  const color = area ? AREA_COLORS[area.c % AREA_COLORS.length] : AREA_COLORS[0];
  const doneOf = (id) => plan.items.some((it) => it.id === `${stackId}:reel:${id}` && it.done);
  const ids = stack.order.filter((id) => stack.reels[id]);
  const pending = ids.filter((id) => !doneOf(id)).length;
  const mutate = (fn) => onChange((p) => fn(p));

  return (
    <div className="rs" style={{ '--c': color }}>
      <div className="rs-head">
        <span className="rs-title"><i />{stack.title} · {area ? area.name : ''}</span>
        <span className="rs-count">{pending} por publicar</span>
      </div>
      <ol className="rs-list">
        {ids.map((id, i) => {
          const r = reelText(stack.reels[id]);
          const done = doneOf(id);
          return (
            <li
              key={id}
              className={`rs-card${done ? ' done' : ''}${overId === id && dragId && dragId !== id ? ' over' : ''}`}
              draggable={!done}
              onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
              onDragOver={(e) => { if (dragId && !done) { e.preventDefault(); setOverId(id); } }}
              onDrop={(e) => { e.preventDefault(); if (dragId && !done) mutate((p) => moveReel(p, stackId, dragId, id)); setDragId(null); setOverId(null); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              <button
                className={`rs-check${done ? ' on' : ''}`} aria-pressed={done}
                aria-label={done ? 'Marcar como no publicado' : 'Marcar como publicado'}
                onClick={() => mutate((p) => togglePosted(p, stackId, id))}
              >{done && <Check size={11} />}</button>
              <button className="rs-body" onClick={() => openReel({ stackId, reel: id })} title="Ver guion, textos y notas">
                <span className="rs-meta">{i + 1} · {dayLabel(slotDate(stack, i))}{r.draft ? ' · borrador' : ''}</span>
                <span className="rs-name">{r.short || r.hook || r.title}</span>
              </button>
              {!done && (
                <span className="rs-tools">
                  <button aria-label="Subir" onClick={() => mutate((p) => nudgeReel(p, stackId, id, -1))}><ArrowUp size={12} /></button>
                  <button aria-label="Bajar" onClick={() => mutate((p) => nudgeReel(p, stackId, id, 1))}><ArrowDown size={12} /></button>
                  <span className="rs-grip" aria-hidden="true"><GripVertical size={12} /></span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <form
        className="rs-add"
        onSubmit={(e) => {
          e.preventDefault();
          // The id is made here so the script panel can open on the Reel that was just added.
          const out = addReel(plan, stackId, newName);
          if (!out.id) return;
          mutate(() => out.plan);
          setNewName('');
          openReel({ stackId, reel: out.id });
        }}
      >
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ Nuevo Reel: ponle un nombre" aria-label="Nombre del nuevo Reel" />
        <button type="submit" aria-label="Añadir Reel">Añadir</button>
      </form>
    </div>
  );
}

export function ReelStack({ plan, onChange }) {
  const stacks = plan && plan.stacks ? Object.keys(plan.stacks) : [];
  if (!stacks.length || !onChange) return null;
  return <>{stacks.map((id) => <Stack key={id} plan={plan} stackId={id} onChange={onChange} />)}</>;
}
