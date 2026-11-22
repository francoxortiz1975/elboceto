import React, { useState, useEffect } from 'react';
import { Check, X, Plus, ChevronUp, ArrowUp, ArrowDown, Rocket } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { codeConfig, codeOf, assignCode, addModification, suggestModule, bulkAssign } from '../lib/devCodes';
import { AREA_COLORS, dayLabel, isoOf, addDays, fmtMin } from '../lib/areaPlan';
import { DEV_ROLES, devStacks, addDevStack, addDevSlot, editDevItem, moveDevStack, removeDevItem, migrateToDev, needsReview, needsDeploy, isValidated, toggleDevDone, setDevValid, stackVisible, reportOf, parseReport, dropDev, detachDev, nudgeDevStack, setDevTime, setDevLaunch, setDevBatch, unbatch, batchStatus, addToBatch, ticketStatus, launchNow, setNoDeploy, requestDeploy, applyDeploys } from '../lib/devStacks';
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
  const [newMod, setNewMod] = useState('');
  const [auto, setAuto] = useState(true); // default tick: start by itself when it has a day and a time
  const [drag, setDrag] = useState(null); // id of the piece being dragged
  const [over, setOver] = useState(null);
  const [msg, setMsg] = useState('');
  const [pick2, setPick2] = useState([]); // stacks chosen for a batch, in the order they were ticked
  const [bDay, setBDay] = useState(() => addDays(isoOf(new Date()), 1));
  const [bTime, setBTime] = useState('22:00');
  const [reviewId, setReviewId] = useState(null); // piece whose final report is open in the reader
  const [mode, setMode] = useState(() => { try { const m = localStorage.getItem('el_boceto_dev_mode_v1'); return m === 'deploy' || m === 'all' ? m : 'work'; } catch { return 'work'; } });
  const setView = (m) => { setMode(m); try { localStorage.setItem('el_boceto_dev_mode_v1', m); } catch { /* storage unavailable */ } };
  const mutate = (fn) => onChange((p) => fn(p));
  // A finished "subir a main" block marks its feature as deployed.
  useEffect(() => { if (applyDeploys(plan) !== plan) onChange((p) => applyDeploys(p)); }, [plan, onChange]);
  // The tasks the area already has become stacks (once; running again changes nothing).
  useEffect(() => { if (areaId && migrateToDev(plan, areaId) !== plan) onChange((p) => migrateToDev(p, areaId)); }, [plan, areaId, onChange]);
  const area = plan.areas.find((a) => a.id === areaId);
  const color = area ? AREA_COLORS[area.c % AREA_COLORS.length] : AREA_COLORS[0];
  const all = devStacks(plan, areaId);
  const stacks = all.filter((st) => stackVisible(plan, st, mode));
  const toDeploy = all.filter((st) => stackVisible(plan, st, 'deploy'));
  const cfg = codeConfig(plan, areaId);
  const uncoded = cfg ? all.filter((st) => !codeOf(st.main) && suggestModule(st.main.text, areaId, plan)).length : 0;
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
          <span className="rs-name">{codeOf(it) && <b className="ds-code">{codeOf(it)}</b>}{it.text}</span>
          {needsReview(it) && <span className="ds-badge">Terminado · por validar</span>}
          {!needsReview(it) && firstLine(it.note) && <span className="rs-snip">{firstLine(it.note)}</span>}
        </button>
      )}
      {needsReview(it) && open !== it.id && (
        <div className="ds-review">
          {reportOf(plan, it.id) ? <button className="ds-read" onClick={() => setReviewId(it.id)}><span>{parseReport(reportOf(plan, it.id)).summary || 'Ver el informe'}</span> <b>Revisar ›</b></button> : <span className="ds-hint">Sin informe del agente</span>}
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

  const rowOf = (st) => (
        <div className="rr-row" style={{ '--c': color }}>
          {slot(st, 'plan')}
          {slot(st, 'build')}
          {slot(st, 'check')}
          <div className="ds-foot">
            {(() => {
              const ts = ticketStatus(plan, st);
              const schedule = () => {
                const t = window.prompt('¿A qué hora debe empezar? (HH:MM)', '22:00');
                const mm = /^(\d{1,2}):(\d{2})$/.exec(t || '');
                if (!mm) return;
                const d = /^\d{4}-/.test(st.main.day || '') ? st.main.day : addDays(isoOf(new Date()), 1);
                mutate((p) => setDevLaunch(setDevTime(moveDevStack(p, st.id, d), st.id, Number(mm[1]) * 60 + Number(mm[2])), st.id, true));
              };
              const deploy = () => {
                if (!window.confirm(`Subir ${st.main.dev.code || st.main.text} a main?\n\nLa conversación del área hará merge de su rama a main, push y comprobará el despliegue en producción. Se lanza ahora, solo para esto.`)) return;
                const out = requestDeploy(plan, st.id);
                if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); }
              };
              return (
                <>
                  <span className={`ds-status ${ts.key}`}>{ts.label}</span>
                  {ts.action === 'schedule' && <button className="ds-act" onClick={schedule}>Agendar</button>}
                  {ts.action === 'now' && <button className="ds-act" onClick={() => mutate((p) => launchNow(p, st.id))}>Lanzar ahora</button>}
                  {ts.action === 'validate' && <button className="ds-act" onClick={() => setReviewId(st.id)}>Revisar y validar</button>}
                  {(ts.action === 'deploy' || ts.action === 'retry') && <button className="ds-act deploy" onClick={deploy}>{ts.action === 'retry' ? 'Reintentar subida a main' : 'Subir a main'}</button>}
                  {ts.action === 'deploy' && <button className="ds-modbtn" title="Este ticket no necesita deploy (sale de la vista)" onClick={() => mutate((p) => setNoDeploy(p, st.id))}>Sin deploy</button>}
                </>
              );
            })()}
            {cfg && (
              <select className="ds-mod" value={st.main.dev.mod || ''} disabled={!!codeOf(st.main)} aria-label="Módulo del ticket"
                title={codeOf(st.main) ? 'El código no cambia' : 'Elige el módulo: se le asigna su código'}
                onChange={(e) => { if (!e.target.value) return; const out = assignCode(plan, st.id, e.target.value); if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); } }}>
                <option value="">{suggestModule(st.main.text, areaId, plan) ? `Sin código · sugerido ${suggestModule(st.main.text, areaId, plan)}` : 'Sin código'}</option>
                {Object.entries(cfg.modules).map(([k, label]) => <option key={k} value={k}>{k} · {label}</option>)}
              </select>
            )}
            {codeOf(st.main) && (
              <button className="ds-modbtn" title="Crea una modificación de esta feature (código .1, .2…)" onClick={() => {
                const name = window.prompt(`Modificación de ${codeOf(st.main)}: ¿qué cambia?`);
                if (!name) return;
                const out = addModification(plan, st.id, name, { day: st.main.day });
                if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); }
              }}>+ Modificación</button>
            )}
            <input className="ds-date" type="date" value={/^\d{4}/.test(st.main.day || '') ? st.main.day : ''} aria-label="Día del stack"
              onChange={(e) => e.target.value && mutate((p) => moveDevStack(p, st.id, e.target.value))} />
            <input className="ds-date" type="time" value={typeof st.main.at === 'number' ? fmtMin(st.main.at) : ''} aria-label="Hora de inicio"
              onChange={(e) => { const [h, m] = (e.target.value || '').split(':').map(Number); mutate((p) => { const t = setDevTime(p, st.id, Number.isFinite(h) ? h * 60 + m : null); return st.main.iris && st.main.iris.launch && !Number.isFinite(h) ? setDevLaunch(t, st.id, false) : t; }); }} />
            {!st.main.done && !(st.main.iris && (st.main.iris.state === 'launched' || st.main.iris.batch)) && (
              <label className="ds-auto" title="Márcalo junto a otras features para lanzarlas en un solo lote">
                <input type="checkbox" checked={pick2.includes(st.id)} onChange={(e) => setPick2((l) => (e.target.checked ? [...l, st.id] : l.filter((x) => x !== st.id)))} /> Lote{pick2.includes(st.id) ? ` ${pick2.indexOf(st.id) + 1}` : ''}
              </label>
            )}
            <label className="ds-auto" title="La conversación del área empieza sola a esa hora con este encargo (varios seguidos de noche van en un lote)">
              <input type="checkbox" checked={!!(st.main.iris && st.main.iris.launch)} disabled={typeof st.main.at !== 'number' || !/^\d{4}/.test(st.main.day || '')}
                onChange={(e) => mutate((p) => setDevLaunch(p, st.id, e.target.checked))} />
              <Rocket size={11} /> Lanzar solo{st.main.iris && st.main.iris.launch ? ` · ${(st.main.iris.state === 'launched' && st.main.iris.ended ? 'ejecución terminada' : ({ pending: 'pendiente', launched: 'lanzado', missed: 'perdido', skipped: 'omitido' })[st.main.iris.state]) || ''}` : ''}
            </label>
            <span className="ds-move">
              <button aria-label="Subir" onClick={() => mutate((p) => nudgeDevStack(p, st.id, -1))}><ArrowUp size={12} /></button>
              <button aria-label="Bajar" onClick={() => mutate((p) => nudgeDevStack(p, st.id, 1))}><ArrowDown size={12} /></button>
            </span>
          </div>
        </div>
  );

  // A batch shows as one group (header + its features in the order they run); a lone stack is a plain row.
  const entries = [];
  const seenBatch = new Set();
  stacks.forEach((st) => {
    const b = st.main.iris && st.main.iris.launch && st.main.iris.batch;
    if (!b) { entries.push({ id: st.id, day: st.main.day, st }); return; }
    if (seenBatch.has(b)) return;
    seenBatch.add(b);
    // the batch is counted with ALL its features (a validated one leaves the view but is still part of it)
    const sts = all.filter((x) => x.main.iris && x.main.iris.batch === b && x.main.iris.launch).sort((x, y) => (x.main.at || 0) - (y.main.at || 0));
    entries.push({ id: `batch:${b}`, day: sts[0].main.day, batch: b, sts, shown: sts.filter((x) => stacks.includes(x)) });
  });
  const batchHead = (e) => {
    const lead = e.sts[0].main;
    const status = batchStatus(e.sts);
    const canAdd = status.key === 'pending' && pick2.filter((id) => !e.sts.some((x) => x.id === id)).length > 0;
    return (
      <div className="ds-bhead">
        <strong>Lote</strong>
        <span className={`ds-bstate ${status.key}`}>{e.sts.length} features{e.shown.length < e.sts.length ? ` (${e.sts.length - e.shown.length} validada${e.sts.length - e.shown.length === 1 ? '' : 's'}, oculta${e.sts.length - e.shown.length === 1 ? '' : 's'})` : ''} · una sola conversación · empieza a las {typeof lead.at === 'number' ? fmtMin(lead.at) : '--:--'} · {status.label}</span>
        {canAdd && <button className="ap-btn" onClick={() => { const out = addToBatch(plan, e.batch, pick2); if (out.error) { setMsg(out.error); return; } setMsg(''); mutate(() => out.plan); setPick2([]); }}>Añadir las {pick2.filter((id) => !e.sts.some((x) => x.id === id)).length} marcadas</button>}
        <button className="ap-btn" title="Cada feature vuelve a lanzarse sola a su propia hora" onClick={() => mutate((p) => unbatch(p, e.batch))}>Deshacer lote</button>
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
        {uncoded > 0 && <button className="ap-btn" title="Asigna a cada stack el código del módulo que sugiero por su título. Los que no sé clasificar quedan para ti." onClick={() => { if (window.confirm(`Asignar código a ${uncoded} stacks según el módulo sugerido por su título?\nLos códigos no cambian después.`)) mutate((p) => bulkAssign(p, areaId).plan); }}>Asignar {uncoded} códigos sugeridos</button>}
        {toReview > 0 && <span className="ds-count">{toReview} por validar</span>}
        <div className="ap-seg ds-modes" role="group" aria-label="Qué mostrar">
          <button aria-pressed={mode === 'work'} onClick={() => setView('work')} title="Lo que aún no está validado">Pendientes</button>
          <button aria-pressed={mode === 'deploy'} onClick={() => setView('deploy')} title="Validado, falta subir su rama a main">Por subir a main{toDeploy.length ? ` · ${toDeploy.length}` : ''}</button>
          <button aria-pressed={mode === 'all'} onClick={() => setView('all')} title="Todo, también lo validado y lo ya deployado">Todo</button>
        </div>
        {mode === 'deploy' && toDeploy.some((st) => needsDeploy(st.main)) && <button className="ap-btn" title="Marca todos estos como que no necesitan subir a main (salen de esta lista)" onClick={() => { if (window.confirm(`Marcar ${toDeploy.filter((st) => needsDeploy(st.main)).length} tickets como "sin deploy"?\nSalen de esta lista; no se sube nada.`)) mutate((p) => toDeploy.reduce((acc, st) => (needsDeploy(st.main) ? setNoDeploy(acc, st.id) : acc), p)); }}>Todos «sin deploy»</button>}
        <select className="ds-area" value={areaId} onChange={(e) => pick(e.target.value)} aria-label="Área">
          {plan.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="sm-wrap">
        <div className="rr-rows ds-rows">
          <div className="rr-head" aria-hidden="true">{DEV_ROLES.map((r) => <span key={r.role}>{r.label}</span>)}</div>
          {!stacks.length && <div className="rr-empty">{mode === 'deploy' ? 'Nada espera para subir a main.' : mode === 'work' ? 'Nada pendiente en esta vista (lo validado está en «Todo»).' : `Aún no hay stacks de ${area ? area.name : 'esta área'}. Crea el primero abajo: una feature con su plan y su verificación.`}</div>}
          {entries.map((e) => {
            const head = e.day !== lastDay;
            lastDay = e.day;
            return (
              <React.Fragment key={e.id}>
                {head && <h3 className="ds-day">{/^\d{4}/.test(e.day || '') ? dayLabel(e.day) : 'Sin día'}</h3>}
                {e.batch ? (
                  <div className="ds-batchbox" style={{ '--c': color }}>
                    {batchHead(e)}
                    {e.shown.map((st) => <div key={st.id} className="ds-step"><span className="ds-n">{e.sts.indexOf(st) + 1}</span>{rowOf(st)}</div>)}
                  </div>
                ) : rowOf(e.st)}
              </React.Fragment>
            );
          })}
          {reviewId && (() => {
            const it = plan.items.find((i) => i.id === reviewId);
            const rep = parseReport(reportOf(plan, reviewId));
            const list = (title, items, ordered) => (items.length ? (
              <section className="dr-sec"><h4>{title}</h4>{ordered ? <ol>{items.map((x, i) => <li key={i}>{x}</li>)}</ol> : <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>}</section>
            ) : null);
            return it ? (
              <div className="dr-back" role="dialog" aria-modal="true" aria-label="Informe" onClick={() => setReviewId(null)}>
                <div className="dr" onClick={(e) => e.stopPropagation()}>
                  <h3>{it.text}</h3>
                  {rep.summary && <p className="dr-sum">{rep.summary}</p>}
                  {(rep.branch || rep.commit) && <p className="dr-meta">{rep.branch && <span>Rama <code>{rep.branch}</code></span>} {rep.commit && <span>Commit <code>{rep.commit}</code></span>}</p>}
                  {list('Qué se hizo', rep.done)}
                  {list('Cómo verificarlo', rep.verify, true)}
                  {list('Decisiones', rep.decisions)}
                  {list('Pendiente / no se pudo completar', rep.pending)}
                  {!rep.structured && <p className="ds-hint">Este informe no venía con el formato por secciones: se ordenó por frases. Los siguientes vendrán con «cómo verificarlo» paso a paso.</p>}
                  <div className="dr-actions">
                    <button className="ap-btn" onClick={() => setReviewId(null)}>Cerrar</button>
                    <button className="ap-btn ds-ok" onClick={() => { mutate((p) => setDevValid(p, it.id, true)); setReviewId(null); }}>Validar ✓</button>
                  </div>
                </div>
              </div>
            ) : null;
          })()}
          {pick2.length > 0 && (
            <div className="ds-batch" role="group" aria-label="Lote">
              <strong>Lote · {pick2.length} {pick2.length === 1 ? 'feature' : 'features'}</strong>
              <span className="ds-hint">se hacen en este orden, en una sola conversación (un solo arranque en frío)</span>
              <input type="date" value={bDay} onChange={(e) => setBDay(e.target.value)} aria-label="Día del lote" />
              <input type="time" value={bTime} onChange={(e) => setBTime(e.target.value)} aria-label="Hora de inicio del lote" />
              <button className="ap-btn" disabled={pick2.length < 2} onClick={() => {
                const [h, m] = bTime.split(':').map(Number);
                const out = setDevBatch(plan, pick2, { day: bDay, time: h * 60 + m });
                if (out.error) { setMsg(out.error); return; }
                setMsg(''); mutate(() => out.plan); setPick2([]);
              }}>Lanzar lote</button>
              <button className="ap-btn" onClick={() => setPick2([])}>Cancelar</button>
            </div>
          )}
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
            if (newMod) { const c = assignCode(out.plan, out.id, newMod); if (!c.error) out.plan = c.plan; }
            const [h, m] = (time || '').split(':').map(Number);
            let next = Number.isFinite(h) ? setDevTime(out.plan, out.id, h * 60 + m) : out.plan;
            if (auto) next = setDevLaunch(next, out.id, true);
            mutate(() => next); setName(''); setOpen(out.id);
          }}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="+ Nueva feature: ponle un nombre" aria-label="Nombre de la nueva feature" />
            {cfg && (
              <select className="ds-mod" value={newMod} onChange={(e) => setNewMod(e.target.value)} aria-label="Módulo del nuevo ticket">
                <option value="">Sin código</option>
                {Object.entries(cfg.modules).map(([k, label]) => <option key={k} value={k}>{k} · {label}</option>)}
              </select>
            )}
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
