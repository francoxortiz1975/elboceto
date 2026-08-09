import React, { useState } from 'react';
import { GripHorizontal, Trash2, Calendar, CheckSquare, ListOrdered, ListCollapse, AlignLeft, Check } from 'lucide-react';
import { ChecklistBlock } from './BlockItems/ChecklistBlock';
import { NumberedBlock } from './BlockItems/NumberedBlock';
import { ToggleBlock } from './BlockItems/ToggleBlock';

export function NoteBlock({
  note,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onOpenCalendarModal,
  onDragStart
}) {
  const [isMouseDownOnHeader, setIsMouseDownOnHeader] = useState(false);

  const handleTitleChange = (e) => {
    onUpdate({ ...note, title: e.target.value });
  };

  const handleBlockChange = (index, updatedBlock) => {
    const newBlocks = [...note.blocks];
    newBlocks[index] = updatedBlock;
    onUpdate({ ...note, blocks: newBlocks });
  };

  const handleBlockDelete = (index) => {
    if (note.blocks.length <= 1) return; // Keep at least 1 block
    const newBlocks = note.blocks.filter((_, i) => i !== index);
    onUpdate({ ...note, blocks: newBlocks });
  };

  const handleAddBlock = (type = 'check') => {
    const newBlock = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      text: '',
      completed: false,
      isOpen: type === 'toggle',
      children: type === 'toggle' ? [''] : []
    };
    onUpdate({ ...note, blocks: [...note.blocks, newBlock] });
  };

  const handleEnterKeyOnBlock = (index) => {
    const currentBlock = note.blocks[index];
    const newBlock = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: currentBlock ? currentBlock.type : 'check',
      text: '',
      completed: false,
      isOpen: true,
      children: []
    };
    const newBlocks = [...note.blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onUpdate({ ...note, blocks: newBlocks });
  };

  // Count progress if there are checkmarks
  const checkBlocks = note.blocks.filter(b => b.type === 'check');
  const completedChecks = checkBlocks.filter(b => b.completed).length;
  const progressPercent = checkBlocks.length > 0 ? Math.round((completedChecks / checkBlocks.length) * 100) : null;

  return (
    <div
      className={`note-card ${isSelected ? 'selected' : ''}`}
      style={{
        transform: `translate3d(${note.x}px, ${note.y}px, 0)`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(note.id);
      }}
    >
      {/* Note Header / Drag handle */}
      <div
        className="note-header"
        onMouseDown={(e) => onDragStart(e, note.id)}
        onTouchStart={(e) => onDragStart(e, note.id)}
      >
        <div className="note-drag-handle">
          <GripHorizontal size={14} />
          <span className="font-mono">{note.date || 'Hoy'}</span>
          {progressPercent !== null && (
            <span className="font-mono" style={{ opacity: 0.7, fontSize: '0.65rem' }}>
              {completedChecks}/{checkBlocks.length} ({progressPercent}%)
            </span>
          )}
        </div>

        <div className="note-actions">
          {note.calendarSynced ? (
            <span className="font-mono" style={{ fontSize: '0.65rem', color: '#16a34a', padding: '2px 4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Check size={10} /> Cal
            </span>
          ) : (
            <button
              className="btn-icon"
              style={{ padding: '2px 4px' }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenCalendarModal(note);
              }}
              title="Conectar a Google Calendar"
            >
              <Calendar size={13} />
            </button>
          )}

          <button
            className="btn-icon"
            style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            title="Eliminar nota"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        className="note-title-input"
        value={note.title || ''}
        onChange={handleTitleChange}
        placeholder="Título del boceto..."
      />

      {/* Content Blocks Area */}
      <div className="note-content-area">
        {note.blocks.map((block, idx) => {
          if (block.type === 'check') {
            return (
              <ChecklistBlock
                key={block.id || idx}
                block={block}
                index={idx}
                onChange={handleBlockChange}
                onDelete={handleBlockDelete}
                onEnterKey={handleEnterKeyOnBlock}
              />
            );
          } else if (block.type === 'number') {
            // Count number index up to this block
            const numberCount = note.blocks.slice(0, idx + 1).filter(b => b.type === 'number').length;
            return (
              <NumberedBlock
                key={block.id || idx}
                block={block}
                index={idx}
                number={numberCount}
                onChange={handleBlockChange}
                onDelete={handleBlockDelete}
                onEnterKey={handleEnterKeyOnBlock}
              />
            );
          } else if (block.type === 'toggle') {
            return (
              <ToggleBlock
                key={block.id || idx}
                block={block}
                index={idx}
                onChange={handleBlockChange}
                onDelete={handleBlockDelete}
                onEnterKey={handleEnterKeyOnBlock}
              />
            );
          } else {
            // Plain text
            return (
              <div key={block.id || idx} className="block-row">
                <textarea
                  className="block-text-input"
                  style={{ minHeight: '36px', resize: 'vertical' }}
                  value={block.text}
                  onChange={(e) => handleBlockChange(idx, { ...block, text: e.target.value })}
                  placeholder="Escribe libremente..."
                />
              </div>
            );
          }
        })}

        {/* Add Block Toolbar */}
        <div className="block-tools">
          <button className="block-type-btn" onClick={() => handleAddBlock('check')}>
            <CheckSquare size={10} style={{ display: 'inline', marginRight: '3px' }} /> Checkmark
          </button>
          <button className="block-type-btn" onClick={() => handleAddBlock('number')}>
            <ListOrdered size={10} style={{ display: 'inline', marginRight: '3px' }} /> Número
          </button>
          <button className="block-type-btn" onClick={() => handleAddBlock('toggle')}>
            <ListCollapse size={10} style={{ display: 'inline', marginRight: '3px' }} /> Toggle
          </button>
          <button className="block-type-btn" onClick={() => handleAddBlock('text')}>
            <AlignLeft size={10} style={{ display: 'inline', marginRight: '3px' }} /> Texto
          </button>
        </div>
      </div>
    </div>
  );
}
