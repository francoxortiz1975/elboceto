import React, { useState, useRef, useEffect } from 'react';
import {
  GripVertical,
  Check,
  Sparkles,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Trash2,
  Bold,
  Italic,
  Underline
} from 'lucide-react';

export function FluentDocBlock({
  block,
  index,
  totalBlocks,
  onUpdateBlock,
  onDeleteBlock,
  onAddBlockBelow,
  onFocusBlock,
  onIndentBlock,
  onOutdentBlock,
  onDragStartBlock,
  isFocused
}) {
  const inputRef = useRef(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleTextChange = (e) => {
    const text = e.target.value;

    if (text.endsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter('');
    } else if (showSlashMenu) {
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex !== -1) {
        setSlashFilter(text.slice(slashIndex + 1).toLowerCase());
      } else {
        setShowSlashMenu(false);
      }
    }

    if (block.type === 'paragraph' || !block.type) {
      if (text.startsWith('# ')) {
        onUpdateBlock(block.id, { type: 'heading-1', text: text.slice(2) });
        return;
      }
      if (text.startsWith('## ')) {
        onUpdateBlock(block.id, { type: 'heading-2', text: text.slice(3) });
        return;
      }
      if (text.startsWith('### ')) {
        onUpdateBlock(block.id, { type: 'heading-3', text: text.slice(4) });
        return;
      }
      if (text.startsWith('[] ') || text.startsWith('- ')) {
        onUpdateBlock(block.id, { type: 'check', text: text.slice(text.indexOf(' ') + 1), completed: false });
        return;
      }
      if (text.startsWith('* ')) {
        onUpdateBlock(block.id, { type: 'bullet', text: text.slice(2) });
        return;
      }
      if (text.startsWith('1. ')) {
        onUpdateBlock(block.id, { type: 'numbered', text: text.slice(3) });
        return;
      }
      if (text.startsWith('! ')) {
        onUpdateBlock(block.id, { type: 'callout', text: text.slice(2) });
        return;
      }
      if (text.startsWith('> ')) {
        onUpdateBlock(block.id, { type: 'quote', text: text.slice(2) });
        return;
      }
      if (text === '---') {
        onUpdateBlock(block.id, { type: 'divider', text: '' });
        onAddBlockBelow(block.id);
        return;
      }
    }

    onUpdateBlock(block.id, { text });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setShowToolbar(false);
      return;
    }

    if (showSlashMenu && e.key === 'Enter') {
      e.preventDefault();
      const filteredOptions = SLASH_OPTIONS.filter(opt => opt.label.toLowerCase().includes(slashFilter));
      if (filteredOptions.length > 0) {
        applyBlockType(filteredOptions[0].type, filteredOptions[0].extraProps);
      }
      setShowSlashMenu(false);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdentBlock(block.id);
      } else {
        onIndentBlock(block.id);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setShowSlashMenu(false);
      setShowToolbar(false);
      if ((block.type === 'check' || block.type === 'bullet' || block.type === 'numbered') && !block.text) {
        onUpdateBlock(block.id, { type: 'paragraph' });
        return;
      }
      onAddBlockBelow(block.id);
      return;
    }

    if (e.key === 'Backspace' && !block.text && totalBlocks > 1) {
      e.preventDefault();
      setShowSlashMenu(false);
      setShowToolbar(false);
      onDeleteBlock(block.id);
      return;
    }

    if (e.key === 'ArrowUp' && index > 0 && e.target.selectionStart === 0) {
      e.preventDefault();
      onFocusBlock(index - 1);
    }
    if (e.key === 'ArrowDown' && index < totalBlocks - 1 && e.target.selectionStart === (block.text || '').length) {
      e.preventDefault();
      onFocusBlock(index + 1);
    }
  };

  const handleContextMenuBlock = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowToolbar(true);
  };

  const applyBlockType = (type, extraProps = {}) => {
    const cleanText = (block.text || '').replace(/\/[\w]*$/, '').trim();
    onUpdateBlock(block.id, { type, text: cleanText, ...extraProps });
    setShowSlashMenu(false);
  };

  const indentLevel = block.indent || 0;
  const indentPadding = indentLevel * 20;

  const SLASH_OPTIONS = [
    { label: 'Texto libre', icon: Type, type: 'paragraph' },
    { label: 'Título 1', icon: Heading1, type: 'heading-1' },
    { label: 'Título 2', icon: Heading2, type: 'heading-2' },
    { label: 'Título 3', icon: Heading3, type: 'heading-3' },
    { label: 'Lista de Tareas', icon: CheckSquare, type: 'check', extraProps: { completed: false } },
    { label: 'Viñeta', icon: List, type: 'bullet' },
    { label: 'Lista Numerada', icon: ListOrdered, type: 'numbered' },
    { label: 'Destacado', icon: Sparkles, type: 'callout' },
    { label: 'Cita', icon: Quote, type: 'quote' },
    { label: 'Línea Divisoria', icon: Minus, type: 'divider' },
  ];

  const filteredSlashOptions = SLASH_OPTIONS.filter(opt => opt.label.toLowerCase().includes(slashFilter));

  const textStyle = {
    fontWeight: block.isBold ? '700' : 'normal',
    fontStyle: block.isItalic ? 'italic' : 'normal',
    textDecoration: block.isUnderline ? 'underline' : block.completed ? 'line-through' : 'none'
  };

  return (
    <div
      className={`fluent-doc-block type-${block.type || 'paragraph'} ${block.completed ? 'is-completed' : ''}`}
      style={{
        paddingLeft: `${indentPadding}px`,
        top: block.y ? `${block.y}px` : undefined,
        left: block.x ? `${block.x}px` : undefined,
        position: block.x !== undefined ? 'absolute' : 'relative'
      }}
      onContextMenu={handleContextMenuBlock}
    >
      {/* Drag handle */}
      <div
        className="doc-block-grip"
        onMouseDown={(e) => onDragStartBlock(e, block.id)}
        title="Mantén presionado para mover bloque"
      >
        <GripVertical size={14} />
      </div>

      {/* Floating Toolbar Context Menu (Shown on Double-Click or Focus Toggle) */}
      {(showToolbar || (isFocused && showToolbar)) && (
        <div className="doc-block-toolbar">
          <button
            className={`toolbar-btn ${block.type === 'heading-1' ? 'active' : ''}`}
            onClick={() => applyBlockType('heading-1')}
            title="Título 1"
          >
            <Heading1 size={13} />
          </button>
          <button
            className={`toolbar-btn ${block.type === 'heading-2' ? 'active' : ''}`}
            onClick={() => applyBlockType('heading-2')}
            title="Título 2"
          >
            <Heading2 size={13} />
          </button>
          <button
            className={`toolbar-btn ${block.type === 'paragraph' ? 'active' : ''}`}
            onClick={() => applyBlockType('paragraph')}
            title="Texto"
          >
            <Type size={13} />
          </button>
          <button
            className={`toolbar-btn ${block.type === 'check' ? 'active' : ''}`}
            onClick={() => applyBlockType('check')}
            title="Tarea"
          >
            <CheckSquare size={13} />
          </button>

          <div className="toolbar-divider" />

          <button
            className={`toolbar-btn ${block.isBold ? 'active' : ''}`}
            onClick={() => onUpdateBlock(block.id, { isBold: !block.isBold })}
            title="Negrita"
          >
            <Bold size={13} />
          </button>
          <button
            className={`toolbar-btn ${block.isItalic ? 'active' : ''}`}
            onClick={() => onUpdateBlock(block.id, { isItalic: !block.isItalic })}
            title="Cursiva"
          >
            <Italic size={13} />
          </button>
          <button
            className={`toolbar-btn ${block.isUnderline ? 'active' : ''}`}
            onClick={() => onUpdateBlock(block.id, { isUnderline: !block.isUnderline })}
            title="Subrayado"
          >
            <Underline size={13} />
          </button>

          <div className="toolbar-divider" />

          {/* Delete / Trash Icon inside toolbar as requested */}
          <button
            className="toolbar-btn danger"
            onClick={() => onDeleteBlock(block.id)}
            title="Eliminar bloque"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Block Content Renderer */}
      <div className="doc-block-content">
        {block.type === 'heading-1' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h1"
            style={textStyle}
            placeholder="Título 1"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(index)}
          />
        )}

        {block.type === 'heading-2' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h2"
            style={textStyle}
            placeholder="Título 2"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(index)}
          />
        )}

        {block.type === 'heading-3' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h3"
            style={textStyle}
            placeholder="Título 3"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(index)}
          />
        )}

        {block.type === 'check' && (
          <div className="doc-check-row">
            <button
              className={`doc-checkbox ${block.completed ? 'checked' : ''}`}
              onClick={() => onUpdateBlock(block.id, { completed: !block.completed })}
            >
              {block.completed && <Check size={12} />}
            </button>
            <input
              ref={inputRef}
              type="text"
              className={`doc-input doc-p ${block.completed ? 'line-through' : ''}`}
              style={textStyle}
              placeholder="Tarea..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocusBlock(index)}
            />
          </div>
        )}

        {block.type === 'bullet' && (
          <div className="doc-bullet-row">
            <span className="doc-bullet-dot">•</span>
            <input
              ref={inputRef}
              type="text"
              className="doc-input doc-p"
              style={textStyle}
              placeholder="Elemento..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocusBlock(index)}
            />
          </div>
        )}

        {block.type === 'numbered' && (
          <div className="doc-numbered-row">
            <span className="doc-number font-mono">{index + 1}.</span>
            <input
              ref={inputRef}
              type="text"
              className="doc-input doc-p"
              style={textStyle}
              placeholder="Punto..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocusBlock(index)}
            />
          </div>
        )}

        {block.type === 'callout' && (
          <div className="doc-callout-clean">
            <Sparkles size={15} className="doc-callout-icon" />
            <input
              ref={inputRef}
              type="text"
              className="doc-input doc-p"
              style={textStyle}
              placeholder="Nota o destacado..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocusBlock(index)}
            />
          </div>
        )}

        {block.type === 'quote' && (
          <div className="doc-quote-box">
            <input
              ref={inputRef}
              type="text"
              className="doc-input doc-quote"
              style={textStyle}
              placeholder="Escribe una cita..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocusBlock(index)}
            />
          </div>
        )}

        {block.type === 'divider' && (
          <div className="doc-divider-row">
            <hr className="doc-hr" />
          </div>
        )}

        {(!block.type || block.type === 'paragraph') && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-p"
            style={textStyle}
            placeholder="Escribe aquí... (doble clic para barra de herramientas, '/' para menú o '#' para título)"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(index)}
          />
        )}
      </div>

      {showSlashMenu && (
        <div className="slash-menu-popup">
          <div className="slash-menu-header font-mono">Convertir bloque</div>
          {filteredSlashOptions.length === 0 ? (
            <div className="slash-menu-empty font-mono">Sin resultados</div>
          ) : (
            filteredSlashOptions.map(opt => {
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.type}
                  className="slash-menu-item"
                  onClick={() => applyBlockType(opt.type, opt.extraProps)}
                >
                  <IconComp size={15} />
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
