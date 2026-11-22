import React, { useState, useEffect } from 'react';
import { Check, X, Plus, ChevronUp, ArrowUp, ArrowDown, Rocket } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { AREA_COLORS, dayLabel, isoOf, fmtMin } from '../lib/areaPlan';
import { DEV_ROLES, devStacks, addDevStack, addDevSlot, editDevItem, moveDevStack, removeDevItem, migrateToDev, needsReview, isValidated, toggleDevDone, setDevValid, stackSettled, reportOf, dropDev, detachDev, nudgeDevStack, setDevTime, setDevLaunch } from '../lib/devStacks';
import './SocialManager.css';
import './DevStacks.css';

const KEY = 'el_boceto_dev_area_v1';
const firstLine = (t = '') => t.split('\n')[0];

// Development stacks: a row per feature (Plan · Desarrollo · Verificación), several rows per day, each piece with its own text
// and comments. Pieces are plan blocks, so they also appear in the calendars.
export function DevStacks({ plan, onChange, onBack, compact, tab, onTabChange }) {
  const [areaId, setAreaId] = useState(() => {
    let saved = '';
    try { saved = localStorage.getItem(KEY) || ''; } catch { /* storage unavailable */ }
    return plan.areas.some((a) => a.id === saved) ? saved : ((plan.areas.find((a) => /medilyft/i.test(a.name)) || plan.areas[0] || {}).id || '');
  });
  const [open, setOpen] = useState(null); // id of the piece being edited
  const [name, setName] = useState('');
  const [day, setDay] = useState(() => isoOf(new Date()));
  const [time, setTime] = useState('');
  const [auto, setAuto] = useState(true); // default tick: start by itself when it has a day and a time
  const [drag, setDrag] = useState(null); // id of the piece being dragged
  const [over, setOver] = useState(null);
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false); // also the stacks that are done and validated
  const mutate = (fn) => onChange((p) => fn(p));
  // The tasks the area already has become stacks (once; running again changes nothing).
  useEffect(() => { if (areaId && migrateToDev(plan, areaId) !== plan) onChange((p) => migrateToDev(p, areaId)); }, [plan, areaId, onChange]);
  const area = plan.areas.find((a) => a.id === areaId);
  const color = area ? AREA_COLORS[area.c % AREA_COLORS.length] : AREA_COLORS[0];
  const all = devStacks(plan, areaId);
  const stacks = showAll ? all : all.filter((st) => !stackSettled(st));
  const toReview = plan.items.filter((i) => i.area === areaId && needsReview(i)).length;
  const pick = (v) => { setAreaId(v); try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } };

  // Plain render helper (not a component) so typing in a note never remounts the field.
  const card = (it, role) => (
    <div key={it.id} className={`rr-reel ds-card${it.done ? ' done' : ''}${needsReview(it) ? ' review' : ''}${isValidated(it) ? ' valid' : ''}${open === it.id ? ' open' : ''}`} style={{ '--c': color }}
      draggable={open !== it.id && !it.done}
      onDragStart={(e) => { setDrag(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); }}
      onDragEnd={() => { setDrag(null); setOver(null); }}>
      <button className={`rs-check${it.done ? ' on' : ''}`} aria-pressed={it.done} aria-label={it.done ? 'Marcar como pendiente' : 'Marcar como hecho'}
        onClick={() => mutate((p) => toggleDevDone(p, it.id))}>{it.done && <Check size={11} />}</button>
      {open === it.id ? (
        <div className="ds-edit">
          <input className="ds-title" value={it.text} aria-label="Título" onChange={(e) => mutate((p) => editDevItem(p, it.id, { text: e.target.value }))} />
          <textarea className="ds-note" rows={4} value={it.note || ''} placeholder="Comentarios, decisiones, enlaces, qué falta…" aria-label="Comentarios"
            onChange={(e) => mutate((p) => editDevItem(p, it.id, { note: e.target.value }))} />
          <button className="ap-btn" onClick={() => setOpen(null)}>Listo</button>
        </div>
      ) : (
        <button className="rr-open" onClick={() => setOpen(it.id)} title="Editar texto y comentarios">
          <span className="rs-name">{it.text}</span>
          {needsReview(it) && <span className="ds-badge">Terminado · por validar</span>}
          {!needsReview(it) && firstLine(it.note) && <span className="rs-snip">{firstLine(it.note)}</span>}
        </button>
      )}
      {needsReview(it) && open !== it.id && (
        <div className="ds-review">
          {reportOf(plan, it.id) && <details><summary>Qué dijo al terminar</summary><p>{reportOf(plan, it.id)}</p></details>}
          <button className="ap-btn ds-ok" onClick={() => mutate((p) => setDevValid(p, it.id, true))}>Validar ✓</button>
        </div>
      )}
      {isValidated(it) && open !== it.id && <button className="ds-undo" title="Volver a revisar" onClick={() => mutate((p) => setDevValid(p, it.id, false))}>↺</button>}
      <button className="rr-x" aria-label={role === 'build' ? 'Quitar el stack' : 'Quitar'} title={role === 'build' ? 'Quitar el stack entero' : 'Quitar'}
        onClick={() => { if (role !== 'build' || window.confirm('¿Quitar el stack completo?')) mutate((p) => removeDevItem(p, it.id)); }}><X size={12} /></button>
    </div>
  );

  const slot = (st, role) => {
    const it = role === 'build' ? st.main : st[role];
    const label = DEV_ROLES.find((r) => r.role === role).label;
    return (
      <div key={role} className={`rr-slot${over === `${st.id}:${role}` && drag ? ' over' : ''}`}
        onDragOver={(e) => { if (drag && !it && role !== 'build') { e.preventDefault(); setOver(`${st.id}:${role}`); } }}
        onDragLeave={() => setOver((o) => (o === `${st.id}:${role}` ? null : o))}
        onDrop={(e) => { e.preventDefault(); if (drag && !it && role !== 'build') { const out = dropDev(plan, drag, st.id, role); if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); } } setDrag(null); setOver(null); }}>
        <span className="rr-label">{label}</span>
        {it ? card(it, role) : (
          <button className="rr-add" style={{ '--c': color }} onClick={() => {
            const out = addDevSlot(plan, st.id, role);
            mutate(() => out.plan);
            if (out.id) setOpen(out.id);
          }}><Plus size={12} /> {label}</button>
        )}
      </div>
    );
  };

  let lastDay = null;
  return (
    <div className={`ap-root sm-root${compact ? ' compact' : ''}`}>
      <div className="ap-head">
        <h1 className="font-title">Desarrollo</h1>
        <span className="ap-sub">plan · desarrollo · verificación</span>
        {onBack && <button className="ap-btn ap-back" onClick={onBack}><ChevronUp size={12} style={{ verticalAlign: '-2px' }} /> Lienzo</button>}
      </div>
      <div className="ap-filters">
        {onTabChange && <PlanTabs value={tab} onChange={onTabChange} />}
        {toReview > 0 && <span className="ds-count">{toReview} por validar</span>}
        <label className="ds-auto"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Mostrar validados</label>
        <select className="ds-area" value={areaId} onChange={(e) => pick(e.target.value)} aria-label="Área">
          {plan.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="sm-wrap">
        <div className="rr-rows ds-rows">
          <div className="rr-head" aria-hidden="true">{DEV_ROLES.map((r) => <span key={r.role}>{r.label}</span>)}</div>
          {!stacks.length && <div className="rr-empty">Aún no hay stacks de {area ? area.name : 'esta área'}. Crea el primero abajo: una feature con su plan y su verificación.</div>}
          {stacks.map((st) => {
            const head = st.main.day !== lastDay;
            lastDay = st.main.day;
            return (
              <React.Fragment key={st.id}>
                {head && <h3 className="ds-day">{/^\d{4}/.test(st.main.day || '') ? dayLabel(st.main.day) : 'Sin día'}</h3>}
                <div className="rr-row" style={{ '--c': color }}>
                  {slot(st, 'plan')}
                  {slot(st, 'build')}
                  {slot(st, 'check')}
                  <div className="ds-foot">
                    <input className="ds-date" type="date" value={/^\d{4}/.test(st.main.day || '') ? st.main.day : ''} aria-label="Día del stack"
                      onChange={(e) => e.target.value && mutate((p) => moveDevStack(p, st.id, e.target.value))} />
                    <input className="ds-date" type="time" value={typeof st.main.at === 'number' ? fmtMin(st.main.at) : ''} aria-label="Hora de inicio"
                      onChange={(e) => { const [h, m] = (e.target.value || '').split(':').map(Number); mutate((p) => { const t = setDevTime(p, st.id, Number.isFinite(h) ? h * 60 + m : null); return st.main.iris && st.main.iris.launch && !Number.isFinite(h) ? setDevLaunch(t, st.id, false) : t; }); }} />
                    <label className="ds-auto" title="La conversación del área empieza sola a esa hora con este encargo (varios seguidos de noche van en un lote)">
                      <input type="checkbox" checked={!!(st.main.iris && st.main.iris.launch)} disabled={typeof st.main.at !== 'number' || !/^\d{4}/.test(st.main.day || '')}
                        onChange={(e) => mutate((p) => setDevLaunch(p, st.id, e.target.checked))} />
                      <Rocket size={11} /> Lanzar solo{st.main.iris && st.main.iris.launch ? ` · ${({ pending: 'pendiente', launched: 'lanzado', missed: 'perdido', skipped: 'omitido' })[st.main.iris.state] || ''}` : ''}
                    </label>
                    <span className="ds-move">
                      <button aria-label="Subir" onClick={() => mutate((p) => nudgeDevStack(p, st.id, -1))}><ArrowUp size={12} /></button>
                      <button aria-label="Bajar" onClick={() => mutate((p) => nudgeDevStack(p, st.id, 1))}><ArrowDown size={12} /></button>
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {msg && <div className="ds-msg" role="status">{msg}</div>}
          {drag && (
            <div className={`ds-own${over === 'own' ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver('own'); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); mutate((p) => detachDev(p, drag)); setDrag(null); setOver(null); }}>
              Suelta aquí para dejarlo como stack propio
            </div>
          )}
          <form className="rs-add rr-newreel" style={{ '--c': color }} onSubmit={(e) => {
            e.preventDefault();
            const out = addDevStack(plan, { area: areaId, name, day });
            if (!out.id) return;
            const [h, m] = (time || '').split(':').map(Number);
            let next = Number.isFinite(h) ? setDevTime(out.plan, out.id, h * 60 + m) : out.plan;
            if (auto) next = setDevLaunch(next, out.id, true);
            mutate(() => next); setName(''); setOpen(out.id);
          }}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="+ Nueva feature: ponle un nombre" aria-label="Nombre de la nueva feature" />
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Día" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora de inicio (opcional)" />
            <label className="ds-auto"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> <Rocket size={11} /> Lanzar solo</label>
            <button type="submit">Añadir stack</button>
          </form>
        </div>
      </div>
    </div>
  );
}
