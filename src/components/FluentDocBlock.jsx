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
  Trash2
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
  const [slashFilter, setSlashFilter] = useState('');

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleTextChange = (e) => {
    const text = e.target.value;

    // Check for slash menu trigger
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

    // Check Markdown auto-conversions when typing at start of block
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
    if (e.key === 'Escape' && showSlashMenu) {
      setShowSlashMenu(false);
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

  return (
    <div
      className={`fluent-doc-block type-${block.type || 'paragraph'} ${block.completed ? 'is-completed' : ''}`}
      style={{ paddingLeft: `${indentPadding}px` }}
    >
      <div className="doc-block-grip" onMouseDown={(e) => onDragStartBlock(e, block.id)}>
        <GripVertical size={14} />
      </div>

      <div className="doc-block-content">
        {block.type === 'heading-1' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h1"
            placeholder="Título 1"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
        )}

        {block.type === 'heading-2' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h2"
            placeholder="Título 2"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
        )}

        {block.type === 'heading-3' && (
          <input
            ref={inputRef}
            type="text"
            className="doc-input doc-h3"
            placeholder="Título 3"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
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
              placeholder="Tarea..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
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
              placeholder="Elemento..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
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
              placeholder="Punto..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
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
              placeholder="Nota o destacado..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        {block.type === 'quote' && (
          <div className="doc-quote-box">
            <input
              ref={inputRef}
              type="text"
              className="doc-input doc-quote"
              placeholder="Escribe una cita..."
              value={block.text || ''}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
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
            placeholder="Escribe aquí... (usa '/' para menú o '#' para título)"
            value={block.text || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      <button className="doc-block-delete-btn" onClick={() => onDeleteBlock(block.id)} title="Eliminar bloque">
        <Trash2 size={13} />
      </button>

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
