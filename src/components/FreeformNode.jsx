import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  Calendar,
  CheckSquare,
  ListOrdered,
  ListCollapse,
  Heading,
  StickyNote,
  Check,
  ChevronRight,
  List,
  Bold,
  Type,
  X,
  Clock
} from 'lucide-react';

// ─── Inline Event Scheduler Popover ───────────────────────────────────────────
function EventSchedulerPopover({ node, onUpdate, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(node.eventDate || today);
  const [time, setTime] = useState(node.eventTime || '09:00');
  const [duration, setDuration] = useState(node.eventDurationMin || 60);
  const [isEvent, setIsEvent] = useState(node.isEvent || false);

  const handleSave = () => {
    onUpdate({
      ...node,
      eventDate: date || null,
      eventTime: time || null,
      eventDurationMin: duration || 60,
      isEvent
    });
    onClose();
  };

  const handleClear = () => {
    onUpdate({ ...node, isEvent: false, eventDate: null, eventTime: null, eventDurationMin: null });
    onClose();
  };

  return (
    <div
      className="event-scheduler-popover"
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Fecha y Hora
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '0 2px' }}>
          <X size={12} />
        </button>
      </div>

      {/* Date, Time, Duration (Always visible) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>FECHA</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              border: 'var(--border-hairline)',
              borderRadius: '3px',
              background: 'var(--bg-book)',
              color: 'var(--text-ink)',
              fontSize: '0.8rem',
              padding: '4px 6px',
              fontFamily: 'inherit',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HORA</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                border: 'var(--border-hairline)',
                borderRadius: '3px',
                background: 'var(--bg-book)',
                color: 'var(--text-ink)',
                fontSize: '0.8rem',
                padding: '4px 6px',
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>DURACIÓN (min)</span>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              style={{
                border: 'var(--border-hairline)',
                borderRadius: '3px',
                background: 'var(--bg-book)',
                color: 'var(--text-ink)',
                fontSize: '0.8rem',
                padding: '4px 6px',
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Toggle event (Optional styling at the bottom) */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
          <div
            onClick={() => setIsEvent(!isEvent)}
            style={{
              width: '28px', height: '16px',
              borderRadius: '8px',
              background: isEvent ? 'var(--text-ink)' : 'rgba(24,24,27,0.15)',
              position: 'relative',
              transition: 'background 0.2s',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: isEvent ? '14px' : '2px',
              width: '12px', height: '12px',
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </div>
          <span style={{ fontSize: '0.76rem', color: isEvent ? 'var(--text-ink)' : 'var(--text-muted)' }}>
            Destacar en negro (Evento)
          </span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '5px 10px',
            background: 'var(--text-ink)',
            color: 'var(--bg-book)',
            border: 'none',
            borderRadius: '3px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Guardar
        </button>
        {node.eventDate && (
          <button
            onClick={handleClear}
            style={{
              padding: '5px 8px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'var(--border-hairline)',
              borderRadius: '3px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Quitar
          </button>
        )}
      </div>

      {/* Future: Google Calendar */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: 'var(--border-hairline)', textAlign: 'center' }}>
        <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-subtle)' }}>
          ○ Google Calendar — próximamente
        </span>
      </div>
    </div>
  );
}

// ─── FreeformNode ──────────────────────────────────────────────────────────────
export function FreeformNode({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onOpenCalendarModal,
  onDragStart,
  showCompleted = false
}) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [showEventPopover, setShowEventPopover] = useState(false);
  const [focusedTarget, setFocusedTarget] = useState(null);
  const containerRef = useRef(null);
  const inputRefs = useRef({});

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowToolbar(false);
        setShowEventPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Auto-focus input when focusedTarget changes
  useEffect(() => {
    if (focusedTarget) {
      if (focusedTarget.type === 'main') {
        const key = `main_${focusedTarget.index}`;
        if (inputRefs.current[key]) inputRefs.current[key].focus();
      } else if (focusedTarget.type === 'child') {
        const key = `child_${focusedTarget.blockIdx}_${focusedTarget.childIdx}`;
        if (inputRefs.current[key]) inputRefs.current[key].focus();
      }
    }
  }, [node.blocks, focusedTarget]);

  const normalizeBlock = (b) => ({
    id: b.id || 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    text: b.text || '',
    isHeading: !!b.isHeading || b.type === 'heading',
    isSubheading: !!b.isSubheading || b.type === 'subheading',
    isBold: !!b.isBold,
    isCheck: !!b.isCheck || b.type === 'check',
    isNumber: !!b.isNumber || b.type === 'number',
    isBullet: !!b.isBullet || b.type === 'bullet',
    isToggle: !!b.isToggle || b.type === 'toggle',
    completed: !!b.completed,
    isOpen: b.isOpen !== undefined ? b.isOpen : true,
    children: b.children || []
  });

  const blocks = node.blocks.map(normalizeBlock);

  const updateBlocks = (newBlocks) => onUpdate({ ...node, blocks: newBlocks });

  const handleTextChange = (idx, rawText) => {
    const newBlocks = [...blocks];
    let b = { ...newBlocks[idx], text: rawText };

    if (rawText.startsWith('## ')) {
      b.isSubheading = true; b.isHeading = false;
      b.text = rawText.replace(/^##\s*/, '');
    } else if (rawText.startsWith('# ')) {
      b.isHeading = true; b.isSubheading = false;
      b.text = rawText.replace(/^#\s*/, '');
    } else if (rawText.startsWith('[] ') || rawText.startsWith('[ ] ') || rawText.startsWith('- [ ] ')) {
      b.isCheck = true;
      b.text = rawText.replace(/^(\[\]|\[ \]|-\s*\[ \])\s*/, '');
    } else if (rawText.startsWith('[x] ') || rawText.startsWith('- [x] ')) {
      b.isCheck = true; b.completed = true;
      b.text = rawText.replace(/^(\[x\]|-\s*\[x\])\s*/, '');
    } else if (/^\d+[\.]\s/.test(rawText)) {
      b.isNumber = true;
      b.text = rawText.replace(/^\d+[\.]\s*/, '');
    } else if (rawText.startsWith('- ') || rawText.startsWith('* ') || rawText.startsWith('• ')) {
      b.isBullet = true;
      b.text = rawText.replace(/^(-\s*|\*\s*|•\s*)/, '');
    } else if (rawText.startsWith('> ')) {
      b.isToggle = true; b.isOpen = true;
      if (!b.children.length) b.children = [''];
      b.text = rawText.replace(/^>\s*/, '');
    }

    newBlocks[idx] = b;
    updateBlocks(newBlocks);
  };

  const toggleProperty = (idx, prop) => {
    const newBlocks = [...blocks];
    const b = { ...newBlocks[idx] };
    if (prop === 'isHeading') {
      b.isHeading = !b.isHeading;
      if (b.isHeading) b.isSubheading = false;
    } else if (prop === 'isSubheading') {
      b.isSubheading = !b.isSubheading;
      if (b.isSubheading) b.isHeading = false;
    } else {
      b[prop] = !b[prop];
    }
    if (prop === 'isToggle' && b.isToggle && !b.children.length) {
      b.children = ['']; b.isOpen = true;
    }
    newBlocks[idx] = b;
    updateBlocks(newBlocks);
  };

  const handleToggleCardMode = () => onUpdate({ ...node, isCard: !node.isCard });

  const handleKeyDown = (e, idx) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleProperty(idx, 'isBold');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentB = blocks[idx];
      const newB = normalizeBlock({
        isCheck: currentB.isCheck,
        isNumber: currentB.isNumber,
        isBullet: currentB.isBullet,
        isBold: currentB.isBold,
        isToggle: false, isHeading: false, isSubheading: false
      });
      const newBlocks = [...blocks];
      newBlocks.splice(idx + 1, 0, newB);
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'main', index: idx + 1 });
    } else if (e.key === 'Tab' && !e.shiftKey && idx > 0) {
      e.preventDefault();
      const newBlocks = [...blocks];
      const currentB = newBlocks[idx];
      const prevB = { ...newBlocks[idx - 1] };
      prevB.isToggle = true; prevB.isOpen = true;
      const targetChildIdx = (prevB.children || []).length;
      prevB.children = [...(prevB.children || []), currentB.text || ''];
      newBlocks[idx - 1] = prevB;
      newBlocks.splice(idx, 1);
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'child', blockIdx: idx - 1, childIdx: targetChildIdx });
    } else if (e.key === 'Backspace' && blocks[idx].text === '' && blocks.length > 1) {
      e.preventDefault();
      const newBlocks = blocks.filter((_, i) => i !== idx);
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'main', index: Math.max(0, idx - 1) });
    } else if (e.key === 'Escape') {
      setShowToolbar(false);
      setShowEventPopover(false);
    }
  };

  const handleChildKeyDown = (e, blockIdx, childIdx) => {
    const currentB = blocks[blockIdx];
    const children = [...(currentB.children || [])];
    if (e.key === 'Enter') {
      e.preventDefault();
      children.splice(childIdx + 1, 0, '');
      const newBlocks = [...blocks];
      newBlocks[blockIdx] = { ...currentB, children };
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'child', blockIdx, childIdx: childIdx + 1 });
    } else if (e.key === 'Backspace' && children[childIdx] === '') {
      e.preventDefault();
      children.splice(childIdx, 1);
      const newBlocks = [...blocks];
      newBlocks[blockIdx] = { ...currentB, children };
      updateBlocks(newBlocks);
      if (children.length > 0) {
        setFocusedTarget({ type: 'child', blockIdx, childIdx: Math.max(0, childIdx - 1) });
      } else {
        setFocusedTarget({ type: 'main', index: blockIdx });
      }
    }
  };

  // Format date/time label for indicator
  const eventLabel = node.eventDate
    ? (() => {
        const d = new Date(node.eventDate + 'T00:00:00');
        const day = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return node.eventTime ? `${day} · ${node.eventTime}` : day;
      })()
    : null;

  return (
    <div
      ref={containerRef}
      className={`freeform-node ${node.isCard ? 'is-card' : ''} ${isSelected ? 'selected' : ''} ${node.isEvent ? 'is-event-node' : ''}`}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        zIndex: showToolbar || isSelected ? 1000 : 10
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
        if (showToolbar) {
          onDelete(node.id);
        } else {
          setShowToolbar(true);
        }
      }}
    >
      {/* Drag Handle — only this strip can initiate a drag */}
      <div
        className="node-drag-handle"
        onMouseDown={(e) => onDragStart(e, node.id)}
        onTouchStart={(e) => onDragStart(e, node.id)}
        title="Arrastra para mover"
      />
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          className="inline-context-bar"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Event Scheduler Button */}
          <button
            className={`btn-icon ${node.isEvent ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowEventPopover(p => !p);
            }}
            title={node.isEvent ? `Evento: ${eventLabel}` : 'Programar como evento'}
            style={{ position: 'relative' }}
          >
            <Calendar size={12} />
            {node.isEvent && (
              <span style={{
                position: 'absolute',
                top: '-3px', right: '-3px',
                width: '5px', height: '5px',
                borderRadius: '50%',
                background: 'var(--text-ink)'
              }} />
            )}
          </button>

          <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

          <button className={`btn-icon ${blocks[0]?.isHeading ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isHeading'); }} title="Título (#)">
            <Heading size={12} />
          </button>
          <button className={`btn-icon ${blocks[0]?.isSubheading ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isSubheading'); }} title="Subtítulo (##)">
            <Type size={12} />
          </button>
          <button className={`btn-icon ${blocks[0]?.isBold ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isBold'); }} title="Negrita (Ctrl+B)">
            <Bold size={12} />
          </button>

          <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

          <button className={`btn-icon ${blocks[0]?.isCheck ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isCheck'); }} title="Checkmark">
            <CheckSquare size={12} />
          </button>
          <button className={`btn-icon ${blocks[0]?.isBullet ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isBullet'); }} title="Bullet">
            <List size={12} />
          </button>
          <button className={`btn-icon ${blocks[0]?.isNumber ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isNumber'); }} title="Número">
            <ListOrdered size={12} />
          </button>
          <button className={`btn-icon ${blocks[0]?.isToggle ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(0, 'isToggle'); }} title="Toggle">
            <ListCollapse size={12} />
          </button>

          <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

          <button className={`btn-icon ${node.isCard ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleToggleCardMode(); }} title="Post-It">
            <StickyNote size={12} />
          </button>

          <button className="btn-icon" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Eliminar">
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Event Scheduler Popover */}
      {showToolbar && showEventPopover && (
        <EventSchedulerPopover
          node={node}
          onUpdate={onUpdate}
          onClose={() => setShowEventPopover(false)}
        />
      )}

      {/* Date/Time badge on the LEFT SIDE of the node */}
      {eventLabel && (
        <div style={{
          position: 'absolute',
          top: '4px',
          right: 'calc(100% + 8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          <Clock size={10} style={{ color: 'var(--text-muted)' }} />
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {eventLabel}
          </span>
        </div>
      )}

      {/* Render Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {blocks.map((b, idx) => {
          const numberCount = blocks.slice(0, idx + 1).filter(item => item.isNumber).length;
          const inputClass = b.isHeading
            ? 'node-heading-input'
            : b.isSubheading
            ? 'node-subheading-input'
            : 'block-text-input';

          if (!showCompleted && b.isCheck && b.completed) return null;

          return (
            <div key={b.id || idx} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div className="block-row">
                {b.isCheck && (
                  <button
                    className={`block-checkmark ${b.completed ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newBlocks = [...blocks];
                      newBlocks[idx] = { ...b, completed: !b.completed };
                      updateBlocks(newBlocks);
                    }}
                  >
                    {b.completed && <Check size={11} strokeWidth={3} />}
                  </button>
                )}
                {b.isBullet && (
                  <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-ink)', marginTop: '2px', minWidth: '14px' }}>•</span>
                )}
                {b.isNumber && (
                  <span className="numbered-badge">{numberCount}.</span>
                )}
                {b.isToggle && (
                  <span
                    className={`toggle-arrow ${b.isOpen ? 'open' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newBlocks = [...blocks];
                      newBlocks[idx] = { ...b, isOpen: !b.isOpen };
                      updateBlocks(newBlocks);
                    }}
                  >
                    <ChevronRight size={14} />
                  </span>
                )}
                <input
                  ref={(el) => (inputRefs.current[`main_${idx}`] = el)}
                  type="text"
                  className={`${inputClass} ${b.completed ? 'completed' : ''} ${b.isBold ? 'is-bold' : ''}`}
                  value={b.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  placeholder={b.isHeading ? 'Título...' : b.isSubheading ? 'Subtítulo...' : 'Escribe...'}
                />
              </div>

              {b.isToggle && b.isOpen && (
                <div style={{ paddingLeft: '22px', borderLeft: 'var(--border-hairline)', marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(b.children || []).map((childText, cIdx) => (
                    <div key={cIdx} className="block-row">
                      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>•</span>
                      <input
                        ref={(el) => (inputRefs.current[`child_${idx}_${cIdx}`] = el)}
                        type="text"
                        className={`block-text-input ${b.isBold ? 'is-bold' : ''}`}
                        style={{ fontSize: '0.86rem' }}
                        value={childText}
                        onChange={(e) => {
                          const children = [...(b.children || [])];
                          children[cIdx] = e.target.value;
                          const newBlocks = [...blocks];
                          newBlocks[idx] = { ...b, children };
                          updateBlocks(newBlocks);
                        }}
                        onKeyDown={(e) => handleChildKeyDown(e, idx, cIdx)}
                        placeholder="Sub-elemento..."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
