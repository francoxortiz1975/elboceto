import React, { useState } from 'react';
import { MarkdownView } from './MarkdownView';
import { whenOptions } from '../lib/devStacks';
import { decisionsBrief } from '../lib/devStacks';

// The decisions an area left for the user, one question at a time: options, the recommended one marked, a free answer.
// At the end the answers become the brief of the next version (a correction), scheduled with the same quick choices.
export function DecisionsModal({ code, title, qs, onCancel, onSend }) {
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState(() => qs.map((d) => ({ opt: d.rec || (d.options.length ? '' : 'otra'), text: '' })));
  const [note, setNote] = useState('');
  const [whenKey, setWhenKey] = useState('now');
  const [whenDay, setWhenDay] = useState('');
  const [whenTime, setWhenTime] = useState('22:00');
  const [err, setErr] = useState('');
  const review = idx >= qs.length;
  const d = qs[idx];
  const a = ans[idx] || {};
  const set = (patch) => setAns((l) => l.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const answered = (i) => { const x = ans[i]; const q = qs[i]; return x.opt === 'otra' ? !!x.text.trim() : !!x.opt || (!q.options.length && !!x.text.trim()); };
  const next = () => {
    if (!answered(idx)) { setErr('Elige una opción o escribe tu respuesta.'); return; }
    setErr(''); setIdx(idx + 1);
  };
  const send = () => {
    let day; let at;
    if (whenKey === 'custom') {
      const m = /^(\d{1,2}):(\d{2})$/.exec(whenTime || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(whenDay) || !m) { setErr('Elige el día y la hora.'); return; }
      day = whenDay; at = Number(m[1]) * 60 + Number(m[2]);
    } else { const o = whenOptions(new Date()).find((x) => x.key === whenKey) || whenOptions(new Date())[0]; day = o.day; at = o.at; }
    onSend({ text: decisionsBrief(qs, ans, note), day, at });
  };
  return (
    <div className="tk-modalback" role="dialog" aria-modal="true" aria-label="Decisiones" onClick={onCancel}>
      <div className="tk-glass tk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tk-mh">
          <span className="tk-code">{code || 'Ticket'}</span>
          <span className="tk-mstep">{review ? 'Resumen' : `Decisión ${idx + 1} de ${qs.length}`}</span>
          <button className="tk-x" aria-label="Cerrar" onClick={onCancel}>×</button>
        </div>
        <div className="tk-bar" aria-hidden="true"><i style={{ width: `${Math.round(((review ? qs.length : idx) / qs.length) * 100)}%` }} /></div>
        {!review ? (
          <>
            <h2 className="tk-q">{d.q}</h2>
            <div className="tk-opts">
              {d.options.map((o) => (
                <button key={o.k} className="tk-opt" aria-pressed={a.opt === o.k} onClick={() => { set({ opt: o.k }); setErr(''); }}>
                  <span className="tk-ok">{o.k}</span><span className="tk-ot">{o.text}</span>
                  {o.k === d.rec && <span className="tk-rec">Recomendada</span>}
                </button>
              ))}
              <button className="tk-opt" aria-pressed={a.opt === 'otra'} onClick={() => { set({ opt: 'otra' }); setErr(''); }}>
                <span className="tk-ok">✎</span><span className="tk-ot">{d.options.length ? 'Otra respuesta' : 'Tu respuesta'}</span>
              </button>
            </div>
            {a.opt === 'otra' && <textarea className="tk-corr" autoFocus value={a.text} onChange={(e) => set({ text: e.target.value })} placeholder="Escribe con tus palabras…" aria-label="Tu respuesta" />}
            {err && <div className="tk-msg">{err}</div>}
            <div className="tk-mf">
              <button className="tk-btn" disabled={idx === 0} onClick={() => { setErr(''); setIdx(idx - 1); }}>Atrás</button>
              <button className="tk-btn dark" onClick={next}>{idx === qs.length - 1 ? 'Revisar' : 'Siguiente'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="tk-q">{title}</h2>
            <ol className="tk-sum">
              {qs.map((q, i) => {
                const x = ans[i];
                const chosen = q.options.find((o) => o.k === x.opt);
                return <li key={i}><button className="tk-sumq" onClick={() => setIdx(i)}>{q.q}</button><div className="tk-suma">{x.opt === 'otra' ? x.text : chosen ? `${chosen.k}) ${chosen.text}` : '—'}</div></li>;
              })}
            </ol>
            <div className="tk-label">¿Algo más que añadir? (opcional)</div>
            <textarea className="tk-corr" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe con tus palabras…" aria-label="Comentario adicional" />
            <div className="tk-label">¿Cuándo?</div>
            <div className="tk-chips">
              {whenOptions(new Date()).map((o) => <button key={o.key} className="tk-chip" aria-pressed={whenKey === o.key} onClick={() => setWhenKey(o.key)}>{o.label}</button>)}
              <button className="tk-chip" aria-pressed={whenKey === 'custom'} onClick={() => setWhenKey('custom')}>Elegir día y hora…</button>
            </div>
            {whenKey === 'custom' && <div className="tk-custom"><input type="date" value={whenDay} onChange={(e) => setWhenDay(e.target.value)} aria-label="Día" /><input type="time" value={whenTime} onChange={(e) => setWhenTime(e.target.value)} aria-label="Hora" /></div>}
            {err && <div className="tk-msg">{err}</div>}
            <div className="tk-mf">
              <button className="tk-btn" onClick={() => { setErr(''); setIdx(qs.length - 1); }}>Atrás</button>
              <button className="tk-btn go" onClick={send}>Enviar decisiones</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// A markdown file the area left: read as a document (default) or as plain selectable text.
export function FileModal({ file, onClose, onCopy, onDownload }) {
  const [reader, setReader] = useState(true);
  return (
    <div className="tk-modalback" role="dialog" aria-modal="true" aria-label={file.path} onClick={onClose}>
      <div className="tk-glass tk-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="tk-mh">
          <span className="tk-code">{file.path}</span>
          <div className="tk-seg" role="group" aria-label="Cómo verlo">
            <button aria-pressed={reader} onClick={() => setReader(true)}>Lector</button>
            <button aria-pressed={!reader} onClick={() => setReader(false)}>Texto</button>
          </div>
          <button className="tk-x" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        {reader ? <div className="tk-filebox"><MarkdownView text={file.text} /></div> : <pre className="tk-filetext">{file.text}</pre>}
        {file.truncated && <div className="tk-hint">Se muestran los primeros 80 KB. Para verlo completo, ábrelo en tu Mac.</div>}
        <div className="tk-mf">
          <button className="tk-btn" onClick={() => onCopy(file.text, 'Texto')}>Copiar texto</button>
          <button className="tk-btn" onClick={() => onCopy(file.abs, 'Ruta')}>Copiar ruta</button>
          <button className="tk-btn dark" onClick={() => onDownload(file)}>Descargar</button>
        </div>
      </div>
    </div>
  );
}
