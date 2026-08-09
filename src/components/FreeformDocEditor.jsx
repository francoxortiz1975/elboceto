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
  GripVertical,
  FileText,
  Sparkles,
  BookOpen,
  Feather,
  Bookmark,
  Compass,
  Lightbulb,
  PenTool,
  CheckSquare,
  Smile,
  X
} from 'lucide-react';

const ICON_MAP = {
  FileText,
  Sparkles,
  BookOpen,
  Feather,
  Bookmark,
  Compass,
  Layers,
  Lightbulb,
  PenTool,
  CheckSquare
};

const ICON_NAMES = Object.keys(ICON_MAP);

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
  const [showIconPicker, setShowIconPicker] = useState(false);
  const activeDrag = useRef(null);
  const [activeDraggingId, setActiveDraggingId] = useState(null);

  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0] || {
    id: 'doc_default',
    title: 'Notas Organizadas',
    iconName: 'FileText',
    showIcon: true,
    blocks: [
      { id: 'b1', type: 'heading-1', text: 'Notas Organizadas del Documento' },
      { id: 'b2', type: 'callout', text: 'Haz doble clic en cualquier lugar del lienzo para añadir un bloque o nota libre.' },
      { id: 'b3', type: 'paragraph', text: 'Arrastra cualquier título o bloque libremente por el tablero.' }
    ],
    floatingNotes: [
      { id: 'fn1', x: 740, y: 120, title: 'Post-it Libre', text: 'Esta tarjeta se puede mover libremente a cualquier posición.' }
    ]
  };

  const blocks = currentDoc.blocks || [];
  const floatingNotes = currentDoc.floatingNotes || [];
  const hasIcon = currentDoc.showIcon !== false && !!currentDoc.iconName;

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

  // Double Click Canvas anywhere to create a new block at exact double-clicked grid coordinates
  const handleDoubleClickCanvas = (e) => {
    if (
      e.target.closest('.fluent-doc-block') ||
      e.target.closest('.free-postit-card') ||
      e.target.closest('.doc-top-header') ||
      e.target.closest('.doc-header-inline')
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(24, Math.round((e.clientX - rect.left) / 24) * 24);
    const y = Math.max(80, Math.round((e.clientY - rect.top) / 28) * 28);

    const newBlock = {
      id: `b_${Date.now()}`,
      type: 'paragraph',
      text: '',
      x,
      y
    };
    const nextBlocks = [...blocks, newBlock];
    updateBlocks(nextBlocks);
    setFocusedBlockIndex(nextBlocks.length - 1);
  };

  // Dragging Spatial Blocks or Header Title
  const handleDragStartBlock = (e, blockId) => {
    e.stopPropagation();
    const targetBlock = blocks.find(b => b.id === blockId);
    const rect = e.currentTarget.getBoundingClientRect();

    activeDrag.current = {
      type: 'block',
      id: blockId,
      startX: e.clientX,
      startY: e.clientY,
      initX: targetBlock?.x !== undefined ? targetBlock.x : rect.left,
      initY: targetBlock?.y !== undefined ? targetBlock.y : rect.top
    };
    setActiveDraggingId(blockId);
  };

  const handleMouseDownPostIt = (e, noteId) => {
    if (e.target.closest('input') || e.target.closest('textarea') || e.target.closest('button')) return;
    const targetNote = floatingNotes.find(n => n.id === noteId);
    if (!targetNote) return;

    activeDrag.current = {
      type: 'postit',
      id: noteId,
      startX: e.clientX,
      startY: e.clientY,
      initX: targetNote.x,
      initY: targetNote.y
    };
    setActiveDraggingId(noteId);
  };

  const handleMouseMoveDocBoard = (e) => {
    if (!activeDrag.current) return;
    const { type, id, startX, startY, initX, initY } = activeDrag.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const snappedX = Math.max(24, Math.round((initX + dx) / 24) * 24);
    const snappedY = Math.max(80, Math.round((initY + dy) / 28) * 28);

    if (type === 'postit') {
      const next = floatingNotes.map(n => (n.id === id ? { ...n, x: snappedX, y: snappedY } : n));
      updateFloatingNotes(next);
    } else if (type === 'block') {
      const next = blocks.map(b => (b.id === id ? { ...b, x: snappedX, y: snappedY } : b));
      updateBlocks(next);
    }
  };

  const handleMouseUpDocBoard = () => {
    activeDrag.current = null;
    setActiveDraggingId(null);
  };

  const handleAddFloatingNote = () => {
    const newFloating = [
      ...floatingNotes,
      {
        id: `fn_${Date.now()}`,
        x: 640 + (floatingNotes.length % 3) * 220,
        y: 120 + Math.floor(floatingNotes.length / 3) * 160,
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

  const CurrentHeaderIcon = ICON_MAP[currentDoc.iconName || 'FileText'] || FileText;
  const gridClass = gridMode === 'dots' ? 'bg-grid-dots' : gridMode === 'lines' ? 'bg-grid-lines' : 'bg-clean';

  const centralBlocks = blocks.filter(b => b.x === undefined);
  const spatialBlocks = blocks.filter(b => b.x !== undefined);

  return (
    <div
      className={`freeform-doc-view ${gridClass}`}
      onMouseMove={handleMouseMoveDocBoard}
      onMouseUp={handleMouseUpDocBoard}
      onDoubleClick={handleDoubleClickCanvas}
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
          {documents.map(doc => {
            const TabIcon = ICON_MAP[doc.iconName || 'FileText'] || FileText;
            return (
              <button
                key={doc.id}
                className={`doc-tab-btn ${doc.id === currentDoc.id ? 'active' : ''}`}
                onClick={() => onSelectDoc(doc.id)}
              >
                {doc.showIcon !== false && <TabIcon size={14} className="doc-outline-icon" />}
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
            );
          })}
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

      {/* Main Document Board Canvas (Direct on Canvas Grid) */}
      <div className="doc-board-canvas">
        {/* Floating Post-Its Anywhere */}
        {floatingNotes.map(fn => (
          <div
            key={fn.id}
            className={`free-postit-card ${activeDraggingId === fn.id ? 'is-dragging' : ''}`}
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

        {/* Spatially Positioned Blocks Created via Double-Click Anywhere */}
        {spatialBlocks.map((block) => {
          const globalIdx = blocks.findIndex(b => b.id === block.id);
          return (
            <div
              key={block.id}
              className="spatial-block-wrapper"
              style={{
                position: 'absolute',
                left: `${block.x}px`,
                top: `${block.y}px`,
                zIndex: activeDraggingId === block.id ? 25 : 15,
                minWidth: '220px'
              }}
            >
              <FluentDocBlock
                block={block}
                index={globalIdx}
                totalBlocks={blocks.length}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onAddBlockBelow={handleAddBlockBelow}
                onFocusBlock={(newIdx) => setFocusedBlockIndex(newIdx)}
                onIndentBlock={handleIndentBlock}
                onOutdentBlock={handleOutdentBlock}
                onDragStartBlock={handleDragStartBlock}
                isFocused={focusedBlockIndex === globalIdx}
              />
            </div>
          );
        })}

        {/* Top-Left Aligned Main Document Content (No Useless Left Margin) */}
        <div className="doc-central-stream top-left-start">
          {/* Inline Title & Optional Icon directly to the Left */}
          <div className="doc-header-inline">
            {hasIcon ? (
              <div className="doc-icon-picker">
                <div className="doc-current-icon" onClick={() => setShowIconPicker(p => !p)}>
                  <CurrentHeaderIcon size={26} className="doc-outline-icon" />
                </div>
                {showIconPicker && (
                  <div className="doc-icon-dropdown">
                    {ICON_NAMES.map(name => {
                      const OptIcon = ICON_MAP[name];
                      return (
                        <button
                          key={name}
                          className="icon-opt-btn"
                          onClick={() => {
                            onUpdateDoc({ ...currentDoc, iconName: name });
                            setShowIconPicker(false);
                          }}
                        >
                          <OptIcon size={16} />
                        </button>
                      );
                    })}
                    <button
                      className="icon-opt-btn remove-icon-btn"
                      onClick={() => {
                        onUpdateDoc({ ...currentDoc, showIcon: false });
                        setShowIconPicker(false);
                      }}
                      title="Quitar icono"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-icon-subtle font-mono"
                onClick={() => onUpdateDoc({ ...currentDoc, showIcon: true, iconName: 'FileText' })}
                title="Añadir Icono Opcional"
              >
                <Smile size={14} />
                <span>+ Icono</span>
              </button>
            )}

            <input
              type="text"
              className="doc-title-input font-title"
              placeholder="Título del Documento..."
              value={currentDoc.title || ''}
              onChange={(e) => onUpdateDoc({ ...currentDoc, title: e.target.value })}
            />
          </div>

          {/* Fluid Central Block Stack */}
          <div className="doc-blocks-stack">
            {centralBlocks.map((block) => {
              const globalIdx = blocks.findIndex(b => b.id === block.id);
              return (
                <FluentDocBlock
                  key={block.id}
                  block={block}
                  index={globalIdx}
                  totalBlocks={blocks.length}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onAddBlockBelow={handleAddBlockBelow}
                  onFocusBlock={(newIdx) => setFocusedBlockIndex(newIdx)}
                  onIndentBlock={handleIndentBlock}
                  onOutdentBlock={handleOutdentBlock}
                  onDragStartBlock={handleDragStartBlock}
                  isFocused={focusedBlockIndex === globalIdx}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
