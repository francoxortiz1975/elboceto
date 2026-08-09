import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasBoard } from './CanvasBoard';
import {
  Plus,
  StickyNote,
  Grid,
  Layers,
  Undo2,
  Redo2,
  CheckSquare,
  MapPin,
  BookOpen,
  FileText,
  Trash2,
  ChevronDown,
  ArrowDown
} from 'lucide-react';

export function DocumentBoardView({
  documents = [],
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onUpdateDoc,
  onDeleteDoc,
  gridMode,
  onGridModeChange,
  onTransitionToBoard
}) {
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0] || {
    id: 'doc_default',
    title: 'Notas Organizadas',
    icon: '📝',
    notes: [
      {
        id: 'note_default_title',
        x: 48,
        y: 56,
        isCard: false,
        blocks: [
          { id: 'b_title_1', isHeading: true, text: 'Notas Organizadas' },
          { id: 'b_check_1', isCheck: true, text: 'Tablero individual de notas organizables', completed: true }
        ]
      }
    ],
    viewport: { pan: { x: 0, y: 140 } }
  };

  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Viewport pan state per document
  const pan = currentDoc.viewport?.pan || { x: 0, y: 140 };
  const homePin = currentDoc.viewport?.homePin || { x: 0, y: 140 };

  const setPan = (newPan) => {
    onUpdateDoc({
      ...currentDoc,
      viewport: {
        ...(currentDoc.viewport || {}),
        pan: typeof newPan === 'function' ? newPan(pan) : newPan
      }
    });
  };

  const notes = currentDoc.notes || [];

  // Sync title from top-left title block automatically
  const handleUpdateNotes = (newNotes) => {
    const titleNode = newNotes.find(n => n.blocks && n.blocks.some(b => b.isHeading));
    let newTitle = currentDoc.title;
    if (titleNode) {
      const headingBlock = titleNode.blocks.find(b => b.isHeading);
      if (headingBlock && headingBlock.text && headingBlock.text !== 'Insertar Título...') {
        newTitle = headingBlock.text;
      }
    }
    onUpdateDoc({
      ...currentDoc,
      title: newTitle,
      notes: newNotes
    });
  };

  const handleUpdateNote = (updatedNote) => {
    const nextNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
    handleUpdateNotes(nextNotes);
  };

  const handleDeleteNote = (noteId) => {
    const nextNotes = notes.filter(n => n.id !== noteId);
    handleUpdateNotes(nextNotes);
  };

  const handleAddNote = (x = 120, y = 140, isCard = false) => {
    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      x,
      y,
      isCard,
      date: 'Hoy',
      calendarSynced: false,
      blocks: [
        { id: 'b_' + Date.now(), text: '', isCheck: false }
      ]
    };
    const nextNotes = [...notes, newNote];
    handleUpdateNotes(nextNotes);
    setSelectedNoteIds([newNote.id]);
  };

  const handleGoToHomePin = () => {
    setPan(homePin);
  };

  const handleConfirmSetHomePin = () => {
    onUpdateDoc({
      ...currentDoc,
      viewport: {
        ...(currentDoc.viewport || {}),
        homePin: { ...pan }
      }
    });
    setShowPinConfirm(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Top Header for Document Note Board */}
      <header className="top-header">
        <div className="brand-pill" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowDocDropdown(prev => !prev)}>
          <span className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {currentDoc.icon || '📝'} {currentDoc.title || 'Sin título'}
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </span>
          <span className="minimal-badge">Tablero de Nota</span>

          {/* Document Switcher Dropdown */}
          {showDocDropdown && (
            <div
              className="event-scheduler-popover"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: '260px',
                zIndex: 1000,
                boxShadow: 'var(--shadow-floating)'
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <div className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Mis Notas Guardadas ({documents.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {documents.map(d => (
                  <div
                    key={d.id}
                    className={`sidebar-item ${d.id === currentDoc.id ? 'active' : ''}`}
                    style={{ padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => {
                      onSelectDoc(d.id);
                      setShowDocDropdown(false);
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.icon || '📝'} {d.title || 'Sin título'}
                    </span>
                    {documents.length > 1 && (
                      <button
                        className="btn-icon"
                        style={{ padding: '2px', color: 'var(--text-muted)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(d.id);
                        }}
                        title="Eliminar esta nota"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="btn-icon active"
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                onClick={() => {
                  onCreateDoc();
                  setShowDocDropdown(false);
                }}
              >
                <Plus size={13} />
                <span>+ Nueva Nota en Pizarra</span>
              </button>
            </div>
          )}
        </div>

        {/* Floating Board Toolbar */}
        <div className="floating-toolbar">
          <button className="btn-icon active" onClick={() => handleAddNote(180, 180, false)}>
            <Plus size={14} />
            <span className="font-mono">Escribir</span>
          </button>

          <button className="btn-icon" onClick={() => handleAddNote(240, 240, true)} title="Añadir tarjeta Post-It">
            <StickyNote size={13} />
            <span className="font-mono">Post-it</span>
          </button>

          <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

          <button
            className={`btn-icon ${gridMode === 'dots' ? 'active' : ''}`}
            onClick={() => onGridModeChange('dots')}
            title="Cuadrícula Puntos"
          >
            <Grid size={13} />
            <span className="font-mono">Puntos</span>
          </button>
          <button
            className={`btn-icon ${gridMode === 'lines' ? 'active' : ''}`}
            onClick={() => onGridModeChange('lines')}
            title="Líneas Cuaderno"
          >
            <Layers size={13} />
            <span className="font-mono">Líneas</span>
          </button>

          <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

          <button
            className={`btn-icon ${showCompleted ? 'active' : ''}`}
            onClick={() => setShowCompleted(p => !p)}
            title={showCompleted ? "Ocultar tareas completadas" : "Mostrar tareas completadas"}
          >
            <CheckSquare size={13} />
            <span className="font-mono">{showCompleted ? 'Ver completadas' : 'Ocultar Done'}</span>
          </button>

          <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <button
              className="btn-icon"
              onClick={handleGoToHomePin}
              onDoubleClick={() => setShowPinConfirm(prev => !prev)}
              title="Ir a Inicio"
            >
              <MapPin size={13} />
              <span className="font-mono">Inicio</span>
            </button>
            <button
              className="btn-pin-subtle font-mono"
              onClick={() => setShowPinConfirm(prev => !prev)}
              title="Fijar vista actual como nueva posición de Inicio"
            >
              📍
            </button>

            {showPinConfirm && (
              <div className="home-pin-popover">
                <div className="home-pin-title font-mono">📍 Posición Fija de Inicio</div>
                <div className="home-pin-desc">
                  ¿Fijar la vista actual (`X: {pan.x}, Y: {pan.y}`) como tu posición inicial predeterminada?
                </div>
                <div className="home-pin-actions">
                  <button className="btn-pin-cancel font-mono" onClick={() => setShowPinConfirm(false)}>
                    Cancelar
                  </button>
                  <button className="btn-pin-confirm font-mono" onClick={handleConfirmSetHomePin}>
                    Fijar Posición
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

          <button
            className="btn-icon active font-mono"
            onClick={onCreateDoc}
            title="Crear un nuevo tablero de Nota"
          >
            <Plus size={13} />
            <span>Nueva Nota</span>
          </button>
        </div>
      </header>

      {/* Identical Infinite Canvas Board */}
      <CanvasBoard
        notes={notes}
        selectedNoteIds={selectedNoteIds}
        onSelectNotes={setSelectedNoteIds}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
        onOpenCalendarModal={() => {}}
        onDoubleTapCanvas={(x, y) => handleAddNote(x, y, false)}
        gridMode={gridMode}
        pan={pan}
        onPanChange={setPan}
        showCompleted={showCompleted}
      />

      {/* Spatial Navigation Trigger to Main Canvas Board */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
        <button
          className="btn-icon active"
          style={{ borderRadius: '20px', padding: '8px 14px', boxShadow: 'var(--shadow-floating)' }}
          onClick={onTransitionToBoard}
        >
          <ArrowDown size={14} />
          <span className="font-mono">↓ Ir al Lienzo Principal</span>
        </button>
      </div>
    </div>
  );
}
