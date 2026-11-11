import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Check, X, Plus } from 'lucide-react';
import { AREA_COLORS, dayLabel } from '../lib/areaPlan';
import {
  baseStackIds, stackOfKind, linkedStory, linkStory, unlinkStory, addLinkedStory, addReel, createStack,
  moveReel, nudgeReel, togglePosted, reelText, openReel
} from '../lib/contentPlan';

const firstLine = (t = '') => t.split('\n')[0];

// One row per Reel: [pre-story] [Reel] [after-story]. Stories without a Reel wait in the backlog on
// the left; drag them into a slot. A linked Story follows its Reel's date (day before / day after).
export function ReelRows({ plan, onChange }) {
  const [drag, setDrag] = useState(null); // { type: 'story' | 'reel', id }
  const [over, setOver] = useState(null);
  const [newName, setNewName] = useState('');
  const mutate = (fn) => onChange((p) => fn(p));

  const reelStackId = baseStackIds(plan)[0];
  const reelStack = reelStackId && plan.stacks[reelStackId];
  const stories = stackOfKind(plan, 'story');
  const colorOf = (st) => {
    const a = plan.areas.find((x) => x.id === st.area);
    return a ? AREA_COLORS[a.c % AREA_COLORS.length] : AREA_COLORS[0];
  };
  const itemOf = (sid, id) => plan.items.find((i) => i.id === `${sid}:reel:${id}`);
  const doneOf = (sid, id) => !!(itemOf(sid, id) && itemOf(sid, id).done);

  if (!reelStack) {
    return <div className="rr-empty">Importa un plan de contenido con Reels para verlos aquí con sus stories.</div>;
  }

  const loose = stories ? stories.stack.order.filter((id) => stories.stack.reels[id] && !stories.stack.reels[id].link) : [];
  const reelIds = reelStack.order.filter((id) => reelStack.reels[id]);
  const dropOnSlot = (reelId, role) => {
    if (drag && drag.type === 'story' && stories) mutate((p) => linkStory(p, stories.id, drag.id, reelStackId, reelId, role));
    setDrag(null); setOver(null);
  };

  // Plain render helpers (not components): a component defined here would remount on every state
  // change and cancel a drag in progress.
  const storyCard = (id, onRemove) => {
    const r = reelText(stories.stack.reels[id]);
    const it = itemOf(stories.id, id);
    const done = doneOf(stories.id, id);
    return (
      <div
        key={id}
        className={`rr-story${done ? ' done' : ''}`} style={{ '--c': colorOf(stories.stack) }}
        draggable={!done}
        onDragStart={(e) => { setDrag({ type: 'story', id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
      >
        <button
          className={`rs-check${done ? ' on' : ''}`} aria-pressed={done}
          aria-label={done ? 'Marcar como no publicada' : 'Marcar como publicada'}
          onClick={() => mutate((p) => togglePosted(p, stories.id, id))}
        >{done && <Check size={11} />}</button>
        <button className="rr-open" onClick={() => openReel({ stackId: stories.id, reel: id })} title="Abrir y editar">
          <span className="rs-meta">{it ? dayLabel(it.day) : ''}</span>
          <span className="rs-name">{r.short || r.title}</span>
          {firstLine(r.script) && <span className="rs-snip">{firstLine(r.script)}</span>}
        </button>
        {onRemove && <button className="rr-x" aria-label="Quitar del Reel" title="Quitar del Reel (vuelve a las sueltas)" onClick={onRemove}><X size={12} /></button>}
      </div>
    );
  };

  const slot = (reelId, role) => {
    const hit = stories && linkedStory(plan, reelStackId, reelId, role);
    const key = `${reelId}:${role}`;
    const label = role === 'pre' ? 'Pre-story' : 'After-story';
    return (
      <div
        key={role}
        className={`rr-slot${over === key && drag && drag.type === 'story' ? ' over' : ''}`}
        onDragOver={(e) => { if (drag && drag.type === 'story') { e.preventDefault(); setOver(key); } }}
        onDragLeave={() => setOver((o) => (o === key ? null : o))}
        onDrop={(e) => { e.preventDefault(); dropOnSlot(reelId, role); }}
      >
        <span className="rr-label">{label}</span>
        {hit ? (
          storyCard(hit.id, () => mutate((p) => unlinkStory(p, hit.stackId, hit.id)))
        ) : (
          <button
            className="rr-add"
            onClick={() => {
              const out = addLinkedStory(plan, reelStackId, reelId, role);
              mutate(() => out.plan);
              openReel({ stackId: out.stackId, reel: out.id });
            }}
          ><Plus size={12} /> {label}</button>
        )}
      </div>
    );
  };

  return (
    <div className="rr">
      <aside
        className={`rr-backlog${over === 'backlog' && drag && drag.type === 'story' ? ' over' : ''}`}
        style={stories ? { '--c': colorOf(stories.stack) } : undefined}
        onDragOver={(e) => { if (drag && drag.type === 'story') { e.preventDefault(); setOver('backlog'); } }}
        onDragLeave={() => setOver((o) => (o === 'backlog' ? null : o))}
        onDrop={(e) => { e.preventDefault(); if (drag && drag.type === 'story' && stories) mutate((p) => unlinkStory(p, stories.id, drag.id)); setDrag(null); setOver(null); }}
      >
        <h3 className="rr-h">Stories sin Reel <span>{loose.length}</span></h3>
        <p className="rr-hint">Arrástralas al hueco de un Reel. Las que no tengan Reel salen según su propio ritmo.</p>
        <div className="rr-loose">
          {stories ? loose.map((id) => storyCard(id)) : (
            <button className="ap-btn" onClick={() => mutate((p) => createStack(p, 'story'))}>Crear columna de Stories</button>
          )}
        </div>
        {stories && (
          <form
            className="rs-add"
            onSubmit={(e) => {
              e.preventDefault();
              const out = addReel(plan, stories.id, newName);
              if (!out.id) return;
              mutate(() => out.plan); setNewName('');
              openReel({ stackId: stories.id, reel: out.id });
            }}
          >
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ Nueva Story suelta" aria-label="Nombre de la nueva Story" />
            <button type="submit">Añadir</button>
          </form>
        )}
      </aside>

      <div className="rr-rows">
        <div className="rr-head" aria-hidden="true"><span>Pre-story</span><span>Reel</span><span>After-story</span></div>
        {reelIds.map((id, i) => {
          const r = reelText(reelStack.reels[id]);
          const it = itemOf(reelStackId, id);
          const done = doneOf(reelStackId, id);
          return (
            <div
              key={id}
              className={`rr-row${over === `row:${id}` && drag && drag.type === 'reel' && drag.id !== id ? ' over' : ''}`}
              style={{ '--c': colorOf(reelStack) }}
              onDragOver={(e) => { if (drag && drag.type === 'reel' && !done) { e.preventDefault(); setOver(`row:${id}`); } }}
              onDrop={(e) => { e.preventDefault(); if (drag && drag.type === 'reel' && !done) mutate((p) => moveReel(p, reelStackId, drag.id, id)); setDrag(null); setOver(null); }}
            >
              {slot(id, 'pre')}
              <div
                className={`rr-reel${done ? ' done' : ''}`}
                draggable={!done}
                onDragStart={(e) => { setDrag({ type: 'reel', id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
              >
                <button
                  className={`rs-check${done ? ' on' : ''}`} aria-pressed={done}
                  aria-label={done ? 'Marcar como no publicado' : 'Marcar como publicado'}
                  onClick={() => mutate((p) => togglePosted(p, reelStackId, id))}
                >{done && <Check size={11} />}</button>
                <button className="rr-open" onClick={() => openReel({ stackId: reelStackId, reel: id })} title="Ver guion, textos y notas">
                  <span className="rs-meta">{i + 1} · {it ? dayLabel(it.day) : ''}{r.draft ? ' · borrador' : ''}</span>
                  <span className="rs-name">{r.short || r.hook || r.title}</span>
                  {firstLine(r.script) && <span className="rs-snip">{firstLine(r.script)}</span>}
                </button>
                {!done && (
                  <span className="rs-tools">
                    <button aria-label="Subir" onClick={() => mutate((p) => nudgeReel(p, reelStackId, id, -1))}><ArrowUp size={12} /></button>
                    <button aria-label="Bajar" onClick={() => mutate((p) => nudgeReel(p, reelStackId, id, 1))}><ArrowDown size={12} /></button>
                  </span>
                )}
              </div>
              {slot(id, 'post')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
