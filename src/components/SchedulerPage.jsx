import React, { useMemo, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { AREA_COLORS, addDays, dayLabel, isoOf } from '../lib/areaPlan';
import {
  EFFORT, WEIGHTS, PLANNED, runEngine, areaScore, freeHours, fmtMin, toMin, activeOn, cycleWeek, signature, slotKey, SLOT
} from '../lib/scheduler/engine';
import { getScheduler, attrsOf, buildEngineInput, nowMinutes, mondayOfIso, newFixed } from '../lib/scheduler/config';
import './SchedulerPage.css';

const DAYN = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const PANELS = [['perfil', 'Perfil'], ['fijo', 'Calendario fijo'], ['areas', 'Áreas'], ['tareas', 'Tareas'], ['pesos', 'Pesos'], ['sim', 'Simulación']];

const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const clone = (o) => JSON.parse(JSON.stringify(o));
function setPath(o, p, v) {
  const ks = p.split('.'); const last = ks.pop();
  const t = ks.reduce((x, k) => { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; return x[k]; }, o);
  if (v === '' || v === undefined) delete t[last]; else t[last] = v;
}

const Tag = ({ kind }) => (kind === 'on' ? <span className="sc-tag on">activo</span> : kind === 'plan' ? <span className="sc-tag plan">planeado</span> : null);
const Win = ({ title, extra, children }) => (
  <section className="sc-win"><h2><span>{title}</span>{extra}</h2><div className="sc-body">{children}</div></section>
);
const Field = ({ label, tag, children }) => (
  <label className="sc-f"><span className="sc-l">{label}<Tag kind={tag} /></span>{children}</label>
);

// A control bound to a path in the scheduler settings (or to an explicit value + onSet).
function In({ cfg, patch, path, type = 'text', value, num, options, min, max, step, label }) {
  const raw = value !== undefined ? value : getPath(cfg, path);
  const set = (v) => patch(path, v);
  if (type === 'select') {
    return (
      <select value={raw ?? ''} onChange={(e) => set(num ? Number(e.target.value) : e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  }
  if (type === 'checkbox') {
    return <span className="sc-chk"><input type="checkbox" checked={!!raw} onChange={(e) => set(e.target.checked ? true : '')} /> {label}</span>;
  }
  if (type === 'range') {
    return <input type="range" min={min} max={max} step={step} value={raw ?? 0} onChange={(e) => set(Number(e.target.value))} />;
  }
  return (
    <input
      type={type} value={raw ?? ''} min={min} max={max} step={step}
      onChange={(e) => set(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
    />
  );
}

export function SchedulerPage({ plan, onChange, onBack, compact, tab, onTabChange }) {
  const [panel, setPanel] = useState('perfil');
  const [selId, setSelId] = useState(null);
  const [baseSig, setBaseSig] = useState(null);
  const [includeLater, setIncludeLater] = useState(false);
  const today = useMemo(() => isoOf(new Date()), []);
  const nowMin = useMemo(() => nowMinutes(), []);

  const cfg = useMemo(() => getScheduler(plan), [plan.scheduler, plan.areas]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (fn) => onChange((p) => ({ ...p, scheduler: fn(clone(getScheduler(p))) }));
  const patch = (path, v) => update((c) => { setPath(c, path, v); return c; });

  const input = useMemo(() => buildEngineInput(plan, today, { includeLater }), [plan.items, plan.scheduler, plan.areas, today, includeLater]); // eslint-disable-line react-hooks/exhaustive-deps
  const res = useMemo(() => runEngine(input.cfg, input.tasks, { today, nowMin, blocks: input.blocks }), [input, today, nowMin]);

  const areaById = useMemo(() => Object.fromEntries(plan.areas.map((a) => [a.id, a])), [plan.areas]);
  const colorOf = (areaId) => { const a = areaById[areaId]; return AREA_COLORS[(a ? a.c : 6) % AREA_COLORS.length]; };
  const areaName = (id) => (areaById[id] ? areaById[id].name : '—');
  const ctx = { plan, cfg, patch, update, today, res, colorOf, areaName, areaById };

  const goPanel = (id) => { setPanel(id); if (id === 'pesos') setBaseSig(signature(runEngine(cfg, input.tasks, { today, nowMin, blocks: input.blocks }))); };

  return (
    <div className={`ap-root sc-root${compact ? ' compact' : ''}`}>
      <div className="ap-head">
        <h1 className="font-title">Motor de planificación</h1>
        <span className="ap-sub">perfil · reglas · pesos</span>
        {onBack && (
          <button className="ap-btn ap-back" onClick={onBack}>
            <ChevronUp size={12} style={{ verticalAlign: '-2px' }} /> Lienzo
          </button>
        )}
      </div>
      <div className="ap-filters">
        {onTabChange && <PlanTabs value={tab} onChange={onTabChange} />}
        <div className="ap-seg" role="group" aria-label="Ventana del motor">
          {PANELS.map(([id, l]) => <button key={id} aria-pressed={panel === id} onClick={() => goPanel(id)}>{l}</button>)}
        </div>
      </div>
      <div className="sc-wrap">
        {panel === 'perfil' && <ProfilePanel {...ctx} />}
        {panel === 'fijo' && <FixedPanel {...ctx} />}
        {panel === 'areas' && <AreasPanel {...ctx} />}
        {panel === 'tareas' && <TasksPanel {...ctx} includeLater={includeLater} />}
        {panel === 'pesos' && <WeightsPanel {...ctx} selId={selId} setSelId={setSelId} baseSig={baseSig} setBaseSig={setBaseSig} />}
        {panel === 'sim' && <SimPanel {...ctx} selId={selId} setSelId={setSelId} includeLater={includeLater} setIncludeLater={setIncludeLater} />}
      </div>
    </div>
  );
}

/* ---------- Perfil ---------- */
function ProfilePanel({ cfg, patch, update, res }) {
  const P = cfg.profile;
  const awake = (toMin(P.bed) - toMin(P.wake)) / 60;
  return (
    <>
      <p className="sc-note">Lo que casi nunca cambia. El motor lo usa para saber qué horas existen de verdad antes de repartir nada.</p>
      <div className="sc-cols">
        <div className="sc-stack">
          <Win title="Sueño">
            <div className="sc-grid">
              <Field label="Me levanto" tag="on"><In cfg={cfg} patch={patch} path="profile.wake" type="time" /></Field>
              <Field label="Me acuesto" tag="on"><In cfg={cfg} patch={patch} path="profile.bed" type="time" /></Field>
            </div>
            <div className="sc-stat">Horas despierto al día: <b>{awake.toFixed(1)} h</b></div>
          </Win>
          <Win title="Comidas" extra={<Tag kind="on" />}>
            {P.meals.map((m, i) => (
              <div className="sc-meal" key={i}>
                <In cfg={cfg} patch={patch} path={`profile.meals.${i}.on`} type="checkbox" label="" />
                <In cfg={cfg} patch={patch} path={`profile.meals.${i}.name`} />
                <In cfg={cfg} patch={patch} path={`profile.meals.${i}.start`} type="time" />
                <In cfg={cfg} patch={patch} path={`profile.meals.${i}.dur`} type="number" min={5} max={180} step={5} />
              </div>
            ))}
            <div className="sc-stat">Casilla · nombre · hora · minutos</div>
          </Win>
          <Win title="Disponibilidad">
            <div className="sc-grid">
              <Field label="Puedo trabajar desde" tag="on"><In cfg={cfg} patch={patch} path="profile.window.from" type="time" /></Field>
              <Field label="hasta" tag="on"><In cfg={cfg} patch={patch} path="profile.window.to" type="time" /></Field>
            </div>
            <div className="sc-stat">Días abiertos para trabajo flexible <Tag kind="on" /></div>
            <div className="sc-chips">
              {DAYN.map((d, i) => (
                <button key={d} aria-pressed={!!P.open[i]} onClick={() => patch(`profile.open.${i}`, !P.open[i] ? true : false)}>{d}</button>
              ))}
            </div>
          </Win>
        </div>
        <div className="sc-stack">
          <Win title="Energía y límites">
            {[['am', 'de mañana (hasta 13:00)'], ['pm', 'de tarde (13:00–19:00)'], ['ev', 'de noche (desde 19:00)']].map(([k, l]) => (
              <div className="sc-sl" key={k}>
                <div className="sc-slt"><span>Energía {l}</span><b>{P.energy[k]}</b></div>
                <In cfg={cfg} patch={patch} path={`profile.energy.${k}`} type="range" min={1} max={5} step={1} />
              </div>
            ))}
            <div className="sc-grid">
              <Field label="Máx. horas profundas / día" tag="on"><In cfg={cfg} patch={patch} path="profile.deepCap" type="number" min={1} max={12} step={0.5} /></Field>
              <Field label="Colchón entre tareas (min)" tag="on"><In cfg={cfg} patch={patch} path="profile.buffer" type="number" min={0} max={60} step={5} /></Field>
              <Field label="Colchón tras algo fijo (min)" tag="on"><In cfg={cfg} patch={patch} path="profile.bufferFixed" type="number" min={0} max={60} step={5} /></Field>
            </div>
          </Win>
          <Win title="Traslados" extra={<Tag kind="on" />}>
            {P.places.map((p, i) => (
              <div className="sc-place" key={i}>
                <In cfg={cfg} patch={patch} path={`profile.places.${i}.name`} />
                <In cfg={cfg} patch={patch} path={`profile.places.${i}.min`} type="number" min={0} max={180} step={5} />
                <button className="ap-btn" onClick={() => update((c) => { c.profile.places.splice(i, 1); return c; })} aria-label="Quitar lugar">×</button>
              </div>
            ))}
            <div><button className="ap-btn" onClick={() => update((c) => { c.profile.places.push({ name: 'Nuevo lugar', min: 15 }); return c; })}>+ Añadir lugar</button></div>
            <div className="sc-stat">Minutos de ida. Se reservan antes y después de lo fijo, y se suman a las tareas de ese lugar.</div>
          </Win>
          <Win title="Resumen"><div className="sc-stat">Horas libres para tareas flexibles en los próximos 7 días: <b>{freeHours(res.G).toFixed(1)} h</b></div></Win>
        </div>
      </div>
    </>
  );
}

/* ---------- Calendario fijo (with rotating weeks) ---------- */
function SkipDates({ list, onChange }) {
  const [v, setV] = useState('');
  return (
    <div className="sc-skip">
      <div className="sc-chips2">
        {list.map((d) => <span key={d} className="sc-pill">{dayLabel(d)} <button onClick={() => onChange(list.filter((x) => x !== d))} aria-label="Quitar excepción">×</button></span>)}
      </div>
      <div className="sc-inline">
        <input type="date" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="ap-btn" disabled={!v || list.includes(v)} onClick={() => { onChange([...list, v].sort()); setV(''); }}>Saltar este día</button>
      </div>
    </div>
  );
}

function FixedPanel({ plan, cfg, patch, update, today }) {
  const monday = mondayOfIso(today);
  const mode = (f) => ((f.cycle || 1) <= 1 ? 'weekly' : f.cycle === 2 ? 'alt' : 'cycle');
  const setMode = (i, m) => update((c) => {
    const f = c.fixed[i];
    if (m === 'weekly') { f.cycle = 1; f.weeks = [0]; }
    else { f.cycle = m === 'alt' ? 2 : Math.max(3, f.cycle || 3); f.weeks = [0]; if (!f.anchor) f.anchor = monday; }
    return c;
  });
  return (
    <>
      <p className="sc-note">Lo que no se mueve: clases, turnos, citas. Elige los días y cómo se repite: cada semana, en semanas alternas (por ejemplo trabajo una semana y clase la siguiente) o en un ciclo de varias semanas. El motor reserva también el traslado y el colchón.</p>
      <div className="sc-stack">
        {cfg.fixed.map((f, i) => {
          const wkNow = cycleWeek(f, today);
          return (
            <div className="sc-card" key={f.id}>
              <div className="sc-head">
                <In cfg={cfg} patch={patch} path={`fixed.${i}.name`} />
                <button className="ap-btn" onClick={() => update((c) => { c.fixed.splice(i, 1); return c; })}>Quitar</button>
              </div>
              <div className="sc-chips">
                {DAYN.map((d, di) => (
                  <button key={d} aria-pressed={f.days.includes(di)} onClick={() => update((c) => { const x = c.fixed[i]; x.days = x.days.includes(di) ? x.days.filter((q) => q !== di) : [...x.days, di].sort(); return c; })}>{d}</button>
                ))}
              </div>
              <div className="sc-grid">
                <Field label="Desde" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.from`} type="time" /></Field>
                <Field label="Hasta" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.to`} type="time" /></Field>
                <Field label="Lugar" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.place`} type="select" options={cfg.profile.places.map((p) => [p.name, p.name])} /></Field>
                <Field label="Área"><In cfg={cfg} patch={patch} path={`fixed.${i}.area`} type="select" options={[['', 'Sin área'], ...plan.areas.map((a) => [a.id, a.name])]} /></Field>
              </div>

              <div className="sc-rot">
                <div className="sc-grid">
                  <Field label="Se repite" tag="on">
                    <select value={mode(f)} onChange={(e) => setMode(i, e.target.value)}>
                      <option value="weekly">Cada semana</option>
                      <option value="alt">Semanas alternas</option>
                      <option value="cycle">Ciclo de varias semanas</option>
                    </select>
                  </Field>
                  {mode(f) === 'cycle' && (
                    <Field label="Semanas del ciclo" tag="on">
                      <input type="number" min={3} max={8} value={f.cycle} onChange={(e) => update((c) => { const x = c.fixed[i]; x.cycle = Math.min(8, Math.max(3, Number(e.target.value) || 3)); x.weeks = x.weeks.filter((w) => w < x.cycle); return c; })} />
                    </Field>
                  )}
                  {mode(f) !== 'weekly' && (
                    <Field label="La semana 1 empieza el" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.anchor`} type="date" /></Field>
                  )}
                </div>
                {mode(f) !== 'weekly' && (
                  <>
                    <div className="sc-stat">Pasa en las semanas: {' '}
                      <span className="sc-chips inline">
                        {Array.from({ length: f.cycle }, (_, w) => (
                          <button key={w} aria-pressed={f.weeks.includes(w)} onClick={() => update((c) => { const x = c.fixed[i]; x.weeks = x.weeks.includes(w) ? x.weeks.filter((q) => q !== w) : [...x.weeks, w].sort(); return c; })}>{w + 1}</button>
                        ))}
                      </span>
                      {' '}· esta semana es la <b>{wkNow + 1}</b> de {f.cycle}
                    </div>
                  </>
                )}
                <div className="sc-weeks" aria-label="Próximas 8 semanas">
                  {Array.from({ length: 8 }, (_, w) => {
                    const mon = addDays(monday, 7 * w);
                    const on = f.days.some((d) => activeOn(f, addDays(mon, d)));
                    return <span key={w} className={`sc-wk${on ? ' on' : ''}${w === 0 ? ' now' : ''}`} title={`Semana del ${dayLabel(mon)}: ${on ? 'sí' : 'no'}`}>{mon.slice(8)}/{mon.slice(5, 7)}</span>;
                  })}
                </div>
              </div>

              <div className="sc-grid">
                <Field label="Vale desde" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.start`} type="date" /></Field>
                <Field label="Vale hasta" tag="on"><In cfg={cfg} patch={patch} path={`fixed.${i}.end`} type="date" /></Field>
              </div>
              <div>
                <div className="sc-stat">Días sin este evento (vacaciones, festivos) <Tag kind="on" /></div>
                <SkipDates list={f.skip || []} onChange={(v) => update((c) => { c.fixed[i].skip = v; return c; })} />
              </div>
              <div className="sc-chips2">
                <In cfg={cfg} patch={patch} path={`fixed.${i}.optional`} type="checkbox" label="Opcional: el motor podrá soltarlo si la semana no cabe" /> <Tag kind="plan" />
                <In cfg={cfg} patch={patch} path={`fixed.${i}.soft`} type="checkbox" label="Blando: se puede colocar una tarea encima con penalización" /> <Tag kind="plan" />
              </div>
            </div>
          );
        })}
        {!cfg.fixed.length && <div className="sc-empty">Nada fijo todavía. Lo que ya está con hora en tu calendario también cuenta como fijo; esto es para lo que se repite o rota.</div>}
        <div><button className="ap-btn" onClick={() => update((c) => { c.fixed.push(newFixed(plan.areas[0] && plan.areas[0].id)); return c; })}>+ Añadir algo fijo</button></div>
      </div>
    </>
  );
}

/* ---------- Áreas ---------- */
function AreasPanel({ plan, cfg, update, colorOf, areaName }) {
  const n = cfg.areaOrder.length;
  const move = (i, j) => update((c) => { [c.areaOrder[i], c.areaOrder[j]] = [c.areaOrder[j], c.areaOrder[i]]; return c; });
  return (
    <>
      <p className="sc-note">La pila decide quién gana cuando dos cosas compiten por el mismo hueco. Arriba pesa más. La posición se convierte en un valor de 0 a 1 que se multiplica por el peso “Lugar del área” (ventana Pesos).</p>
      <div className="sc-arealist">
        {cfg.areaOrder.map((id, i) => {
          const open = plan.items.filter((t) => t.area === id && !t.done).length;
          const v = areaScore(cfg, id);
          return (
            <div className="sc-arow" key={id}>
              <span className="sc-rk">{i + 1}</span>
              <i className="sc-dot" style={{ background: colorOf(id) }} />
              <span><b>{areaName(id)}</b> <span className="sc-stat">· {open} abiertas</span></span>
              <span className="sc-bar" title={`Valor ${v.toFixed(2)}`}><i style={{ width: `${v * 100}%` }} /></span>
              <span><button className="ap-btn" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button> <button className="ap-btn" disabled={i === n - 1} onClick={() => move(i, i + 1)}>↓</button></span>
            </div>
          );
        })}
      </div>
      <p className="sc-note" style={{ marginTop: 12 }}>Cuota semanal mínima por área <Tag kind="plan" />: horas que cada área debería recibir cada semana aunque no sea la más prioritaria. Todavía no entra en el cálculo.</p>
    </>
  );
}

/* ---------- Tareas ---------- */
function TasksPanel({ plan, cfg, patch, res, colorOf, areaById, today, includeLater }) {
  const [scope, setScope] = useState('week');
  const [area, setArea] = useState('');
  const [limit, setLimit] = useState(30);
  const inWeek = new Set([...res.placed.map((p) => p.task.id), ...res.unplaced.map((p) => p.task.id)]);
  const open = plan.items.filter((it) => !it.done && !(it.reel && it.stackId));
  const rows = open
    .filter((it) => (scope === 'all' ? true : scope === 'later' ? it.day === 'later' : inWeek.has(it.id)))
    .filter((it) => !area || it.area === area)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return (
    <>
      <p className="sc-note">Lo que el motor sabe de cada tarea. Aquí solo se guardan los atributos extra: el título, el día y el área se editan donde siempre. Lo que lleva un tiempo marcado en el calendario cuenta como fijo salvo que lo marques como movible.</p>
      <div className="sc-filters">
        <div className="ap-seg">
          {[['week', 'Esta semana'], ['later', 'Más adelante'], ['all', 'Todas']].map(([v, l]) => <button key={v} aria-pressed={scope === v} onClick={() => { setScope(v); setLimit(30); }}>{l}</button>)}
        </div>
        <select value={area} onChange={(e) => { setArea(e.target.value); setLimit(30); }} aria-label="Filtrar por área">
          <option value="">Todas las áreas</option>
          {plan.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="sc-stat">{rows.length} tareas{scope === 'week' && !includeLater ? '' : ''}</span>
      </div>
      <div className="sc-stack">
        {rows.slice(0, limit).map((it) => {
          const a = attrsOf(cfg, it.id);
          const timed = typeof it.at === 'number' && /^\d{4}/.test(it.day || '') && it.day >= today;
          const p = `attrs.${it.id}`;
          return (
            <div className="sc-card" key={it.id}>
              <div className="sc-head">
                <i className="sc-dot" style={{ background: colorOf(it.area) }} />
                <b className="sc-ttl">{it.text}</b>
                <span className="sc-stat">{areaById[it.area] ? areaById[it.area].name : ''} · {it.day === 'later' ? 'más adelante' : dayLabel(it.day)}</span>
              </div>
              <div className="sc-grid">
                <Field label="Prioridad 1–5" tag="on"><In cfg={cfg} patch={patch} path={`${p}.prio`} value={a.prio} type="select" num options={[1, 2, 3, 4, 5].map((x) => [x, String(x)])} /></Field>
                <Field label="Esfuerzo" tag="on"><In cfg={cfg} patch={patch} path={`${p}.effort`} value={a.effort} type="select" options={Object.entries(EFFORT).map(([k, v]) => [k, v.label])} /></Field>
                <Field label="Duración (min)" tag="on"><In cfg={cfg} patch={patch} path={`${p}.dur`} value={a.dur || it.dur || 60} type="number" min={5} max={600} step={5} /></Field>
                <Field label="Fecha límite" tag="on"><In cfg={cfg} patch={patch} path={`${p}.dl`} value={a.dl || ''} type="date" /></Field>
                <Field label="Lugar" tag="on"><In cfg={cfg} patch={patch} path={`${p}.place`} value={a.place} type="select" options={cfg.profile.places.map((x) => [x.name, x.name])} /></Field>
                <Field label="No antes de" tag="on"><In cfg={cfg} patch={patch} path={`${p}.notBefore`} value={a.notBefore || ''} type="date" /></Field>
              </div>
              <div className="sc-chips2">
                <In cfg={cfg} patch={patch} path={`${p}.dlHard`} value={!!a.dlHard} type="checkbox" label="Límite duro" />
                {timed && <In cfg={cfg} patch={patch} path={`${p}.flex`} value={!!a.flex} type="checkbox" label="Movible (aunque tenga hora)" />}
              </div>
              <details className="sc-more">
                <summary>Más atributos <Tag kind="plan" /></summary>
                <div className="sc-grid">
                  <Field label="Divisible" tag="plan"><In cfg={cfg} patch={patch} path={`${p}.split`} value={!!a.split} type="checkbox" label="Se puede partir" /></Field>
                  <Field label="Bloque mínimo (min)" tag="plan"><In cfg={cfg} patch={patch} path={`${p}.chunk`} value={a.chunk || 30} type="number" min={15} max={240} step={15} /></Field>
                  <Field label="Depende de" tag="plan">
                    <In cfg={cfg} patch={patch} path={`${p}.dep`} value={a.dep || ''} type="select" options={[['', '—'], ...open.filter((o) => o.id !== it.id).slice(0, 80).map((o) => [o.id, o.text])]} />
                  </Field>
                </div>
              </details>
            </div>
          );
        })}
        {!rows.length && <div className="sc-empty">No hay tareas en esta vista.</div>}
        {rows.length > limit && <div><button className="ap-btn" onClick={() => setLimit(limit + 30)}>Mostrar más ({rows.length - limit})</button></div>}
      </div>
    </>
  );
}

/* ---------- shared decision views ---------- */
function Decisions({ res, selId, setSelId, baseSig }) {
  return (
    <div className="sc-dec">
      {res.placed.map((p) => {
        const at = slotKey(res.G, p.choice);
        const ch = baseSig && baseSig[p.task.id] && baseSig[p.task.id] !== at;
        return (
          <button key={p.task.id} className={`sc-drow${ch ? ' chg' : ''}${selId === p.task.id ? ' sel' : ''}`} onClick={() => setSelId(p.task.id)}>
            <span className="sc-n">#{p.rank + 1}</span><span className="sc-tt">{p.task.title}</span>
            <span className="sc-at">{dayLabel(at.slice(0, 10))} {at.slice(11)}{ch ? ` (antes ${dayLabel(baseSig[p.task.id].slice(0, 10))} ${baseSig[p.task.id].slice(11)})` : ''}</span>
          </button>
        );
      })}
      {res.unplaced.map((p) => (
        <button key={p.task.id} className={`sc-drow no${selId === p.task.id ? ' sel' : ''}`} onClick={() => setSelId(p.task.id)}>
          <span className="sc-n">#{p.rank + 1}</span><span className="sc-tt">{p.task.title}</span><span className="sc-at">no cabe</span>
        </button>
      ))}
      {!res.placed.length && !res.unplaced.length && <div className="sc-empty">No hay tareas pendientes que colocar.</div>}
    </div>
  );
}

function PartsTable({ parts }) {
  const max = Math.max(0.0001, ...parts.map((p) => Math.abs(p.contrib)));
  return (
    <table className="sc-parts">
      <thead><tr><th>Factor</th><th>Valor</th><th>Peso</th><th>Aporte</th><th /></tr></thead>
      <tbody>
        {parts.map((p) => (
          <tr key={p.id}>
            <td>{p.label}</td><td className="n">{p.value.toFixed(2)}</td><td className="n">{p.weight}</td>
            <td className="n">{p.contrib >= 0 ? '+' : ''}{p.contrib.toFixed(1)}</td>
            <td style={{ width: '32%' }}><div className={`sc-cb${p.contrib < 0 ? ' neg' : ''}`} style={{ width: `${(Math.abs(p.contrib) / max) * 100}%` }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Detail({ res, selId }) {
  const p = res.placed.find((x) => x.task.id === selId);
  const u = res.unplaced.find((x) => x.task.id === selId);
  if (!p && !u) return <div className="sc-empty">Elige una decisión para ver el porqué.</div>;
  const t = (p || u).task; const urg = (p || u).urgency;
  return (
    <div className="sc-detail">
      <h3>{t.title}</h3>
      <div className="sc-stat">prioridad {t.prio} · {EFFORT[t.effort].label.toLowerCase()} · {t.dur} min{t.dl ? ` · límite ${dayLabel(t.dl)}${t.dlHard ? ' (duro)' : ''}` : ''}</div>
      <div className="sc-stage">A · Turno #{(p || u).rank + 1}</div>
      <PartsTable parts={urg.parts} />
      <div className="sc-stat">Urgencia total: <b>{urg.total.toFixed(1)}</b></div>
      {u && <><div className="sc-stage">B · Sin hueco</div><div className="sc-empty">{u.reason} Propuesta: pasa a “Más adelante” y avisa; si el límite es duro, hay un conflicto que decidir.</div></>}
      {p && (
        <>
          <div className="sc-stage">B · Por qué {dayLabel(res.G.days[p.choice.d])} {fmtMin(p.choice.start)}–{fmtMin(p.choice.start + p.task.effDur)}</div>
          <PartsTable parts={p.choice.parts} />
          <div className="sc-stat">Puntuación: <b>{p.choice.total.toFixed(1)}</b> · {p.candidates} huecos válidos{p.commute ? ` · incluye ${p.commute} min de traslado` : ''}</div>
          {p.alts.length > 0 && (
            <>
              <div className="sc-stage">Alternativas descartadas</div>
              {p.alts.map((a, i) => {
                const top = a.parts.map((q, k) => ({ label: q.label, d: q.contrib - p.choice.parts[k].contrib })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
                return <div className="sc-alt" key={i}><span>{dayLabel(res.G.days[a.d])} {fmtMin(a.start)}</span><span className="sc-mono">Δ {(a.total - p.choice.total).toFixed(1)} · sobre todo: {top.label} ({top.d >= 0 ? '+' : ''}{top.d.toFixed(1)})</span></div>;
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Pesos ---------- */
function WeightsPanel({ cfg, patch, update, res, selId, setSelId, baseSig, setBaseSig }) {
  const slider = (w) => (
    <div className="sc-sl" key={w.id}>
      <div className="sc-slt"><span>{w.label} <Tag kind="on" /></span><b>{cfg.weights[w.id]}</b></div>
      <In cfg={cfg} patch={patch} path={`weights.${w.id}`} type="range" min={0} max={100} step={5} />
      <div className="sc-h">{w.hint}</div>
    </div>
  );
  return (
    <>
      <p className="sc-note">El motor decide en dos pasos. <b>A</b>: quién elige primero. <b>B</b>: en qué hueco cae cada tarea. Mueve un peso y mira a la derecha qué decisiones cambian (resaltadas).</p>
      <div className="sc-cols">
        <div className="sc-stack">
          <Win title="A · Quién va primero">{WEIGHTS.filter((w) => w.stage === 'A').map(slider)}</Win>
          <Win title="B · Dónde cae">{WEIGHTS.filter((w) => w.stage === 'B').map(slider)}</Win>
          <Win title="Todavía sin cablear">{PLANNED.map(([a, b]) => <div key={a}><b>{a}</b> <Tag kind="plan" /><div className="sc-stat">{b}</div></div>)}</Win>
          <div><button className="ap-btn" onClick={() => update((c) => { c.weights = Object.fromEntries(WEIGHTS.map((w) => [w.id, w.def])); return c; })}>Restablecer pesos</button></div>
        </div>
        <div className="sc-stack">
          <Win title="Decisiones" extra={<button className="ap-btn" onClick={() => setBaseSig(signature(res))}>Fijar como referencia</button>}>
            <Decisions res={res} selId={selId} setSelId={setSelId} baseSig={baseSig} />
          </Win>
        </div>
      </div>
    </>
  );
}

/* ---------- Simulación ---------- */
function Week({ res, selId, setSelId, colorOf }) {
  const { G, placed } = res;
  const own = G.days.map(() => Array(G.n).fill(null));
  placed.forEach((p) => { for (let k = p.choice.k0; k < p.choice.k0 + p.need; k++) own[p.choice.d][k] = { p, first: k === p.choice.k0 }; });
  const cells = [<div className="sc-dh" key="c" />];
  G.days.forEach((d, i) => cells.push(<div className={`sc-dh${i === 0 ? ' today' : ''}`} key={d}>{dayLabel(d)}{i === 0 ? ' · hoy' : ''}</div>));
  for (let k = 0; k < G.n; k++) {
    cells.push(<div className="sc-hr" key={`h${k}`}>{k % 2 === 0 ? fmtMin(G.wake + k * SLOT) : ''}</div>);
    for (let d = 0; d < G.days.length; d++) {
      const o = own[d][k]; const b = G.blocked[d][k]; const key = `${d}-${k}`;
      if (o) {
        cells.push(<div key={key} className={`sc-c tk${selId === o.p.task.id ? ' sel' : ''}`} style={{ '--ac': colorOf(o.p.task.area) }} onClick={() => setSelId(o.p.task.id)} title={o.p.task.title}>{o.first ? o.p.task.title : ''}</div>);
        continue;
      }
      if (b) {
        const kind = b.startsWith('fijo:') ? 'fix' : b === 'comida' ? 'meal' : b === 'traslado' ? 'trav' : b === 'colchón' ? 'buf' : b === 'descanso' ? 'rest' : b === 'pasado' ? 'past' : 'out';
        const first = kind === 'fix' && !(k > 0 && G.blocked[d][k - 1] === b);
        cells.push(<div key={key} className={`sc-c ${kind}`} title={b.replace('fijo:', '')}>{first ? b.slice(5) : ''}</div>);
        continue;
      }
      cells.push(<div key={key} className={`sc-c ${res.used[d][k] === 'buf' ? 'buf' : 'free'}`} />);
    }
  }
  return (
    <>
      <div className="sc-wk"><div className="sc-wkg">{cells}</div></div>
      <div className="sc-legend">
        <span><i className="free" />libre</span><span><i className="tk" />tarea colocada</span><span><i className="fix" />fijo</span><span><i className="meal" />comida</span>
        <span><i className="trav" />traslado</span><span><i className="out" />fuera de horario / descanso / pasado</span><span><i className="buf" />colchón</span>
      </div>
    </>
  );
}

function SimPanel({ res, selId, setSelId, colorOf, includeLater, setIncludeLater }) {
  return (
    <>
      <p className="sc-note">Lo que el motor haría hoy con tus tareas pendientes en los próximos 7 días. Es una propuesta: no cambia tu calendario. Pulsa un bloque o una decisión para ver por qué.</p>
      <div className="sc-filters">
        <span className="sc-chk"><input type="checkbox" checked={includeLater} onChange={(e) => setIncludeLater(e.target.checked)} /> Incluir “Más adelante”</span>
        <span className="sc-stat">{res.placed.length} colocadas · {res.unplaced.length} sin hueco · {freeHours(res.G).toFixed(1)} h libres</span>
      </div>
      <div className="sc-cols sim">
        <div className="sc-stack"><Week res={res} selId={selId} setSelId={setSelId} colorOf={colorOf} /></div>
        <div className="sc-stack">
          <Win title="Decisiones"><Decisions res={res} selId={selId} setSelId={setSelId} /></Win>
          <Win title="Por qué"><Detail res={res} selId={selId} /></Win>
        </div>
      </div>
    </>
  );
}
