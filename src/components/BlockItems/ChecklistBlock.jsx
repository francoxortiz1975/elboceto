import React from 'react';
import { Check } from 'lucide-react';

export function ChecklistBlock({ block, index, onChange, onDelete, onEnterKey }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterKey(index);
    } else if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault();
      onDelete(index);
    }
  };

  return (
    <div className="block-row">
      <button
        className={`block-checkmark ${block.completed ? 'checked' : ''}`}
        onClick={() => onChange(index, { ...block, completed: !block.completed })}
        title="Marcar / Desmarcar"
      >
        {block.completed && <Check size={11} strokeWidth={3} />}
      </button>
      <input
        type="text"
        className={`block-text-input ${block.completed ? 'completed' : ''}`}
        value={block.text}
        onChange={(e) => onChange(index, { ...block, text: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tarea o checkmark..."
      />
    </div>
  );
}
