import React, { useState, useRef } from 'react';
import { FluentDocBlock } from './FluentDocBlock';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Grid,
  Layers,
  FileText,
  FilePlus,
  Trash2,
  Move,
  Layout,
  StickyNote,
  Sparkles,
  BookOpen
} from 'lucide-react';

const EMOJI_OPTIONS = ['📝', '💡', '🚀', '📌', '🎨', '🎯', '📚', '⚡', '🌟', '🧠'];

export function FreeformDocEditor({
  documents = [],
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onUpdateDoc,
  onDeleteDoc,
  gridMode,
  onGridModeChange,
  onTransitionToBoard,
  onTransitionToPlanner
}) {
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(0);
  const [activeSpatialDragId, setActiveSpatialDragId] = useState(null);
  const dragRef = useRef(null);

  // Fallback default document if none exist
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0] || {
    id: 'doc_default',
    title: 'Notas en Documento Libre',
    icon: '📝',
    blocks: [
      { id: 'b1', type: 'heading-1', text: 'Bienvenido al Editor de Documentos' },
      { id: 'b2', type: 'callout', text: 'Escribe de forma fluida estilo Notion y arrastra cualquier elemento libremente por el margen.', color: 'amber' },
      { id: 'b3', type: 'paragraph', text: 'Presiona Enter para crear un nuevo párrafo, Tab para sangrar o "/" para ver el menú de bloques.' },
      { id: 'b4', type: 'check', text: 'Probar el editor estilo Notion', completed: true },
      { id: 'b5', type: 'check', text: 'Arrastrar un bloque al margen libre', completed: false }
    ],
    floatingNotes: [
      { id: 'fn1', x: 740, y: 180, title: 'Nota al Margen', text: 'Puedes colocar tarjetas post-it o bloques libres flotando en el margen derecho.' }
    ]
  };

  const blocks = currentDoc.blocks || [];
  const floatingNotes = currentDoc.floatingNotes || [];

  // --- Document Update Helpers ---
  const updateBlocks = (newBlocks) => {
    onUpdateDoc({ ...currentDoc, blocks: newBlocks });
  };

  const updateFloatingNotes = (newFloating) => {
    onUpdateDoc({ ...currentDoc, floatingNotes: newFloating });
  };

  // --- Block Mutators ---
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
        const curIndent = b.indent || 0;
        return { ...b, indent: Math.min(curIndent + 1, 4) };
      }
      return b;
    });
    updateBlocks(next);
  };

  const handleOutdentBlock = (blockId) => {
    const next = blocks.map(b => {
      if (b.id === blockId) {
        const curIndent = b.indent || 0;
        return { ...b, indent: Math.max(curIndent - 1, 0) };
      }
      return b;
    });
    updateBlocks(next);
  };

  // --- Spatial Floating Notes ---
  const handleAddFloatingNote = () => {
    const newFloating = [
      ...floatingNotes,
      {
        id: `fn_${Date.now()}`,
        x: 740,
        y: 220 + floatingNotes.length * 120,
        title: 'Idea Libre',
        text: 'Escribe una nota flotante...'
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

  // --- Spatial Block Dragging ---
  const handleDragStartBlock = (e, blockId) => {
    // Convert block to floating note when dragged out to margin
    const targetBlock = blocks.find(b => b.id === blockId);
    if (!targetBlock) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      initialRect: rect
    };
    setActiveSpatialDragId(blockId);
  };

  const handleSpatialMouseMove = (e) => {
    if (!dragRef.current) return;
    const { blockId, startX, startY } = dragRef.current;
    const dx = e.clientX - startX;

    // If dragged more than 150px to the right, detach from document column into margin note
    if (dx > 150) {
      const targetBlock = blocks.find(b => b.id === blockId);
      if (targetBlock) {
        // Remove from structured document blocks
        const newBlocks = blocks.filter(b => b.id !== blockId);
        // Add to spatial floating notes
        const newFloating = [
          ...floatingNotes,
          {
            id: `fn_${Date.now()}`,
            x: Math.round((e.clientX - 100) / 24) * 24,
            y: Math.round((e.clientY - 80) / 28) * 28,
            title: targetBlock.type === 'heading-1' ? targetBlock.text : 'Nota Desplazada',
            text: targetBlock.text || 'Nota libre'
          }
        ];
        updateBlocks(newBlocks);
        updateFloatingNotes(newFloating);
        dragRef.current = null;
        setActiveSpatialDragId(null);
      }
    }
  };

  const handleSpatialMouseUp = () => {
    dragRef.current = null;
    setActiveSpatialDragId(null);
  };

  const gridClass = gridMode === 'dots' ? 'bg-grid-dots' : gridMode === 'lines' ? 'bg-grid-lines' : 'bg-clean';

  return (
    <div
      className={`freeform-doc-view ${gridClass}`}
      onMouseMove={handleSpatialMouseMove}
      onMouseUp={handleSpatialMouseUp}
    >
      {/* Top Header Controls */}
      <header className="doc-top-header">
        <div className="doc-nav-buttons">
          <button className="btn-icon active" onClick={onTransitionToBoard}>
            <ArrowUp size={14} />
            <span className="font-mono">↑ Vista 1: Lienzo Libre</span>
          </button>
          <button className="btn-icon" onClick={onTransitionToPlanner}>
            <ArrowDown size={14} />
            <span className="font-mono">↓ Vista 3: Planificador</span>
          </button>
        </div>

        {/* Multi-Document Tabs Switcher */}
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
          <button className="doc-tab-add" onClick={onCreateDoc} title="Nueva Nota en Documento">
            <FilePlus size={14} />
          </button>
        </div>

        {/* Grid Mode Controls */}
        <div className="doc-grid-controls">
          <button
            className={`btn-icon ${gridMode === 'dots' ? 'active' : ''}`}
            onClick={() => onGridModeChange('dots')}
          >
            <Grid size={13} />
          </button>
          <button
            className={`btn-icon ${gridMode === 'lines' ? 'active' : ''}`}
            onClick={() => onGridModeChange('lines')}
          >
            <Layers size={13} />
          </button>
          <button className="btn-icon active" onClick={handleAddFloatingNote} title="Añadir Nota Flotante al Margen">
            <StickyNote size={13} />
            <span className="font-mono">+ Margen</span>
          </button>
        </div>
      </header>

      {/* Main Document Workspace */}
      <div className="doc-workspace-container">
        {/* Central Fluid Document Container */}
        <div className="doc-main-paper">
          {/* Document Header (Icon Emoji & Title) */}
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
              className="doc-title-input"
              placeholder="Título del Documento..."
              value={currentDoc.title || ''}
              onChange={(e) => onUpdateDoc({ ...currentDoc, title: e.target.value })}
            />
          </div>

          {/* Fluid Notion-style Block Editor Stack */}
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
                onDragStartBlock={handleDragStartBlock}
                isFocused={focusedBlockIndex === idx}
              />
            ))}
          </div>

          {/* Bottom Add Block Trigger */}
          <button
            className="doc-add-block-bottom font-mono"
            onClick={() => handleAddBlockBelow(blocks[blocks.length - 1]?.id)}
          >
            <Plus size={14} />
            <span>Añadir bloque</span>
          </button>
        </div>

        {/* Spatial Margin Canvas (Freeform Floating Notes) */}
        <div className="doc-spatial-margin">
          <div className="margin-header font-mono">
            <span>MARGEN LIBRE — POST-ITS</span>
            <span className="margin-hint">(Arrastra bloques aquí para independizarlos)</span>
          </div>

          {floatingNotes.map(fn => (
            <div
              key={fn.id}
              className="floating-margin-card"
              style={{
                top: `${fn.y}px`,
                left: `${fn.x}px`
              }}
            >
              <div className="margin-card-header">
                <input
                  type="text"
                  className="margin-card-title-input"
                  value={fn.title || ''}
                  onChange={(e) => handleUpdateFloatingNote(fn.id, { title: e.target.value })}
                  placeholder="Título..."
                />
                <button
                  className="margin-card-delete"
                  onClick={() => handleDeleteFloatingNote(fn.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <textarea
                className="margin-card-textarea"
                value={fn.text || ''}
                onChange={(e) => handleUpdateFloatingNote(fn.id, { text: e.target.value })}
                placeholder="Escribe en este bloque libre..."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
