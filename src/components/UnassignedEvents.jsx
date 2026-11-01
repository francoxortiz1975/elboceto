import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AREA_COLORS, fmtMin, fromIso } from '../lib/areaPlan';
import './UnassignedEvents.css';

const DAY_NAMES = { mon: 'lunes', tue: 'martes', wed: 'miércoles', thu: 'jueves', fri: 'viernes', sat: 'sábado', sun: 'domingo' };

// Lists events that have no area yet and lets you give each one an area.
export function UnassignedEvents({ events, areas, onAssign, onDiscard, onClose }) {
  const [choice, setChoice] = useState({});
  const [all, setAll] = useState('');
  const colorOf = (a) => AREA_COLORS[a.c % AREA_COLORS.length];
  const when = (ev) => {
    const d = fromIso(ev.day).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    return ev.at === null ? `${d} · todo el día` : `${d} · ${fmtMin(ev.at)}–${fmtMin(ev.at + ev.dur)}`;
  };
  const chosen = events.filter((ev) => choice[ev.key]);

  // Once every event has an area there is nothing left to ask.
  useEffect(() => { if (events.length === 0) onClose(); }, [events.length, onClose]);

  return (
    <div className="ue-overlay" onClick={onClose}>
      <div className="ue-box" role="dialog" aria-label="Eventos sin área" onClick={(e) => e.stopPropagation()}>
        <button className="ue-close" onClick={onClose} aria-label="Cerrar"><X size={14} /></button>
        <h2 className="ue-title font-title">Eventos sin área</h2>
        <p className="ue-desc">
          Todo bloque debe tener un área. Elige una para cada evento y pasará a ser un bloque normal, visible en Tablero,
          Día completo, Semana y Mes. Nada se cambia hasta que pulses el botón.
        </p>

        {events.length === 0 ? (
          <div className="ue-empty">Todos los eventos ya tienen área.</div>
        ) : (
          <>
            <div className="ue-all">
              <span>Asignar todos a</span>
              <select id="ue-all" className="ap-btn" value={all} onChange={(e) => setAll(e.target.value)}>
                <option value="">Elegir área…</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button
                className="ap-btn" disabled={!all}
                onClick={() => setChoice(Object.fromEntries(events.map((ev) => [ev.key, all])))}
              >Aplicar</button>
            </div>

            <div className="ue-list">
              {events.map((ev) => {
                const a = areas.find((x) => x.id === choice[ev.key]);
                return (
                  <div key={ev.key} className="ue-row" style={a ? { '--c': colorOf(a) } : undefined}>
                    <div className="ue-info">
                      <div className="ue-text">{ev.text || <em>sin título</em>}</div>
                      <div className="ue-when">
                        {when(ev)}
                        {ev.repeats && ` · se repetía cada ${DAY_NAMES[ev.weekday] || 'semana'}; pasará al próximo`}
                      </div>
                    </div>
                    <select
                      className="ap-btn ue-select" aria-label={`Área de ${ev.text}`}
                      value={choice[ev.key] || ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [ev.key]: e.target.value }))}
                    >
                      <option value="">Elegir área…</option>
                      {areas.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button className="ue-discard" title={ev.kind === 'note' ? 'Quitarle la fecha a la nota' : 'Borrar este evento'} onClick={() => onDiscard([ev])}>
                      {ev.kind === 'note' ? 'Quitar fecha' : 'Borrar'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="ue-actions">
              <button className="ap-btn" onClick={onClose}>Ahora no</button>
              <button
                className="ue-primary" disabled={chosen.length === 0}
                onClick={() => { onAssign(chosen.map((ev) => ({ ev, areaId: choice[ev.key] }))); setChoice({}); }}
              >
                Asignar{chosen.length ? ` (${chosen.length})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
