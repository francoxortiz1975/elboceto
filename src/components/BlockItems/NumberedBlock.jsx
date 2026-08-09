import React from 'react';

export function NumberedBlock({ block, index, number, onChange, onDelete, onEnterKey }) {
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
      <span className="numbered-badge">{number}.</span>
      <input
        type="text"
        className="block-text-input"
        value={block.text}
        onChange={(e) => onChange(index, { ...block, text: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder="Elemento numerado..."
      />
    </div>
  );
}
