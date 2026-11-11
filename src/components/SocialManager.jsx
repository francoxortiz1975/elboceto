import React, { useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { PlanTabs } from './PlanTabs';
import { Stack } from './ReelStack';
import { stackOfKind, createStack, migrateLegacyStories, KIND_LABEL } from '../lib/contentPlan';
import './SocialManager.css';

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
      </div>
      <div className="sm-wrap">
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
      </div>
    </div>
  );
}
