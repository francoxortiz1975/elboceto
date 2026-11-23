import React, { useState, useEffect, useMemo, useRef } from 'react';
import { isoOf } from '../lib/areaPlan';
import {
  devStacks, addDevStack, editDevItem, moveDevStack, removeDevItem, migrateToDev, needsDeploy, toggleDevDone, setDevValid, reportOf, parseReport,
  setDevTime, setDevLaunch, ticketStatus, ticketTimeline, arrivedAt, scheduledISO, fmtWhen, whenOptions, scheduleStack, requestCorrection,
  validateAndDeploy, launchNow, setNoDeploy, requestDeploy, applyDeploys, isUnread, needsMe, markSeen, queueOrder, closeWithoutDeploy
} from '../lib/devStacks';
import { filesOf, fileName, docPathsIn, extOf, MIME } from '../lib/devFiles';
import { defaultPrompt, promptFor, isEdited, setLaunchPrompt, approxTokens } from '../lib/irisPrompt';
import { DecisionsModal, FileModal } from './TicketsExtras';
import { codeConfig, codeOf, assignCode, addModification, suggestModule, bulkAssign } from '../lib/devCodes';
import './TicketsPage.css';

const AREA_KEY = 'el_boceto_tickets_area_v1';
const FILTERS = [['all', 'Activos', 'd-black'], ['pend', 'Pendiente', 'd-gray'], ['black', 'Agendado', 'd-black'], ['wait', 'Esperando', 'd-orange'], ['bad', 'Error', 'd-red'], ['ok', 'Cerrado', 'd-green']];
const bucketOf = (tone) => ({ gray: 'pend', black: 'black', orange: 'wait', red: 'bad', green: 'ok' })[tone] || 'pend';
const STATUS_ORDER = ['missed', 'deployfail', 'done', 'running', 'deploying', 'scheduled', 'pending', 'validated', 'deployed'];

// The tickets console (/tickets): the same plan as the planner, shown as a frosted-glass dashboard for supervising IRIS work.
// Opens a ticket with /tickets/<CODE>.
export function TicketsPage({ plan, onChange, user }) {
  const [areaId, setAreaId] = useState(() => {
    let saved = '';
    try { saved = localStorage.getItem(AREA_KEY) || ''; } catch { /* storage unavailable */ }
    return plan.areas.some((a) => a.id === saved) ? saved : ((plan.areas.find((a) => /medilyft/i.test(a.name)) || plan.areas[0] || {}).id || '');
  });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('cola');
  const [ref, setRef] = useState(() => (window.location.pathname.split('/')[2] || '').toLowerCase()); // code or id from the URL
  const [mode, setMode] = useState(null); // null | 'correct' | 'schedule'
  const [corr, setCorr] = useState('');
  const [whenKey, setWhenKey] = useState('now');
  const [whenDay, setWhenDay] = useState(() => isoOf(new Date()));
  const [whenTime, setWhenTime] = useState('22:00');
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMod, setNewMod] = useState('');
  const [decFor, setDecFor] = useState(null); // ticket whose decisions are being answered
  const [fileView, setFileView] = useState(null);
  const toastTimer = useRef(null);
  const mutate = (fn) => onChange((p) => fn(p));

  useEffect(() => { const h = () => setRef((window.location.pathname.split('/')[2] || '').toLowerCase()); window.addEventListener('popstate', h); return () => window.removeEventListener('popstate', h); }, []);
  // A finished "subir a main" block marks its feature as deployed; open work of the area becomes tickets (both once).
  useEffect(() => { if (applyDeploys(plan) !== plan) onChange((p) => applyDeploys(p)); }, [plan, onChange]);
  useEffect(() => { if (areaId && migrateToDev(plan, areaId) !== plan) onChange((p) => migrateToDev(p, areaId)); }, [plan, areaId, onChange]);

  const all = useMemo(() => devStacks(plan, areaId), [plan, areaId]);
  const cfg = codeConfig(plan, areaId);
  const sel = ref ? all.find((st) => st.id.toLowerCase() === ref || codeOf(st.main).toLowerCase() === ref) || null : null;
  useEffect(() => { setMode(null); setCorr(''); setMsg(''); setWhenKey(whenOptions(new Date())[0].key); }, [sel && sel.id]);

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ } document.body.removeChild(ta);
    }
    say(`${what} copiado`);
  };
  const download = (f) => {
    let blob;
    if (f.b64) { const bin = atob(f.b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i); blob = new Blob([arr], { type: f.mime || MIME[extOf(f.path)] || 'application/octet-stream' }); }
    else blob = new Blob([f.text || ''], { type: MIME[extOf(f.path)] || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName(f.path); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reportAsText = (st, rep) => {
    const part = (title, items, numbered) => (items.length ? `\n${title}\n${items.map((v, i) => (numbered ? `${i + 1}. ${v}` : `- ${v}`)).join('\n')}\n` : '');
    return [`${codeOf(st.main) || 'Ticket'} · ${st.main.text}`, rep.summary ? `\n${rep.summary}` : '', part('Qué se hizo', rep.done), part('Cómo comprobarlo', rep.verify, true), part('Decisiones', rep.decisions), part('Pendiente', rep.pending), (rep.branch || rep.commit) ? `\n${rep.branch}${rep.commit ? ` · ${rep.commit}` : ''}` : ''].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  useEffect(() => { if (sel && isUnread(plan, sel)) onChange((p) => markSeen(p, sel.id)); }, [sel && sel.id, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const say = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2400); };
  const open = (st) => { const r = st ? (codeOf(st.main) || st.id) : ''; window.history.pushState(null, '', r ? `/tickets/${r}` : '/tickets'); setRef(r.toLowerCase()); };
  const pickArea = (v) => { setAreaId(v); open(null); try { localStorage.setItem(AREA_KEY, v); } catch { /* storage unavailable */ } };

  const info = (st) => ({ ts: ticketStatus(plan, st), sch: scheduledISO(st.main), arr: arrivedAt(plan, st) });
  const counts = useMemo(() => {
    const n = { pend: 0, black: 0, wait: 0, bad: 0, ok: 0 };
    all.forEach((st) => { n[bucketOf(ticketStatus(plan, st).tone)] += 1; });
    return { ...n, all: all.length - n.ok };
  }, [all, plan]);
  const waiting = counts.wait;
  // Execution order: what is running and what will start next (the same rule the launcher uses)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 30000); return () => clearInterval(t); }, []);
  const qinfo = useMemo(() => {
    const qo = queueOrder(plan, new Date(nowMs));
    const stackOf = (id) => { const it = plan.items.find((i) => i.id === id); if (!it) return null; const sid = it.deploy ? it.deploy.stack : it.id; const st = all.find((x) => x.id === sid); return st ? { st, deploy: !!it.deploy } : null; };
    const queue = qo.queue.map(stackOf).filter(Boolean);
    const running = qo.running.map(stackOf).filter(Boolean);
    const pos = new Map(queue.map((q, i) => [q.st.id, i + 1]));
    return { queue, running, pos };
  }, [plan, all, nowMs]);
  // News not opened yet: bold in the list. Of those, the ones that need an answer also raise the tab count and a browser notification.
  const unread = useMemo(() => new Set(all.filter((st) => isUnread(plan, st)).map((st) => st.id)), [all, plan]);
  const needing = useMemo(() => all.filter((st) => unread.has(st.id) && needsMe(plan, st)), [all, plan, unread]);
  useEffect(() => { document.title = needing.length ? `(${needing.length}) Tickets` : 'Tickets'; }, [needing.length]);
  const prevNeeding = useRef(null);
  useEffect(() => {
    const ids = new Set(needing.map((st) => st.id));
    if (prevNeeding.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      needing.filter((st) => !prevNeeding.current.has(st.id)).slice(0, 3).forEach((st) => { try { new Notification(`${codeOf(st.main) || 'Ticket'} necesita tu respuesta`, { body: st.main.text }); } catch { /* notifications unavailable */ } });
    }
    prevNeeding.current = ids;
  }, [needing]);
  const [notifPerm, setNotifPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'));

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = all.filter((st) => {
      const b = bucketOf(ticketStatus(plan, st).tone);
      return (filter === 'all' ? b !== 'ok' : b === filter) && (!ql || `${codeOf(st.main)} ${st.main.text}`.toLowerCase().includes(ql));
    });
    const val = (st) => {
      if (sort === 'cola') return qinfo.running.some((r) => r.st.id === st.id) ? 'a000' : qinfo.pos.has(st.id) ? `a${String(qinfo.pos.get(st.id)).padStart(3, '0')}` : (scheduledISO(st.main) ? `b${scheduledISO(st.main)}` : 'c'); // running, then the queue, then by date, then undated
      if (sort === 'prog') return scheduledISO(st.main) || '~';
      if (sort === 'estado') return String(STATUS_ORDER.indexOf(ticketStatus(plan, st).key)).padStart(2, '0');
      return arrivedAt(plan, st) || '';
    };
    const dir = sort === 'llego' ? -1 : 1;
    return list.slice().sort((a, b) => {
      const x = val(a); const y = val(b);
      const ex = !x || x === '~'; const ey = !y || y === '~';
      if (ex !== ey) return ex ? 1 : -1;
      return x.localeCompare(y) * dir;
    });
  }, [all, plan, filter, q, sort, qinfo]);

  const resolveWhen = () => {
    if (whenKey === 'custom') {
      const m = /^(\d{1,2}):(\d{2})$/.exec(whenTime || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(whenDay || '') || !m) { setMsg('Elige el día y la hora.'); return null; }
      return { day: whenDay, at: Number(m[1]) * 60 + Number(m[2]) };
    }
    const o = whenOptions(new Date()).find((x) => x.key === whenKey) || whenOptions(new Date())[0];
    return { day: o.day, at: o.at };
  };
  const pushMain = (st, retry) => {
    if (!window.confirm(`Subir ${codeOf(st.main) || st.main.text} a main?\n\nLa conversación del área hará merge de su rama a main, push y comprobará el despliegue en producción. Se lanza ahora, solo para esto.`)) return;
    const out = requestDeploy(plan, st.id);
    if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); say(retry ? 'Reintentando la subida a main' : 'Subiendo a main'); }
  };
  const validate = (st) => {
    if (needsDeploy(st.main)) {
      if (!window.confirm(`Validar y subir ${codeOf(st.main) || st.main.text} a main?\n\nLa conversación del área hará merge de su rama a main, push y comprobará el despliegue en producción. Se lanza ahora, solo para esto.`)) return;
      const out = validateAndDeploy(plan, st.id);
      if (out.error) { setMsg(out.error); return; }
      setMsg(''); mutate(() => out.plan); say('Validado · subiendo a main');
    } else { mutate((p) => setDevValid(p, st.id, true)); say('Validado'); }
  };

  const justClose = (st) => { mutate((p) => closeWithoutDeploy(p, st.id)); say('Cerrado, sin subir nada'); };
  const closeLink = (st, text = 'Solo cerrar, sin subir nada') => <button className="tk-link" onClick={() => justClose(st)}>{text}</button>;

  const picker = (label, onConfirm) => (
    <>
      <div className="tk-label">¿Cuándo?</div>
      <div className="tk-chips">
        {whenOptions(new Date()).map((o) => <button key={o.key} className="tk-chip" aria-pressed={whenKey === o.key} onClick={() => setWhenKey(o.key)}>{o.label}</button>)}
        <button className="tk-chip" aria-pressed={whenKey === 'custom'} onClick={() => setWhenKey('custom')}>Elegir día y hora…</button>
      </div>
      {whenKey === 'custom' && <div className="tk-custom"><input type="date" value={whenDay} onChange={(e) => setWhenDay(e.target.value)} aria-label="Día" /><input type="time" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} aria-label="Hora" /></div>}
      <button className="tk-btn dark" onClick={() => { const w = resolveWhen(); if (w) onConfirm(w); }}>{label}</button>
    </>
  );

  const actions = (st, ts) => {
    const m = st.main;
    const qs = parseReport(reportOf(plan, st.id)).decisionQs || [];
    const decBtn = qs.length > 0 ? <button className="tk-btn orange" onClick={() => setDecFor(st.id)}>Revisar {qs.length} {qs.length === 1 ? 'decisión' : 'decisiones'} del agente</button> : null;
    if (mode === 'correct') {
      return (
        <div className="tk-act">
          <div className="tk-label">¿Qué hay que corregir?</div>
          <textarea className="tk-corr" autoFocus value={corr} onChange={(e) => setCorr(e.target.value)} placeholder="Escribe con tus palabras…" aria-label="Qué hay que corregir" />
          {picker('Enviar corrección', (w) => {
            const out = requestCorrection(plan, st.id, { text: corr, day: w.day, at: w.at });
            if (out.error) { setMsg(out.error); return; }
            setMsg(''); mutate(() => out.plan); setMode(null); setCorr(''); say(`Corrección enviada · v${out.rev}`);
          })}
          <button className="tk-link" onClick={() => setMode(null)}>Cancelar</button>
        </div>
      );
    }
    if (mode === 'schedule') return <div className="tk-act">{picker('Agendar', (w) => { mutate((p) => scheduleStack(p, st.id, w)); setMode(null); say('Agendado'); })}<button className="tk-link" onClick={() => setMode(null)}>Cancelar</button></div>;
    if (ts.key === 'done') {
      return (
        <div className="tk-act">
          {decBtn}
          <div className="tk-two"><button className="tk-btn go" onClick={() => validate(st)}>✓ Validar</button><button className="tk-btn" onClick={() => setMode('correct')}>✎ Corrección</button></div>
          <div className="tk-hint">{needsDeploy(m) ? 'Validar lo sube a main y lo cierra.' : 'Validar lo da por cerrado.'}</div>
        </div>
      );
    }
    if (ts.key === 'running' && m.iris && m.iris.ended) {
      return (
        <div className="tk-act">
          <div className="tk-hint">El agente terminó y lo dejó abierto: necesita algo de ti. Lee su informe abajo.</div>
          {decBtn}
          <div className="tk-two"><button className="tk-btn" onClick={() => setMode('correct')}>✎ Corrección</button><button className="tk-btn go" onClick={() => mutate((p) => toggleDevDone(p, st.id))}>✓ Darlo por hecho</button></div>
        </div>
      );
    }
    if (ts.key === 'validated' && ts.action === 'deploy') return <div className="tk-act"><button className="tk-btn go" onClick={() => pushMain(st, false)}>Subir a main</button></div>;
    if (ts.key === 'pending' || ts.key === 'missed') return <div className="tk-act">{ts.key === 'missed' && <div className="tk-hint">No llegó a abrirse. Agéndalo de nuevo.</div>}{picker('Agendar', (w) => { mutate((p) => scheduleStack(p, st.id, w)); say('Agendado'); })}</div>;
    if (ts.key === 'scheduled') return <div className="tk-act"><div className="tk-two"><button className="tk-btn dark" onClick={() => { mutate((p) => launchNow(p, st.id)); say('Lanzado'); }}>Lanzar ahora</button><button className="tk-btn" onClick={() => setMode('schedule')}>Cambiar horario</button></div></div>;
    if (ts.key === 'deployfail') return <div className="tk-act"><div className="tk-hint">La subida a main no terminó. Puedes reintentarla o cerrar el ticket sin subir nada.</div><button className="tk-btn dark" onClick={() => pushMain(st, true)}>Reintentar subida a main</button></div>;
    if (ts.key === 'running') return <div className="tk-act"><div className="tk-hint">El agente está trabajando en esto.</div></div>;
    if (ts.key === 'deploying') return <div className="tk-act"><div className="tk-hint">{ts.label === 'En cola para subir a main' ? 'La subida espera su turno.' : 'Subiendo a main…'}</div></div>;
    return <div className="tk-act"><div className="tk-hint">Cerrado y en main.</div></div>;
  };

  // What the agent will receive, shown (and editable) until the block is launched
  const promptBox = (st) => {
    const m = st.main;
    if (m.done || (m.iris && m.iris.state === 'launched')) return null;
    const b = m.iris && m.iris.launch && m.iris.batch;
    const mates = b ? all.filter((x) => x.main.iris && x.main.iris.launch && x.main.iris.batch === b).sort((x, y) => (x.main.at || 0) - (y.main.at || 0)).map((x) => x.main) : [m];
    const lead = mates[0];
    const isLead = lead.id === m.id;
    const def = defaultPrompt(plan, mates, areaName);
    const cur = promptFor(plan, mates, areaName);
    return (
      <div className="tk-prompt">
        <div className="tk-rephd"><h3>Lo que recibirá el agente</h3><span className="tk-tok">~{approxTokens(cur)} tokens</span></div>
        <textarea className="tk-ptext" value={cur} readOnly={!isLead} aria-label="Texto que recibirá el agente" spellCheck={false}
          onChange={(e) => mutate((p) => setLaunchPrompt(p, lead.id, e.target.value, def))} />
        <div className="tk-pfoot">
          {isEdited(lead) && <span className="tk-edited">Editado a mano</span>}
          {!isLead && <span className="tk-hint">Va en un lote: el texto se edita en el primero ({codeOf(lead) || lead.text.slice(0, 20)}).</span>}
          {!b && <span className="tk-hint">Si hay otros bloques seguidos de esta noche, irán en este mismo mensaje.</span>}
          <button className="tk-link" onClick={() => copy(cur, 'Texto')}>Copiar</button>
          {isEdited(lead) && isLead && <button className="tk-link" onClick={() => mutate((p) => setLaunchPrompt(p, lead.id, '', def))}>Restaurar el texto por defecto</button>}
        </div>
      </div>
    );
  };
  const panel = (st) => {
    const { ts } = info(st);
    const m = st.main;
    const raw = reportOf(plan, st.id);
    const rep = parseReport(raw);
    const tl = ticketTimeline(plan, st);
    const cur = tl.findIndex((x) => !x.done);
    const files = filesOf(plan, st.id);
    const mentioned = docPathsIn(`${raw}\n${m.note || ''}`);
    const sec = (title, items, ordered) => (items.length ? <><h4>{title}</h4>{ordered ? <ol>{items.map((v, i) => <li key={i}>{v}</li>)}</ol> : <ul>{items.map((v, i) => <li key={i}>{v}</li>)}</ul>}</> : null);
    return (
      <aside className="tk-glass tk-panel" aria-label={`Ticket ${codeOf(m) || ''}`}>
        <div className="tk-hd">
          <span className="tk-code">{codeOf(m) || 'Sin código'}{(m.dev.rev || 1) > 1 && <span className="tk-rev">v{m.dev.rev}</span>}</span>
          <span className={`tk-pill p-${ts.tone}`}>{qinfo.pos.has(st.id) ? `En cola · ${qinfo.pos.get(st.id)}º` : ts.label}</span>
          <button className="tk-x" aria-label="Cerrar el panel" onClick={() => open(null)}>×</button>
        </div>
        <input className="tk-title" value={m.text} aria-label="Título" onChange={(e) => mutate((p) => editDevItem(p, st.id, { text: e.target.value }))} />
        {msg && <div className="tk-msg" role="status">{msg}</div>}
        {actions(st, ts)}
        {ts.tone !== 'green' && !mode && (
          <button className="tk-link tk-closeall" title="Pasa el ticket a Cerrado ahora mismo. No sube nada y cancela cualquier subida en cola." onClick={() => { if (ts.key === 'running' && !(m.iris && m.iris.ended) && !window.confirm('El agente todavía está trabajando en esto. Cerrarlo no lo detiene. ¿Cerrar de todos modos?')) return; justClose(st); }}>Cerrar directamente, sin subir nada</button>
        )}
        {promptBox(st)}
        <div>
          <h3>Historial</h3>
          <ul className="tk-tl">
            {tl.map((x, i) => (
              <li key={x.key} className={x.done ? 'done' : i === cur ? 'now' : ''}><i /><div><div className="l">{x.label}</div><div className="d">{x.at ? `${fmtWhen(x.at)}${x.planned ? ' · previsto' : ''}` : x.done ? 'sin fecha registrada' : '—'}</div></div></li>
            ))}
          </ul>
          {(m.dev.revisions || []).map((r) => <div key={r.n} className="tk-revi"><b>v{r.n}</b> · {fmtWhen(r.at)}<p>{r.text}</p></div>)}
        </div>
        {raw && (
          <div className="tk-rep">
            <div className="tk-rephd"><h3>Informe</h3><button className="tk-copy" onClick={() => copy(reportAsText(st, rep), 'Informe')}>Copiar informe</button></div>
            {rep.summary && <p className="lead">{rep.summary}</p>}
            {rep.verify.length > 0 && <><div className="tk-lab">Para comprobarlo</div><ol>{rep.verify.map((v, i) => <li key={i}>{v}</li>)}</ol></>}
            {rep.decisionQs && rep.decisionQs.length > 0 && <><div className="tk-lab">Decisiones que tomó el agente ({rep.decisionQs.length})</div><ul>{rep.decisionQs.map((d, i) => { const c = d.options.find((o) => o.k === d.chosen); return <li key={i}>{d.q}{c ? <> → <b>{c.text}</b></> : null}</li>; })}</ul></>}
            {rep.pending.length > 0 && <><div className="tk-lab">Pendiente</div><ul>{rep.pending.map((v, i) => <li key={i}>{v}</li>)}</ul></>}
            {rep.done.length > 0 && <details className="tk-more"><summary>Qué se hizo</summary><ul>{rep.done.map((v, i) => <li key={i}>{v}</li>)}</ul></details>}
            {(rep.branch || rep.commit) && <div className="tk-mono">{rep.branch}{rep.commit ? ` · ${rep.commit}` : ''}</div>}
          </div>
        )}
        {(files.length > 0 || mentioned.length > 0) && (
          <div>
            <h3>Archivos</h3>
            <div className="tk-files">
              {files.map((f) => (
                <div key={f.path} className="tk-file">
                  <div className="tk-fn"><b>{fileName(f.path)}</b><span className="tk-ext">{extOf(f.path)}</span><small>{f.path}</small></div>
                  <div className="tk-fb">
                    {(f.text || f.b64) && f.kind !== 'text' && <button onClick={() => setFileView(f)}>Ver</button>}
                    {(f.text || f.b64) && f.kind === 'text' && <button onClick={() => setFileView(f)}>Ver</button>}
                    {(f.text || f.b64) && <button onClick={() => download(f)}>Descargar</button>}
                    <button onClick={() => copy(f.abs, 'Ruta')}>Copiar ruta</button>
                  </div>
                  {f.missing && <small className="tk-fm">No se pudo leer: ¿está en la rama del ticket?</small>}
                  {f.tooBig && <small className="tk-fm">Pesa {Math.round((f.bytes || 0) / 1024)} KB: demasiado para guardarlo aquí. Copia la ruta y ábrelo en tu Mac.</small>}
                </div>
              ))}
              {mentioned.filter((p) => !files.some((f) => f.path === p)).map((p) => (
                <div key={p} className="tk-file">
                  <div className="tk-fn"><b>{fileName(p)}</b><small>{p}</small></div>
                  <div className="tk-fb"><button onClick={() => copy(p, 'Ruta')}>Copiar ruta</button></div>
                  <small className="tk-fm">Aún no se ha leído; aparecerá en un par de minutos.</small>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <h3>Comentarios</h3>
          <textarea className="tk-note" value={m.note || ''} placeholder="Notas, decisiones, enlaces, qué falta…" aria-label="Comentarios" onChange={(e) => mutate((p) => editDevItem(p, st.id, { note: e.target.value }))} />
        </div>
        <details className="tk-adv">
          <summary>Más opciones</summary>
          <div className="tk-advrow">
            {cfg && (
              <select value={m.dev.mod || ''} disabled={!!codeOf(m)} aria-label="Módulo" title={codeOf(m) ? 'El código no cambia' : 'Elige el módulo: se le asigna su código'}
                onChange={(e) => { if (!e.target.value) return; const out = assignCode(plan, st.id, e.target.value); if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); } }}>
                <option value="">{suggestModule(m.text, areaId, plan) ? `Sin código · sugerido ${suggestModule(m.text, areaId, plan)}` : 'Sin código'}</option>
                {Object.entries(cfg.modules).map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}
              </select>
            )}
            <input type="date" value={/^\d{4}/.test(m.day || '') ? m.day : ''} aria-label="Día" onChange={(e) => e.target.value && mutate((p) => moveDevStack(p, st.id, e.target.value))} />
            <input type="time" value={typeof m.at === 'number' ? `${String(Math.floor(m.at / 60)).padStart(2, '0')}:${String(m.at % 60).padStart(2, '0')}` : ''} aria-label="Hora"
              onChange={(e) => { const [h, mm] = (e.target.value || '').split(':').map(Number); mutate((p) => setDevTime(p, st.id, Number.isFinite(h) ? h * 60 + mm : null)); }} />
            <label className="tk-check"><input type="checkbox" checked={!!(m.iris && m.iris.launch)} disabled={typeof m.at !== 'number' || !/^\d{4}/.test(m.day || '')} onChange={(e) => mutate((p) => setDevLaunch(p, st.id, e.target.checked))} /> Lanzar solo a esa hora</label>
          </div>
          <div className="tk-advrow">
            {codeOf(m) && <button className="tk-link" onClick={() => { const name = window.prompt(`Modificación de ${codeOf(m)}: ¿qué cambia?`); if (!name) return; const out = addModification(plan, st.id, name, { day: m.day }); if (out.error) setMsg(out.error); else { setMsg(''); mutate(() => out.plan); say('Modificación creada'); } }}>+ Modificación</button>}
            <button className="tk-link" onClick={() => { if (window.confirm('¿Quitar el ticket completo?')) { mutate((p) => removeDevItem(p, st.id)); open(null); } }}>Quitar ticket</button>
          </div>
        </details>
      </aside>
    );
  };

  const uncoded = cfg ? all.filter((st) => !codeOf(st.main) && suggestModule(st.main.text, areaId, plan)).length : 0;
  const areaName = (plan.areas.find((a) => a.id === areaId) || {}).name || 'Tickets';

  return (
    <div className="tk-root">
      <div className="tk-room" aria-hidden="true"><i /><i /><i /></div>
      <div className="tk-shell">
        <nav className="tk-glass tk-rail" aria-label="Secciones">
          <button className="on" title="Tickets" aria-label="Tickets">T</button>
          <a href="/" title="Volver al planificador" aria-label="Planificador">P</a>
        </nav>
        <div className="tk-main">
          <header className="tk-top">
            <div>
              <h1>Tickets de {areaName}</h1>
              <p>{waiting ? `${waiting} ${waiting === 1 ? 'ticket espera' : 'tickets esperan'} tu revisión` : 'Nada espera tu revisión'} · {counts.black} {counts.black === 1 ? 'agendado' : 'agendados'}</p>
            </div>
            <div className="tk-tools">
              <select className="tk-glass tk-areasel" value={areaId} onChange={(e) => pickArea(e.target.value)} aria-label="Área">{plan.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <label className="tk-glass tk-search"><span aria-hidden="true">⌕</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o asunto" aria-label="Buscar" /></label>
              {notifPerm === 'default' && <button className="tk-glass tk-add" title="Avisa cuando un ticket necesite tu respuesta" onClick={() => Notification.requestPermission().then(setNotifPerm)}>Activar avisos</button>}
              <button className="tk-glass tk-add" onClick={() => setNewOpen((v) => !v)}>+ Nuevo</button>
            </div>
          </header>
          {!user && <div className="tk-glass tk-note-bar">No has iniciado sesión: ves los tickets de este navegador. <a href="/">Inicia sesión en el planificador</a> para ver los de tu cuenta.</div>}
          <section className="tk-kpis" aria-label="Filtrar por estado">
            {FILTERS.map(([k, l, d]) => <button key={k} className="tk-glass tk-kpi" aria-pressed={filter === k} onClick={() => setFilter(k)}><b>{counts[k]}</b><span><i className={`tk-dot ${d}`} />{l}</span></button>)}
          </section>
          {newOpen && (
            <form className="tk-glass tk-new" onSubmit={(e) => {
              e.preventDefault();
              const out = addDevStack(plan, { area: areaId, name: newName, day: 'later' });
              if (!out.id) return;
              let next = out.plan;
              if (newMod) { const c = assignCode(next, out.id, newMod); if (!c.error) next = c.plan; }
              mutate(() => next); setNewName(''); setNewMod(''); setNewOpen(false); say('Ticket creado');
              const made = devStacks(next, areaId).find((st) => st.id === out.id);
              if (made) open(made);
            }}>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="¿Qué hay que hacer?" aria-label="Nombre del ticket" />
              {cfg && <select value={newMod} onChange={(e) => setNewMod(e.target.value)} aria-label="Módulo"><option value="">Sin código</option>{Object.entries(cfg.modules).map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}</select>}
              <button type="submit" className="tk-btn dark">Crear</button>
            </form>
          )}
          <div className={`tk-work${sel ? ' split' : ''}`}>
            <section className="tk-glass tk-list" aria-label="Tickets">
              <div className="tk-listbar">
                <span>{rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}</span>
                <label>Orden <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Orden"><option value="cola">Orden de ejecución</option><option value="llego">Más recientes</option><option value="estado">Por estado</option></select></label>
                {uncoded > 0 && <button className="tk-link" title="Da a cada ticket el código del módulo sugerido por su título" onClick={() => { if (window.confirm(`Asignar código a ${uncoded} tickets según el módulo sugerido por su título?\nLos códigos no cambian después.`)) { mutate((p) => bulkAssign(p, areaId).plan); say('Códigos asignados'); } }}>Asignar {uncoded} códigos</button>}
              </div>
              {!rows.length && <div className="tk-empty">Nada en esta vista.</div>}
              {(() => {
                let lastG = null;
                const groupOf = (st) => {
                  if (qinfo.running.some((r) => r.st.id === st.id) || qinfo.pos.has(st.id)) return 'Ahora y en cola';
                  const d = scheduledISO(st.main);
                  return d ? fmtWhen(d.slice(0, 10)) : 'Sin agendar';
                };
                return rows.map((st) => {
                const g = sort === 'cola' ? groupOf(st) : null;
                const head = g && g !== lastG;
                lastG = g;
                const { ts, sch } = info(st);
                const late = sch && sch.includes('T') && new Date(sch).getTime() < Date.now() && (ts.key === 'scheduled' || ts.key === 'missed');
                const lote = st.main.iris && st.main.iris.launch && st.main.iris.batch;
                return (
                  <React.Fragment key={st.id}>
                  {head && <div className="tk-group">{g}</div>}
                  <button className={`tk-row${unread.has(st.id) ? ' unread' : ''}`} aria-selected={sel && sel.id === st.id} onClick={() => open(sel && sel.id === st.id ? null : st)}>
                    <span className="tk-code">{codeOf(st.main) || '—'}{(st.main.dev.rev || 1) > 1 && <span className="tk-rev">v{st.main.dev.rev}</span>}</span>
                    <div><div className="tk-ttl">{unread.has(st.id) && <i className="tk-newdot" aria-label="Novedad sin leer" />}{st.main.text}</div><div className="tk-sub">{st.main.dev.mod && cfg ? cfg.modules[st.main.dev.mod] : 'Sin módulo'}{lote ? ' · en lote' : ''}</div></div>
                    <div className="tk-when"><span className={`tk-pill p-${ts.tone}`}>{qinfo.pos.has(st.id) ? `En cola · ${qinfo.pos.get(st.id)}º` : ts.label}</span><small className={late ? 'late' : ''}>{sch ? `${fmtWhen(sch)}${late ? ' · atrasado' : ''}` : 'Sin agendar'}</small></div>
                  </button>
                  </React.Fragment>
                );
              }); })()}
            </section>
            {sel ? panel(sel) : <aside className="tk-glass tk-panel tk-emptypanel"><div className="tk-empty">Elige un ticket para verlo completo.</div></aside>}
          </div>
        </div>
      </div>
      {decFor && (() => {
        const st = all.find((x) => x.id === decFor);
        const qs = st ? parseReport(reportOf(plan, st.id)).decisionQs : [];
        if (!st || !qs.length) return null;
        return <DecisionsModal code={codeOf(st.main)} title={st.main.text} qs={qs} onCancel={() => setDecFor(null)} onValidate={() => { setDecFor(null); validate(st); }} onSend={({ text, day, at }) => {
          const out = requestCorrection(plan, st.id, { text, day, at });
          if (out.error) { setMsg(out.error); setDecFor(null); return; }
          setMsg(''); mutate(() => out.plan); setDecFor(null); say(`Cambios enviados · v${out.rev}`);
        }} />;
      })()}
      {fileView && <FileModal file={fileView} onClose={() => setFileView(null)} onCopy={copy} onDownload={download} />}
      <div className={`tk-glass tk-toast${toast ? ' show' : ''}`} role="status">{toast}</div>
    </div>
  );
}
