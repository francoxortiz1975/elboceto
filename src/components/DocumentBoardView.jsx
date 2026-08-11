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
  onTransitionToBoard,
  onMouseMoveSurface
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
        onMouseMoveSurface={onMouseMoveSurface}
      />

      {/* Subtle Transparent Spatial Navigation Trigger to Main Canvas Board — Centered on X-axis */}
      <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
        <button
          className="subtle-spatial-nav"
          onClick={onTransitionToBoard}
          title="Ir al Lienzo Principal"
        >
          <ChevronDown size={14} />
          <span className="nav-label font-mono">Lienzo</span>
        </button>
      </div>
    </div>
  );
}
