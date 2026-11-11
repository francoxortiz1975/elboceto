import React, { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { Stack } from './ReelStack';
import { ReelRows } from './ReelRows';
import { stackOfKind, createStack, migrateLegacyStories, KIND_LABEL } from '../lib/contentPlan';
import './SocialManager.css';

const LAYOUT_KEY = 'el_boceto_social_layout_v1';

const COLUMNS = [
  { kind: 'reel', title: 'Reels', hint: 'Vídeos con guion: hook, cuerpo y llamada a la acción.' },
  { kind: 'story', title: 'Stories', hint: 'Encuestas, preguntas y detrás de cámaras.' },
  { kind: 'post', title: 'Posts', hint: 'Fotos y carruseles con su pie y hashtags.' }
];

// The social media page: one column per kind of piece, each its own stack with its own days and
// time. Every piece also shows in the calendar (Día, Tablero, Semana, Mes) in its area.
export function SocialManager({ plan, onChange, onBack, compact, tab, onTabChange }) {
  // Stories from an earlier import (loose blocks) become pieces of the Stories column.
  useEffect(() => {
    if (migrateLegacyStories(plan) !== plan) onChange((p) => migrateLegacyStories(p));
  }, [plan, onChange]);

  // 'rows' = one row per Reel with its pre/after stories; 'cols' = one column per kind.
  const [layout, setLayout] = useState(() => {
    try { return localStorage.getItem(LAYOUT_KEY) === 'cols' ? 'cols' : 'rows'; } catch { return 'rows'; }
  });
  const pick = (v) => {
    setLayout(v);
    try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* storage unavailable */ }
  };

  return (
    <div className={`ap-root sm-root${compact ? ' compact' : ''}`}>
      <div className="ap-head">
        <h1 className="font-title">Redes sociales</h1>
        <span className="ap-sub">reels · stories · posts</span>
        {onBack && (
          <button className="ap-btn ap-back" onClick={onBack}>
            <ChevronUp size={12} style={{ verticalAlign: '-2px' }} /> Lienzo
          </button>
        )}
      </div>
      <div className="ap-filters">
        {onTabChange && <PlanTabs value={tab} onChange={onTabChange} />}
        <div className="ap-seg sm-switch" role="group" aria-label="Cómo verlo">
          <button aria-pressed={layout === 'rows'} onClick={() => pick('rows')}>Por Reel</button>
          <button aria-pressed={layout === 'cols'} onClick={() => pick('cols')}>Columnas</button>
        </div>
      </div>
      <div className="sm-wrap">
        {layout === 'rows' ? <ReelRows plan={plan} onChange={onChange} /> : (
        <div className="sm-cols">
          {COLUMNS.map(({ kind, title, hint }) => {
            const found = stackOfKind(plan, kind);
            return (
              <section key={kind} className="sm-col" aria-label={title}>
                <h2 className="sm-title">{title}</h2>
                {found ? (
                  <Stack plan={plan} stackId={found.id} onChange={onChange} column />
                ) : (
                  <div className="sm-empty">
                    <p>{hint}</p>
                    <button className="ap-btn" onClick={() => onChange((p) => createStack(p, kind))}>Crear columna de {KIND_LABEL[kind]}s</button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
