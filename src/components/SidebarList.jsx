import React, { useState } from 'react';
import { X, Search, Plus, Calendar, CheckSquare, Sparkles } from 'lucide-react';

export function SidebarList({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  onAddNote,
  onOpenCalendarModal
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | check | calendar

  const filteredNotes = notes.filter(n => {
    const textContent = (n.title || '') + ' ' + (n.blocks ? n.blocks.map(b => b.text).join(' ') : '');
    const matchesSearch = textContent.toLowerCase().includes(query.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'check') {
      return n.blocks && n.blocks.some(b => b.type === 'check' && !b.completed);
    }
    if (filter === 'calendar') {
      return n.calendarSynced;
    }

    return true;
  });

  return (
    <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span className="brand-title" style={{ fontSize: '1.4rem' }}>Índice de Cuaderno</span>
        <button className="btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: '14px 20px 0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="modal-input font-body"
            style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar notas o tareas..."
          />
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`block-type-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({notes.length})
          </button>
          <button
            className={`block-type-btn ${filter === 'check' ? 'active' : ''}`}
            onClick={() => setFilter('check')}
          >
            Pendientes
          </button>
          <button
            className={`block-type-btn ${filter === 'calendar' ? 'active' : ''}`}
            onClick={() => setFilter('calendar')}
          >
            Google Cal
          </button>
        </div>

        <button
          className="btn-icon active"
          style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          onClick={() => {
            onAddNote();
            onClose();
          }}
        >
          <Plus size={14} />
          <span>Nueva Nota en Pizarra</span>
        </button>
      </div>

      <div className="sidebar-content">
        {filteredNotes.length === 0 ? (
          <div className="font-mono" style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '30px', fontSize: '0.8rem' }}>
            No se encontraron notas.
          </div>
        ) : (
          filteredNotes.map(n => {
            const checkBlocks = (n.blocks || []).filter(b => b.type === 'check');
            const totalChecks = checkBlocks.length;
            const completedChecks = checkBlocks.filter(b => b.completed).length;

            return (
              <div
                key={n.id}
                className="sidebar-item"
                onClick={() => {
                  onSelectNote(n.id);
                  onClose();
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h4 className="font-title" style={{ fontSize: '1.25rem', fontStyle: 'italic' }}>
                    {n.title || 'Sin título'}
                  </h4>
                  <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {n.date}
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.blocks && n.blocks[0] ? n.blocks[0].text || '(vacío)' : '(nota vacía)'}
                </p>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  {totalChecks > 0 && (
                    <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckSquare size={10} /> {completedChecks}/{totalChecks}
                    </span>
                  )}
                  {n.calendarSynced && (
                    <span className="font-mono" style={{ fontSize: '0.65rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={10} /> Google Cal
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
