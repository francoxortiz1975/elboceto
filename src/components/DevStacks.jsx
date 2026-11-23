import React, { useState, useEffect } from 'react';
import { Check, X, Plus, ChevronUp, ArrowUp, ArrowDown, Rocket } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { codeConfig, codeOf, assignCode, addModification, suggestModule, bulkAssign } from '../lib/devCodes';
import { AREA_COLORS, dayLabel, isoOf, addDays, fmtMin } from '../lib/areaPlan';
import { DEV_ROLES, devStacks, addDevStack, addDevSlot, editDevItem, moveDevStack, removeDevItem, migrateToDev, needsReview, needsDeploy, isValidated, toggleDevDone, setDevValid, stackVisible, reportOf, parseReport, dropDev, detachDev, nudgeDevStack, setDevTime, setDevLaunch, setDevBatch, unbatch, batchStatus, addToBatch, ticketStatus, ticketTimeline, arrivedAt, scheduledISO, fmtWhen, whenOptions, scheduleStack, requestCorrection, validateAndDeploy, launchNow, setNoDeploy, requestDeploy, applyDeploys } from '../lib/devStacks';
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
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem('el_boceto_dev_layout_v1') === 'detail' ? 'detail' : 'log'; } catch { return 'log'; } });
  const setLay = (v) => { setLayout(v); try { localStorage.setItem('el_boceto_dev_layout_v1', v); } catch { /* storage unavailable */ } };
  const [logFilter, setLogFilter] = useState('act');
  const [q, setQ] = useState('');
  const [modF, setModF] = useState('');
  const [panelMode, setPanelMode] = useState(null); // null | 'correct' | 'schedule'
  const [corrText, setCorrText] = useState('');
  const [whenKey, setWhenKey] = useState('tonight');
  const [whenDay, setWhenDay] = useState(() => isoOf(new Date()));
  const [whenTime, setWhenTime] = useState('22:00');
  const [sortKey, setSortKey] = useState('llego');
  const [sortDir, setSortDir] = useState('desc');
  const [logOpen, setLogOpen] = useState(null);
  const [reviewId, setReviewId] = useState(null); // piece whose final report is open in the reader
  const [mode, setMode] = useState(() => { try { const m = localStorage.getItem('el_boceto_dev_mode_v1'); return m === 'deploy' || m === 'all' ? m : 'work'; } catch { return 'work'; } });
  const setView = (m) => { setMode(m); try { localStorage.setItem('el_boceto_dev_mode_v1', m); } catch { /* storage unavailable */ } };
  const mutate = (fn) => onChange((p) => fn(p));
  // A finished "subir a main" block marks its feature as deployed.
  useEffect(() => { if (applyDeploys(plan) !== plan) onChange((p) => applyDeploys(p)); }, [plan, onChange]);
  // The tasks the area already has become stacks (once; running again changes nothing).
  useEffect(() => { if (areaId && migrateToDev(plan, areaId) !== plan) onChange((p) => migrateToDev(p, areaId)); }, [plan, areaId, onChange]);
  useEffect(() => { setPanelMode(null); setCorrText(''); setWhenKey(whenOptions(new Date())[1].key); setMsg(''); }, [logOpen]);
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
          <button className="ap-btn ds-ok" onClick={() => validateOnly(it.id)}>Validar ✓</button>
          {needsDeploy(it) && <button className="ap-btn ds-ok deploy" onClick={() => validatePush(it.id)}>Validar y subir a main</button>}
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

  // Validate, and for work IRIS built, push it to main in the same click (with an explicit confirmation).
  const validateOnly = (id) => mutate((p) => setDevValid(p, id, true));
  const validatePush = (id) => {
    const it = plan.items.find((i) => i.id === id);
    if (!window.confirm(`Validar y subir ${(it.dev && it.dev.code) || it.text} a main?\n\nLa conversación del área hará merge de su rama a main, push y comprobará el despliegue en producción. Se lanza ahora, solo para esto.`)) return false;
    const out = validateAndDeploy(plan, id);
    if (out.error) { setMsg(out.error); return false; }
    setMsg(''); mutate(() => out.plan); return true;
  };
  const footerOf = (st) => (
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
                  <span className={`ds-status ${ts.key} t-${ts.tone}`}>{ts.label}</span>
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
  );

  const rowOf = (st) => (
        <div className="rr-row" style={{ '--c': color }}>
          {slot(st, 'plan')}
          {slot(st, 'build')}
          {slot(st, 'check')}
          {footerOf(st)}
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

  // ---------- Registro (mesa de ayuda): table on the left, the whole ticket in a side panel on the right ----------
  // Colours: gray = pending, black = booked / running, orange = waiting for the user, red = error, green = closed (in main).
  const LOG_FILTERS = [['act', 'Activos'], ['pend', 'Pendiente'], ['black', 'Agendado'], ['wait', 'Esperando'], ['bad', 'Error'], ['ok', 'Cerrado']];
  const bucketOf = (st) => ({ gray: 'pend', black: 'black', orange: 'wait', red: 'bad', green: 'ok' })[ticketStatus(plan, st).tone] || 'pend';
  const matchesFilter = (st, f) => (f === 'act' ? bucketOf(st) !== 'ok' : bucketOf(st) === f);
  const STATUS_ORDER = ['missed', 'deployfail', 'done', 'running', 'deploying', 'scheduled', 'pending', 'validated', 'deployed'];
  const pill = (ts) => <span className={`ds-status ${ts.key} t-${ts.tone}`}>{ts.label}</span>;
  const sortVal = (st, k) => {
    if (k === 'codigo') return codeOf(st.main) || '~';
    if (k === 'estado') return String(STATUS_ORDER.indexOf(ticketStatus(plan, st).key)).padStart(2, '0');
    if (k === 'prog') return scheduledISO(st.main) || '~';
    return arrivedAt(plan, st) || '';
  };
  const logRows = () => {
    const ql = q.trim().toLowerCase();
    const list = all.filter((st) => matchesFilter(st, logFilter) && (!modF || st.main.dev.mod === modF) && (!ql || `${codeOf(st.main)} ${st.main.text}`.toLowerCase().includes(ql)));
    const dir = sortDir === 'asc' ? 1 : -1;
    // tickets without a value for the column always go last
    return list.slice().sort((a, b) => {
      const x = sortVal(a, sortKey); const y = sortVal(b, sortKey);
      const ex = !x || x === '~'; const ey = !y || y === '~';
      if (ex !== ey) return ex ? 1 : -1;
      return x.localeCompare(y) * dir;
    });
  };
  const sortBy = (k) => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir(k === 'llego' ? 'desc' : 'asc'); } };
  const batchLabel = (st) => {
    const b = st.main.iris && st.main.iris.launch && st.main.iris.batch;
    if (!b) return '';
    const mates = all.filter((x) => x.main.iris && x.main.iris.batch === b && x.main.iris.launch).sort((x, y) => (x.main.at || 0) - (y.main.at || 0));
    return `Lote ${mates.findIndex((x) => x.id === st.id) + 1}/${mates.length}`;
  };
  const resolveWhen = () => {
    if (whenKey === 'custom') {
      const m = /^(\d{1,2}):(\d{2})$/.exec(whenTime || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(whenDay || '') || !m) { setMsg('Elige el día y la hora.'); return null; }
      return { day: whenDay, at: Number(m[1]) * 60 + Number(m[2]) };
    }
    const o = whenOptions(new Date()).find((x) => x.key === whenKey) || whenOptions(new Date())[1];
    return { day: o.day, at: o.at };
  };
  // "¿Cuándo?": quick choices plus a free day and time
  const whenPicker = (confirmLabel, onConfirm) => (
    <div className="dz-when">
      <div className="dz-label">¿Cuándo?</div>
      <div className="dz-opts">
        {whenOptions(new Date()).map((o) => <button key={o.key} className={`dz-opt${whenKey === o.key ? ' on' : ''}`} onClick={() => setWhenKey(o.key)}>{o.label}</button>)}
        <button className={`dz-opt${whenKey === 'custom' ? ' on' : ''}`} onClick={() => setWhenKey('custom')}>Elegir día y hora…</button>
      </div>
      {whenKey === 'custom' && <div className="dz-custom"><input type="date" value={whenDay} onChange={(e) => setWhenDay(e.target.value)} aria-label="Día" /><input type="time" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} aria-label="Hora" /></div>}
      <button className="dz-big dark" onClick={() => { const w = resolveWhen(); if (w) onConfirm(w); }}>{confirmLabel}</button>
    </div>
  );
  const validateTicket = (st) => { if (needsDeploy(st.main)) validatePush(st.id); else validateOnly(st.id); };
  const ticketActions = (st, ts) => {
    const m = st.main;
    if (panelMode === 'correct') {
      return (
        <div className="dz-act">
          <div className="dz-label">Corrección</div>
          <textarea className="dz-corr" rows={6} autoFocus value={corrText} onChange={(e) => setCorrText(e.target.value)} placeholder="Escribe qué hay que corregir, con tus palabras…" aria-label="Qué hay que corregir" />
          {whenPicker('Enviar corrección', (w) => {
            const out = requestCorrection(plan, st.id, { text: corrText, day: w.day, at: w.at });
            if (out.error) { setMsg(out.error); return; }
            setMsg(''); mutate(() => out.plan); setPanelMode(null); setCorrText('');
          })}
          <button className="dz-link" onClick={() => setPanelMode(null)}>Cancelar</button>
        </div>
      );
    }
    if (panelMode === 'schedule') {
      return <div className="dz-act">{whenPicker('Agendar', (w) => { mutate((p) => scheduleStack(p, st.id, w)); setPanelMode(null); })}<button className="dz-link" onClick={() => setPanelMode(null)}>Cancelar</button></div>;
    }
    if (ts.key === 'done') {
      return (
        <div className="dz-act">
          <div className="dz-two">
            <button className="dz-big green" onClick={() => validateTicket(st)}>✓ Validar</button>
            <button className="dz-big" onClick={() => setPanelMode('correct')}>✎ Corrección</button>
          </div>
          <div className="dz-hint">{needsDeploy(m) ? 'Validar sube el cambio a main.' : 'Validar lo da por cerrado.'}</div>
        </div>
      );
    }
    if (ts.key === 'running' && m.iris && m.iris.ended) {
      return (
        <div className="dz-act">
          <div className="dz-hint">El agente terminó y lo dejó abierto: necesita algo de ti. Lee su informe abajo.</div>
          <div className="dz-two">
            <button className="dz-big" onClick={() => setPanelMode('correct')}>✎ Corrección</button>
            <button className="dz-big green" onClick={() => mutate((p) => toggleDevDone(p, st.id))}>✓ Darlo por hecho</button>
          </div>
        </div>
      );
    }
    if (ts.key === 'validated' && ts.action === 'deploy') {
      return (
        <div className="dz-act">
          <button className="dz-big green" onClick={() => doAction(st, 'deploy')}>Subir a main</button>
          <button className="dz-link" onClick={() => mutate((p) => setNoDeploy(p, st.id))}>No necesita subirse</button>
        </div>
      );
    }
    if (ts.key === 'pending' || ts.key === 'missed') {
      return <div className="dz-act"><div className="dz-label">{ts.key === 'missed' ? 'No llegó a abrirse. Agéndalo de nuevo' : 'Agendar'}</div>{whenPicker('Agendar', (w) => mutate((p) => scheduleStack(p, st.id, w)))}</div>;
    }
    if (ts.key === 'scheduled') {
      return (
        <div className="dz-act">
          <div className="dz-two">
            <button className="dz-big dark" onClick={() => mutate((p) => launchNow(p, st.id))}>Lanzar ahora</button>
            <button className="dz-big" onClick={() => setPanelMode('schedule')}>Cambiar horario</button>
          </div>
        </div>
      );
    }
    if (ts.key === 'deployfail') return <div className="dz-act"><button className="dz-big dark" onClick={() => doAction(st, 'retry')}>Reintentar subida a main</button></div>;
    if (ts.key === 'running') return <div className="dz-act"><div className="dz-hint">El agente está trabajando en esto.</div></div>;
    if (ts.key === 'deploying') return <div className="dz-act"><div className="dz-hint">Subiendo a main…</div></div>;
    return null;
  };
  const doAction = (st, a) => {
    if (a === 'deploy' || a === 'retry') {
      if (!window.confirm(`Subir ${st.main.dev.code || st.main.text} a main?\n\nLa conversación del área hará merge de su rama a main, push y comprobará el despliegue en producción. Se lanza ahora, solo para esto.`)) return;
      const out = requestDeploy(plan, st.id);
      if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); }
    }
  };
  const reportBlock = (rep, st) => {
    const sec = (title, items, ordered) => (items.length ? <section className="dz-sec"><h5>{title}</h5>{ordered ? <ol>{items.map((v, i) => <li key={i}>{v}</li>)}</ol> : <ul>{items.map((v, i) => <li key={i}>{v}</li>)}</ul>}</section> : null);
    return (
      <div className="dz-rep">
        {rep.summary && <p className="dz-lead">{rep.summary}</p>}
        {sec('Qué se hizo', rep.done)}
        {sec('Cómo comprobarlo', rep.verify, true)}
        {sec('Decisiones', rep.decisions)}
        {sec('Pendiente', rep.pending)}
        <button className="dz-link" onClick={() => setReviewId(st.id)}>Abrir el informe completo</button>
      </div>
    );
  };
  // The side panel: everything about one ticket
  const sidePanel = (st) => {
    const ts = ticketStatus(plan, st);
    const m = st.main;
    const raw = reportOf(plan, st.id);
    const rep = parseReport(raw);
    const tl = ticketTimeline(plan, st);
    const cur = tl.findIndex((x) => !x.done);
    const b = m.iris && m.iris.launch && m.iris.batch;
    const lote = batchLabel(st);
    return (
      <aside className="dz-panel" aria-label={`Ticket ${codeOf(m) || ''}`}>
        <header className="dz-ph">
          <div className="dz-ph1"><span className="dz-code">{codeOf(m) || 'Sin código'}</span>{(m.dev.rev || 1) > 1 && <span className="dz-rev">v{m.dev.rev}</span>}{pill(ts)}</div>
          <button className="dz-x" aria-label="Cerrar el panel" onClick={() => setLogOpen(null)}>×</button>
        </header>
        <div className="dz-body">
          <input className="dz-title" value={m.text} aria-label="Título" onChange={(e) => mutate((p) => editDevItem(p, st.id, { text: e.target.value }))} />
          {msg && <div className="ds-msg" role="status">{msg}</div>}
          {ticketActions(st, ts)}
          <h4>Historial</h4>
          <ul className="dz-tl">
            {tl.map((x, i) => (
              <li key={x.key} className={x.done ? 'done' : i === cur ? 'now' : ''}>
                <i />
                <div><div className="l">{x.label}</div><div className="d">{x.at ? `${fmtWhen(x.at)}${x.planned ? ' · previsto' : ''}` : x.done ? 'sin fecha registrada' : '—'}</div></div>
              </li>
            ))}
          </ul>
          {(m.dev.revisions || []).length > 0 && (
            <div className="dz-revs">
              {m.dev.revisions.map((r) => <div key={r.n} className="dz-revi"><b>v{r.n}</b> · {fmtWhen(r.at)}<p>{r.text}</p></div>)}
            </div>
          )}
          {raw && <><h4>Último informe</h4>{reportBlock(rep, st)}</>}
          <h4>Comentarios</h4>
          <textarea className="dz-note" rows={5} value={m.note || ''} placeholder="Notas, decisiones, enlaces, qué falta…" aria-label="Comentarios" onChange={(e) => mutate((p) => editDevItem(p, st.id, { note: e.target.value }))} />
          <details className="dz-adv">
            <summary>Más opciones</summary>
            <dl className="dz-props">
              <dt>Módulo</dt><dd>{m.dev.mod && cfg ? `${m.dev.mod} · ${cfg.modules[m.dev.mod] || ''}` : '—'}</dd>
              <dt>Lote</dt><dd>{lote || '—'}</dd>
              {rep.branch && <><dt>Rama</dt><dd className="dz-mono">{rep.branch}</dd></>}
              {rep.commit && <><dt>Commit</dt><dd className="dz-mono">{rep.commit}</dd></>}
            </dl>
            {footerOf(st)}
            <div className="dz-end">
              {b && <button className="dz-link" onClick={() => mutate((p) => unbatch(p, b))}>Deshacer el lote</button>}
              <button className="dz-link" onClick={() => { if (window.confirm('¿Quitar el ticket completo?')) { mutate((p) => removeDevItem(p, st.id)); setLogOpen(null); } }}>Quitar ticket</button>
            </div>
          </details>
        </div>
      </aside>
    );
  };
  const logView = () => {
    const list = logRows();
    const sel = logOpen ? all.find((st) => st.id === logOpen) : null;
    const arrow = (k) => (sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');
    return (
      <div className="dz">
        <div className="dl-bar">
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o asunto" aria-label="Buscar" />
          {cfg && <select value={modF} onChange={(e) => setModF(e.target.value)} aria-label="Módulo"><option value="">Todos los módulos</option>{Object.entries(cfg.modules).map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}</select>}
        </div>
        <div className="dl-chips">
          {LOG_FILTERS.map(([k, l]) => <button key={k} className="dl-chip" aria-pressed={logFilter === k} onClick={() => setLogFilter(k)}>{l}<b>{all.filter((st) => matchesFilter(st, k)).length}</b></button>)}
        </div>
        <div className={`dz-wrap${sel ? ' split' : ''}`}>
          <div className="dz-list">
            <div className="dz-hd" role="row">
              <button onClick={() => sortBy('codigo')}>Ticket{arrow('codigo')}</button>
              <span>Asunto</span>
              <button onClick={() => sortBy('estado')}>Estado{arrow('estado')}</button>
              <button onClick={() => sortBy('llego')}>Llegó{arrow('llego')}</button>
              <button onClick={() => sortBy('prog')}>Programado{arrow('prog')}</button>
            </div>
            {!list.length && <div className="rr-empty">Nada en esta vista.</div>}
            {list.map((st) => {
              const ts = ticketStatus(plan, st);
              const m = st.main;
              const arr = arrivedAt(plan, st);
              const sch = scheduledISO(m);
              const late = sch && sch.includes('T') && new Date(sch).getTime() < Date.now() && (ts.key === 'scheduled' || ts.key === 'missed');
              const lote = batchLabel(st);
              return (
                <div key={st.id} className={`dz-row${logOpen === st.id ? ' sel' : ''}`} role="row" tabIndex={0}
                  onClick={() => setLogOpen(logOpen === st.id ? null : st.id)} onKeyDown={(e) => { if (e.key === 'Enter') setLogOpen(logOpen === st.id ? null : st.id); }}>
                  <span className="dz-code">{codeOf(m) || '—'}{(m.dev.rev || 1) > 1 && <span className="dz-rev">v{m.dev.rev}</span>}</span>
                  <div className="dz-sub"><div className="dz-t">{m.text}</div><div className="dz-m">{m.dev.mod && cfg ? `${m.dev.mod} · ${cfg.modules[m.dev.mod] || ''}` : 'Sin módulo'}{lote ? ` · ${lote}` : ''}</div></div>
                  <span className="dz-st">{pill(ts)}</span>
                  <div className="dz-dt ll">{arr ? fmtWhen(arr) : '—'}</div>
                  <div className={`dz-dt${late ? ' late' : ''}`}>{sch ? fmtWhen(sch) : 'Sin agendar'}{late ? <em>Atrasado</em> : null}</div>
                </div>
              );
            })}
          </div>
          {sel && sidePanel(sel)}
        </div>
      </div>
    );
  };

  let lastDay = null;
  return (
    <div className={`ap-root sm-root${compact ? ' compact' : ''}`}>
      <div className="ap-head">
        <h1 className="font-title">Desarrollo</h1>
        <span className="ap-sub">plan · desarrollo · verificación</span>
        <a className="ap-btn" href="/tickets" title="Abre la consola de tickets en pantalla completa">Abrir Tickets ↗</a>
        {onBack && <button className="ap-btn ap-back" onClick={onBack}><ChevronUp size={12} style={{ verticalAlign: '-2px' }} /> Lienzo</button>}
      </div>
      <div className="ap-filters">
        {onTabChange && <PlanTabs value={tab} onChange={onTabChange} />}
        {uncoded > 0 && <button className="ap-btn" title="Asigna a cada stack el código del módulo que sugiero por su título. Los que no sé clasificar quedan para ti." onClick={() => { if (window.confirm(`Asignar código a ${uncoded} stacks según el módulo sugerido por su título?\nLos códigos no cambian después.`)) mutate((p) => bulkAssign(p, areaId).plan); }}>Asignar {uncoded} códigos sugeridos</button>}
        {toReview > 0 && <span className="ds-count">{toReview} por validar</span>}
        <div className="ap-seg ds-modes" role="group" aria-label="Cómo verlo">
          <button aria-pressed={layout === 'log'} onClick={() => setLay('log')}>Registro</button>
          <button aria-pressed={layout === 'detail'} onClick={() => setLay('detail')}>Detalle</button>
        </div>
        {layout === 'detail' && <div className="ap-seg ds-modes" role="group" aria-label="Qué mostrar">
          <button aria-pressed={mode === 'work'} onClick={() => setView('work')} title="Lo que aún no está validado">Pendientes</button>
          <button aria-pressed={mode === 'deploy'} onClick={() => setView('deploy')} title="Validado, falta subir su rama a main">Por subir a main{toDeploy.length ? ` · ${toDeploy.length}` : ''}</button>
          <button aria-pressed={mode === 'all'} onClick={() => setView('all')} title="Todo, también lo validado y lo ya deployado">Todo</button>
        </div>}
        {mode === 'deploy' && toDeploy.some((st) => needsDeploy(st.main)) && <button className="ap-btn" title="Marca todos estos como que no necesitan subir a main (salen de esta lista)" onClick={() => { if (window.confirm(`Marcar ${toDeploy.filter((st) => needsDeploy(st.main)).length} tickets como "sin deploy"?\nSalen de esta lista; no se sube nada.`)) mutate((p) => toDeploy.reduce((acc, st) => (needsDeploy(st.main) ? setNoDeploy(acc, st.id) : acc), p)); }}>Todos «sin deploy»</button>}
        <select className="ds-area" value={areaId} onChange={(e) => pick(e.target.value)} aria-label="Área">
          {plan.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="sm-wrap">
        <div className="rr-rows ds-rows">
          {layout === 'log' ? logView() : <div className="rr-head" aria-hidden="true">{DEV_ROLES.map((r) => <span key={r.role}>{r.label}</span>)}</div>}
          {layout === 'detail' && !stacks.length && <div className="rr-empty">{mode === 'deploy' ? 'Nada espera para subir a main.' : mode === 'work' ? 'Nada pendiente en esta vista (lo validado está en «Todo»).' : `Aún no hay stacks de ${area ? area.name : 'esta área'}. Crea el primero abajo: una feature con su plan y su verificación.`}</div>}
          {layout === 'detail' && entries.map((e) => {
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
                    <button className="ap-btn ds-ok" onClick={() => { validateOnly(it.id); setReviewId(null); }}>Validar ✓</button>
                    {needsDeploy(it) && <button className="ap-btn ds-ok deploy" onClick={() => { if (validatePush(it.id)) setReviewId(null); }}>Validar y subir a main</button>}
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
              {[...new Set(all.filter((x) => x.main.iris && x.main.iris.launch && x.main.iris.batch && x.main.iris.state === 'pending').map((x) => x.main.iris.batch))].map((b) => {
                const lead = all.filter((x) => x.main.iris && x.main.iris.batch === b).sort((x, y) => (x.main.at || 0) - (y.main.at || 0))[0].main;
                return <button key={b} className="ap-btn" title="Añade las marcadas a ese lote, después de las que ya lleva" onClick={() => { const out = addToBatch(plan, b, pick2); if (out.error) { setMsg(out.error); return; } setMsg(''); mutate(() => out.plan); setPick2([]); }}>Añadir al lote de las {typeof lead.at === 'number' ? fmtMin(lead.at) : '--:--'}</button>;
              })}
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
