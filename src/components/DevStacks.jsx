import React, { useState } from 'react';
import { Check, X, Plus, ChevronUp } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { AREA_COLORS, dayLabel, isoOf } from '../lib/areaPlan';
import { DEV_ROLES, devStacks, addDevStack, addDevSlot, editDevItem, moveDevStack, removeDevItem } from '../lib/devStacks';
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
  const mutate = (fn) => onChange((p) => fn(p));
  const area = plan.areas.find((a) => a.id === areaId);
  const color = area ? AREA_COLORS[area.c % AREA_COLORS.length] : AREA_COLORS[0];
  const stacks = devStacks(plan, areaId);
  const pick = (v) => { setAreaId(v); try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } };

  // Plain render helper (not a component) so typing in a note never remounts the field.
  const card = (it, role) => (
    <div key={it.id} className={`rr-reel ds-card${it.done ? ' done' : ''}${open === it.id ? ' open' : ''}`} style={{ '--c': color }}>
      <button className={`rs-check${it.done ? ' on' : ''}`} aria-pressed={it.done} aria-label={it.done ? 'Marcar como pendiente' : 'Marcar como hecho'}
        onClick={() => mutate((p) => editDevItem(p, it.id, { done: !it.done }))}>{it.done && <Check size={11} />}</button>
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
          {firstLine(it.note) && <span className="rs-snip">{firstLine(it.note)}</span>}
        </button>
      )}
      <button className="rr-x" aria-label={role === 'build' ? 'Quitar el stack' : 'Quitar'} title={role === 'build' ? 'Quitar el stack entero' : 'Quitar'}
        onClick={() => { if (role !== 'build' || window.confirm('¿Quitar el stack completo?')) mutate((p) => removeDevItem(p, it.id)); }}><X size={12} /></button>
    </div>
  );

  const slot = (st, role) => {
    const it = role === 'build' ? st.main : st[role];
    const label = DEV_ROLES.find((r) => r.role === role).label;
    return (
      <div key={role} className="rr-slot">
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
                  <input className="ds-date" type="date" value={/^\d{4}/.test(st.main.day || '') ? st.main.day : ''} aria-label="Día del stack"
                    onChange={(e) => e.target.value && mutate((p) => moveDevStack(p, st.id, e.target.value))} />
                </div>
              </React.Fragment>
            );
          })}
          <form className="rs-add rr-newreel" style={{ '--c': color }} onSubmit={(e) => {
            e.preventDefault();
            const out = addDevStack(plan, { area: areaId, name, day });
            if (!out.id) return;
            mutate(() => out.plan); setName(''); setOpen(out.id);
          }}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="+ Nueva feature: ponle un nombre" aria-label="Nombre de la nueva feature" />
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Día" />
            <button type="submit">Añadir stack</button>
          </form>
        </div>
      </div>
    </div>
  );
}
