import React, { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical, Check } from 'lucide-react';
import { AREA_COLORS, dayLabel } from '../lib/areaPlan';
import { slotDate, moveReel, nudgeReel, togglePosted, reelText, openReel, addReel, setCadence, kindOf, KIND_LABEL } from '../lib/contentPlan';
import './ReelStack.css';

// The next posts to publish, in order. Each position has a date, so reordering the
// list moves the blocks in the calendar. Posted ones keep their slot.
const DOW = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const NEW_LABEL = { reel: '+ Nuevo Reel', story: '+ Nueva Story', post: '+ Nuevo Post' };
const firstLine = (t = '') => t.split('\n')[0];

// `column` is the Social Media page: wider cards with a snippet of the text and the publishing days.
export function Stack({ plan, stackId, onChange, column }) {
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
  const kind = kindOf(stack);
  const toggleDay = (d) => {
    const days = stack.weekdays.includes(d) ? stack.weekdays.filter((x) => x !== d) : [...stack.weekdays, d];
    if (days.length) mutate((p) => setCadence(p, stackId, { weekdays: days.sort((a, b) => a - b) }));
  };

  return (
    <div className={`rs${column ? ' rs-col' : ''}`} style={{ '--c': color }}>
      <div className="rs-head">
        <span className="rs-title"><i />{stack.title} · {area ? area.name : ''}</span>
        <span className="rs-count">{pending} por publicar</span>
      </div>
      {column && (
        <div className="rs-cad">
          <span className="rs-days" role="group" aria-label="Días de publicación">
            {DOW.map(([d, l]) => <button key={d} aria-pressed={stack.weekdays.includes(d)} onClick={() => toggleDay(d)}>{l}</button>)}
          </span>
          <input
            type="time" value={stack.at || ''} aria-label="Hora de publicación"
            onChange={(e) => mutate((p) => setCadence(p, stackId, { at: e.target.value }))}
          />
          {stack.at && <button className="rs-notime" onClick={() => mutate((p) => setCadence(p, stackId, { at: '' }))} title="Sin hora fija">sin hora</button>}
        </div>
      )}
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
                {column && firstLine(r.script) && <span className="rs-snip">{firstLine(r.script)}</span>}
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
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`${NEW_LABEL[kind]}: ponle un nombre`} aria-label={`Nombre ${kind === 'story' ? 'de la nueva' : 'del nuevo'} ${KIND_LABEL[kind]}`} />
        <button type="submit" aria-label={`Añadir ${KIND_LABEL[kind]}`}>Añadir</button>
      </form>
    </div>
  );
}

export function ReelStack({ plan, onChange }) {
  // The left panel only carries the Reels; Stories and Posts live in the Social Media page.
  const stacks = plan && plan.stacks ? Object.keys(plan.stacks).filter((id) => kindOf(plan.stacks[id]) === 'reel') : [];
  if (!stacks.length || !onChange) return null;
  return <>{stacks.map((id) => <Stack key={id} plan={plan} stackId={id} onChange={onChange} />)}</>;
}
