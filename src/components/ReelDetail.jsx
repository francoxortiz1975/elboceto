import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { reelText, kindOf } from '../lib/contentPlan';

// What each field is called for a Reel, a Story or a Post (the four fields are the same underneath).
const LABELS = {
  reel: { hook: 'Hook', body: 'Cuerpo', cta: 'Llamada a la acción', caption: 'Pie y hashtags', hookPh: 'La primera frase, lo que dices en los primeros 2 segundos', bodyPh: 'El resto del guion', ctaPh: 'Qué quieres que haga quien lo ve', capPh: 'Pie del post y hashtags' },
  story: { hook: 'Primera story', body: 'Siguientes stories', cta: 'Sticker o pregunta', caption: 'Notas', hookPh: 'Qué se ve y qué dice la primera story', bodyPh: 'Story 2, story 3…', ctaPh: 'Encuesta, caja de preguntas, enlace…', capPh: 'Notas para ti: qué apuntar, qué reutilizar' },
  post: { hook: 'Titular o portada', body: 'Texto o slides', cta: 'Llamada a la acción', caption: 'Pie y hashtags', hookPh: 'Lo que se lee primero (portada del carrusel o primera línea)', bodyPh: 'El texto, o slide por slide', ctaPh: 'Qué quieres que haga quien lo ve', capPh: 'Pie del post y hashtags' }
};

// A textarea that grows with its text.
function Field({ value, onChange, rows = 1, placeholder }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

// The script is stored as one text: its first line is the hook, the rest is the body.
const splitScript = (script = '') => {
  const i = script.indexOf('\n');
  return i < 0 ? { hook: script, body: '' } : { hook: script.slice(0, i), body: script.slice(i + 1).replace(/^\n+/, '') };
};
const joinScript = (hook, body) => (body ? `${hook}\n${body}` : hook);

// One post, editable in place: hook, body, call to action, caption and hashtags.
export function ReelDetail({ stack, order, id, color, dateOf, onEdit, onNavigate, onClose }) {
  const r = reelText(stack.reels[id] || {});
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState(false);
  const i = order.indexOf(id);
  const L = LABELS[kindOf(stack)];

  // Load the text when the dialog opens or you move to another Reel.
  useEffect(() => {
    const cur = reelText(stack.reels[id] || {});
    const sp = splitScript(cur.script);
    setHook(sp.hook); setBody(sp.body); setCta(cur.cta || ''); setCaption(cur.caption || ''); setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stack.reels[id]) return null;
  const hasBrackets = /\[[^\]]+\]/.test(`${hook}\n${body}\n${cta}\n${caption}`);
  const changeScript = (h, b) => onEdit(id, { script: joinScript(h, b) });
  const copy = () => {
    try { navigator.clipboard.writeText(`${joinScript(hook, body)}\n\n${cta}\n\n${caption}`.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  return createPortal(
    <div className="rd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="rd" style={{ '--c': color }} role="dialog" aria-label={r.title}>
        <div className="rd-top">
          <span className="rd-meta">{i + 1} de {order.length} · {dateOf(id)}{stack.at ? ` · ${stack.at}` : ''}</span>
          <button className="rd-close" onClick={onClose}>Cerrar</button>
        </div>
        <h2>{r.short || r.title}</h2>
        {hasBrackets && <div className="rd-draft">Falta rellenar lo que está entre [CORCHETES] con datos reales.</div>}

        <h4>{L.hook}</h4>
        <Field value={hook} placeholder={L.hookPh} onChange={(v) => { setHook(v); changeScript(v, body); }} />
        <h4>{L.body}</h4>
        <Field value={body} rows={4} placeholder={L.bodyPh} onChange={(v) => { setBody(v); changeScript(hook, v); }} />
        <h4>{L.cta}</h4>
        <Field value={cta} placeholder={L.ctaPh} onChange={(v) => { setCta(v); onEdit(id, { cta: v }); }} />
        <h4>{L.caption}</h4>
        <Field value={caption} rows={3} placeholder={L.capPh} onChange={(v) => { setCaption(v); onEdit(id, { caption: v }); }} />

        <div className="rd-nav">
          <button disabled={i <= 0} onClick={() => onNavigate(order[i - 1])}>← Anterior</button>
          <button onClick={copy}>{copied ? 'Copiado' : 'Copiar todo'}</button>
          <button disabled={i >= order.length - 1} onClick={() => onNavigate(order[i + 1])}>Siguiente →</button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
