import React, { useState, useRef } from 'react';
import { FluentDocBlock } from './FluentDocBlock';
import {
  Plus,
  ArrowDown,
  Grid,
  Layers,
  FilePlus,
  Trash2,
  StickyNote,
  GripVertical
} from 'lucide-react';

const EMOJI_OPTIONS = ['📝', '💡', '🚀', '📌', '🎨', '🎯', '📚', '⚡', '🧠'];

export function FreeformDocEditor({
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
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(0);
  const activePostitDrag = useRef(null);
  const [activeDraggingCardId, setActiveDraggingCardId] = useState(null);

  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0] || {
    id: 'doc_default',
    title: 'Notas Organizadas',
    icon: '📝',
    blocks: [
      { id: 'b1', type: 'heading-1', text: 'Notas Organizadas del Documento' },
      { id: 'b2', type: 'callout', text: 'Escribe de forma fluida y agrega post-its libres en cualquier parte del tablero.' },
      { id: 'b3', type: 'paragraph', text: 'Presiona Enter para nuevo párrafo o "/" para menú de bloques.' }
    ],
    floatingNotes: [
      { id: 'fn1', x: 80, y: 180, title: 'Idea Libres', text: 'Esta nota post-it se puede mover libremente a cualquier posición.' }
    ]
  };

  const blocks = currentDoc.blocks || [];
  const floatingNotes = currentDoc.floatingNotes || [];

  const updateBlocks = (newBlocks) => {
    onUpdateDoc({ ...currentDoc, blocks: newBlocks });
  };

  const updateFloatingNotes = (newFloating) => {
    onUpdateDoc({ ...currentDoc, floatingNotes: newFloating });
  };

  const handleUpdateBlock = (blockId, updates) => {
    const next = blocks.map(b => (b.id === blockId ? { ...b, ...updates } : b));
    updateBlocks(next);
  };

  const handleDeleteBlock = (blockId) => {
    if (blocks.length <= 1) return;
    const next = blocks.filter(b => b.id !== blockId);
    updateBlocks(next);
  };

  const handleAddBlockBelow = (targetBlockId) => {
    const idx = blocks.findIndex(b => b.id === targetBlockId);
    const newBlock = { id: `b_${Date.now()}`, type: 'paragraph', text: '' };
    const next = [...blocks];
    if (idx !== -1) {
      next.splice(idx + 1, 0, newBlock);
      setFocusedBlockIndex(idx + 1);
    } else {
      next.push(newBlock);
      setFocusedBlockIndex(next.length - 1);
    }
    updateBlocks(next);
  };

  const handleIndentBlock = (blockId) => {
    const next = blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, indent: Math.min((b.indent || 0) + 1, 4) };
      }
      return b;
    });
    updateBlocks(next);
  };

  const handleOutdentBlock = (blockId) => {
    const next = blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, indent: Math.max((b.indent || 0) - 1, 0) };
      }
      return b;
    });
    updateBlocks(next);
  };

  // Floating Post-It Management Anywhere on the Grid
  const handleAddFloatingNote = () => {
    const newFloating = [
      ...floatingNotes,
      {
        id: `fn_${Date.now()}`,
        x: 100 + (floatingNotes.length % 4) * 220,
        y: 160 + Math.floor(floatingNotes.length / 4) * 160,
        title: 'Post-it',
        text: 'Nota libre...'
      }
    ];
    updateFloatingNotes(newFloating);
  };

  const handleUpdateFloatingNote = (id, updates) => {
    const next = floatingNotes.map(n => (n.id === id ? { ...n, ...updates } : n));
    updateFloatingNotes(next);
  };

  const handleDeleteFloatingNote = (id) => {
    const next = floatingNotes.filter(n => n.id !== id);
    updateFloatingNotes(next);
  };

  // Drag Post-It Anywhere
  const handleMouseDownPostIt = (e, noteId) => {
    if (e.target.closest('input') || e.target.closest('textarea') || e.target.closest('button')) return;
    const targetNote = floatingNotes.find(n => n.id === noteId);
    if (!targetNote) return;

    activePostitDrag.current = {
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      initX: targetNote.x,
      initY: targetNote.y
    };
    setActiveDraggingCardId(noteId);
  };

  const handleMouseMoveDocBoard = (e) => {
    if (!activePostitDrag.current) return;
    const { noteId, startX, startY, initX, initY } = activePostitDrag.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const snappedX = Math.max(24, Math.round((initX + dx) / 24) * 24);
    const snappedY = Math.max(80, Math.round((initY + dy) / 28) * 28);

    const next = floatingNotes.map(n => (n.id === noteId ? { ...n, x: snappedX, y: snappedY } : n));
    updateFloatingNotes(next);
  };

  const handleMouseUpDocBoard = () => {
    activePostitDrag.current = null;
    setActiveDraggingCardId(null);
  };

  const gridClass = gridMode === 'dots' ? 'bg-grid-dots' : gridMode === 'lines' ? 'bg-grid-lines' : 'bg-clean';

  return (
    <div
      className={`freeform-doc-view ${gridClass}`}
      onMouseMove={handleMouseMoveDocBoard}
      onMouseUp={handleMouseUpDocBoard}
    >
      {/* Header Bar */}
      <header className="doc-top-header">
        <div className="doc-nav-buttons">
          <button className="btn-icon active" onClick={onTransitionToBoard}>
            <ArrowDown size={14} />
            <span className="font-mono">↓ Volver al Lienzo Principal</span>
          </button>
        </div>

        {/* Multi-Document Switcher Tabs */}
        <div className="doc-tabs-bar">
          {documents.map(doc => (
            <button
              key={doc.id}
              className={`doc-tab-btn ${doc.id === currentDoc.id ? 'active' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <span>{doc.icon || '📝'}</span>
              <span className="doc-tab-title">{doc.title || 'Sin Título'}</span>
              {documents.length > 1 && (
                <span
                  className="doc-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDoc(doc.id);
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="doc-tab-add" onClick={onCreateDoc} title="Nuevo Documento">
            <FilePlus size={14} />
          </button>
        </div>

        {/* Controls */}
        <div className="doc-grid-controls">
          <button
            className={`btn-icon ${gridMode === 'dots' ? 'active' : ''}`}
            onClick={() => onGridModeChange('dots')}
            title="Puntos"
          >
            <Grid size={13} />
          </button>
          <button
            className={`btn-icon ${gridMode === 'lines' ? 'active' : ''}`}
            onClick={() => onGridModeChange('lines')}
            title="Líneas"
          >
            <Layers size={13} />
          </button>
          <button className="btn-icon active" onClick={handleAddFloatingNote} title="Añadir Post-it al Lienzo">
            <StickyNote size={13} />
            <span className="font-mono">+ Post-it</span>
          </button>
        </div>
      </header>

      {/* Main Document Board Canvas (No paper background frame) */}
      <div className="doc-board-canvas">
        {/* Floating Post-Its Placed Anywhere on Grid */}
        {floatingNotes.map(fn => (
          <div
            key={fn.id}
            className={`free-postit-card ${activeDraggingCardId === fn.id ? 'is-dragging' : ''}`}
            style={{
              left: `${fn.x}px`,
              top: `${fn.y}px`
            }}
            onMouseDown={(e) => handleMouseDownPostIt(e, fn.id)}
          >
            <div className="postit-card-header">
              <GripVertical size={13} className="postit-grip" />
              <input
                type="text"
                className="postit-title-input font-title"
                value={fn.title || ''}
                onChange={(e) => handleUpdateFloatingNote(fn.id, { title: e.target.value })}
                placeholder="Título..."
              />
              <button
                className="postit-card-delete"
                onClick={() => handleDeleteFloatingNote(fn.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              className="postit-card-textarea"
              value={fn.text || ''}
              onChange={(e) => handleUpdateFloatingNote(fn.id, { text: e.target.value })}
              placeholder="Escribe aquí..."
            />
          </div>
        ))}

        {/* Central Organized Document Stream (Direct on Canvas Grid) */}
        <div className="doc-central-stream">
          {/* Header Title & Emoji */}
          <div className="doc-header-section">
            <div className="doc-emoji-picker">
              <span className="doc-current-emoji">{currentDoc.icon || '📝'}</span>
              <div className="doc-emoji-dropdown">
                {EMOJI_OPTIONS.map(emo => (
                  <button
                    key={emo}
                    className="emoji-opt"
                    onClick={() => onUpdateDoc({ ...currentDoc, icon: emo })}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              className="doc-title-input font-title"
              placeholder="Título del Documento..."
              value={currentDoc.title || ''}
              onChange={(e) => onUpdateDoc({ ...currentDoc, title: e.target.value })}
            />
          </div>

          {/* Fluid Block Stack */}
          <div className="doc-blocks-stack">
            {blocks.map((block, idx) => (
              <FluentDocBlock
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={blocks.length}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onAddBlockBelow={handleAddBlockBelow}
                onFocusBlock={(newIdx) => setFocusedBlockIndex(newIdx)}
                onIndentBlock={handleIndentBlock}
                onOutdentBlock={handleOutdentBlock}
                onDragStartBlock={() => {}}
                isFocused={focusedBlockIndex === idx}
              />
            ))}
          </div>

          {/* Add block button */}
          <button
            className="doc-add-block-bottom font-mono"
            onClick={() => handleAddBlockBelow(blocks[blocks.length - 1]?.id)}
          >
            <Plus size={14} />
            <span>Añadir línea / bloque</span>
          </button>
        </div>
      </div>
    </div>
  );
}
