import React, { useState } from 'react';
import { MarkdownView } from './MarkdownView';
import { whenOptions } from '../lib/devStacks';
import { decisionsBrief, decisionChanges } from '../lib/devStacks';

// The decisions the agent took and already implemented, one at a time: its choice comes selected. If everything is right the user
// validates; what the user changes goes back as a correction about just that.
export function DecisionsModal({ code, title, qs, onCancel, onSend, onValidate }) {
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState(() => qs.map((d) => ({ opt: d.chosen || '', text: '' })));
  const [note, setNote] = useState('');
  const [whenKey, setWhenKey] = useState('now');
  const [whenDay, setWhenDay] = useState('');
  const [whenTime, setWhenTime] = useState('22:00');
  const [err, setErr] = useState('');
  const review = idx >= qs.length;
  const d = qs[idx];
  const a = ans[idx] || {};
  const set = (patch) => setAns((l) => l.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const changes = decisionChanges(qs, ans);
  const next = () => {
    if (a.opt === 'otra' && !a.text.trim()) { setErr('Escribe tu respuesta o elige una opción.'); return; }
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
  const labelOf = (q, x) => (x.opt === 'otra' ? x.text : (q.options.find((o) => o.k === x.opt) || {}).text || '—');
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
            <div className="tk-hint">El agente ya la tomó e implementó. Si te parece bien, sigue; si no, elige otra.</div>
            <h2 className="tk-q">{d.q}</h2>
            <div className="tk-opts">
              {d.options.map((o) => (
                <button key={o.k} className="tk-opt" aria-pressed={a.opt === o.k} onClick={() => { set({ opt: o.k }); setErr(''); }}>
                  <span className="tk-ok">{o.k}</span><span className="tk-ot">{o.text}</span>
                  {o.k === d.chosen ? <span className="tk-rec">Elegida por el agente</span> : o.k === d.rec ? <span className="tk-rec soft">Recomendada</span> : null}
                </button>
              ))}
              <button className="tk-opt" aria-pressed={a.opt === 'otra'} onClick={() => { set({ opt: 'otra' }); setErr(''); }}>
                <span className="tk-ok">✎</span><span className="tk-ot">Otra respuesta</span>
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
                const changed = changes.some((c) => c.i === i);
                return <li key={i}><button className="tk-sumq" onClick={() => setIdx(i)}>{q.q}</button><div className={`tk-suma${changed ? ' changed' : ''}`}>{changed ? `Cambia a: ${labelOf(q, x)}` : `Se queda: ${labelOf(q, { opt: q.chosen })}`}</div></li>;
              })}
            </ol>
            {changes.length === 0 ? (
              <>
                <div className="tk-hint">No cambias nada: lo que implementó el agente queda como está.</div>
                <div className="tk-mf">
                  <button className="tk-btn" onClick={() => { setErr(''); setIdx(qs.length - 1); }}>Atrás</button>
                  <button className="tk-btn go" onClick={onValidate}>Todo bien: validar</button>
                </div>
              </>
            ) : (
              <>
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
                  <button className="tk-btn go" onClick={send}>Enviar solo los cambios</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// A file the area left: a document (reader or plain text), a PDF (embedded) or an image.
const toBlobUrl = (f) => {
  if (f.b64) { const bin = atob(f.b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([arr], { type: f.mime || 'application/octet-stream' })); }
  return '';
};
export function FileModal({ file, onClose, onCopy, onDownload }) {
  const [reader, setReader] = useState(true);
  const binary = file.kind === 'pdf' || file.kind === 'image';
  const url = React.useMemo(() => (binary ? toBlobUrl(file) : ''), [file, binary]);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const isMd = !binary && (file.kind === 'markdown' || (!file.kind && /\.md$/i.test(file.path)));
  return (
    <div className="tk-modalback" role="dialog" aria-modal="true" aria-label={file.path} onClick={onClose}>
      <div className="tk-glass tk-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="tk-mh">
          <span className="tk-code">{file.path}</span>
          {isMd && (
            <div className="tk-seg" role="group" aria-label="Cómo verlo">
              <button aria-pressed={reader} onClick={() => setReader(true)}>Lector</button>
              <button aria-pressed={!reader} onClick={() => setReader(false)}>Texto</button>
            </div>
          )}
          <button className="tk-x" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        {file.kind === 'pdf' && url && <iframe className="tk-pdf" title={file.path} src={url} />}
        {file.kind === 'image' && url && <div className="tk-filebox tk-imgbox"><img src={url} alt={file.path} /></div>}
        {!binary && (isMd && reader ? <div className="tk-filebox"><MarkdownView text={file.text || ''} /></div> : <pre className="tk-filetext">{file.text}</pre>)}
        {file.truncated && <div className="tk-hint">Se muestran los primeros 80 KB. Para verlo completo, ábrelo en tu Mac.</div>}
        <div className="tk-mf">
          {!binary && <button className="tk-btn" onClick={() => onCopy(file.text, 'Texto')}>Copiar texto</button>}
          <button className="tk-btn" onClick={() => onCopy(file.abs, 'Ruta')}>Copiar ruta</button>
          <button className="tk-btn dark" onClick={() => onDownload(file)}>Descargar</button>
        </div>
      </div>
    </div>
  );
}
