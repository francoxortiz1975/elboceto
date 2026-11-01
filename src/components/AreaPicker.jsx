import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AREA_COLORS } from '../lib/areaPlan';
import './AreaPicker.css';

// "¿Para qué área?" popover shown wherever a block is about to be created, so a
// block never exists without an area. Keys 1–9 pick an area, Esc cancels.
export function AreaPicker({ x, y, areas, title = '¿Para qué área?', onPick, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= Math.min(9, areas.length)) { e.preventDefault(); onPick(areas[n - 1].id); }
    };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [areas, onPick, onClose]);

  return createPortal(
    <div ref={ref} className="apick" style={pos} role="dialog" aria-label={title}>
      <div className="apick-title">{title}</div>
      {areas.length === 0 && <div className="apick-empty">Crea un área primero.</div>}
      {areas.map((a, i) => (
        <button key={a.id} className="apick-opt" style={{ '--c': AREA_COLORS[a.c % AREA_COLORS.length] }} onClick={() => onPick(a.id)}>
          <i />
          <span className="apick-name">{a.name}</span>
          {i < 9 && <kbd>{i + 1}</kbd>}
        </button>
      ))}
    </div>,
    document.body
  );
}
