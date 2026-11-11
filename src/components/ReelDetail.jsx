import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Everything about one post: script, on-screen text, call to action, caption, notes.
export function ReelDetail({ stack, order, id, color, dateOf, onNavigate, onClose }) {
  const [copied, setCopied] = useState(false);
  const r = stack.reels[id];
  const i = order.indexOf(id);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => setCopied(false), [id]);

  if (!r) return null;
  const copy = () => {
    try { navigator.clipboard.writeText(r.script || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return createPortal(
    <div className="rd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="rd" style={{ '--c': color }} role="dialog" aria-label={r.title}>
        <div className="rd-top">
          <span className="rd-meta">{i + 1} de {order.length} · {dateOf(id)} · {stack.at}{r.format ? ` · ${r.format}` : ''}</span>
          <button className="rd-close" onClick={onClose}>Cerrar</button>
        </div>
        <h2>{r.title}</h2>
        {r.draft && <div className="rd-draft">Borrador: rellena lo que está entre [CORCHETES] con datos reales.</div>}
        {r.script && (<><h4>Guion</h4><p className="rd-pre">{r.script}</p></>)}
        {r.screen && r.screen.length > 0 && (<><h4>Texto en pantalla</h4><ul>{r.screen.map((t, k) => <li key={k}>{t}</li>)}</ul></>)}
        {r.cta && (<><h4>Llamada a la acción</h4><div className="rd-cta">{r.cta}</div></>)}
        {r.caption && (<><h4>Pie y hashtags</h4><p className="rd-pre rd-small">{r.caption}</p></>)}
        {r.note && (<><h4>Notas</h4><p className="rd-pre rd-small">{r.note}</p></>)}
        <div className="rd-nav">
          <button disabled={i <= 0} onClick={() => onNavigate(order[i - 1])}>← Anterior</button>
          <button onClick={copy}>{copied ? 'Copiado' : 'Copiar guion'}</button>
          <button disabled={i >= order.length - 1} onClick={() => onNavigate(order[i + 1])}>Siguiente →</button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
