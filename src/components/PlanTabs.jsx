import React, { useContext } from 'react';
import { PlanBadgeContext } from './planBadges';

const TABS = [
  ['day', 'Día completo'],
  ['board', 'Tablero'],
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['social', 'Redes'],
  ['motor', 'Motor']
];

// Switch between the ways of looking at the same plan.
export function PlanTabs({ value, onChange }) {
  const badges = useContext(PlanBadgeContext);
  return (
    <div className="ap-seg" role="group" aria-label="Vista del plan">
      {TABS.map(([id, label]) => {
        const n = badges[id];
        return (
          <button key={id} aria-pressed={value === id} onClick={() => onChange(id)} title={n ? `${n} pendientes de días anteriores` : undefined}>
            {label}{n ? <span className="ap-badge">{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
