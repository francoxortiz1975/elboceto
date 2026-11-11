import React from 'react';

const TABS = [
  ['day', 'Día completo'],
  ['board', 'Tablero'],
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['social', 'Redes']
];

// Switch between the three ways of looking at the same plan.
export function PlanTabs({ value, onChange }) {
  return (
    <div className="ap-seg" role="group" aria-label="Vista del plan">
      {TABS.map(([id, label]) => (
        <button key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}
