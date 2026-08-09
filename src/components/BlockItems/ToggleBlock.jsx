import React from 'react';
import { ChevronRight } from 'lucide-react';

export function ToggleBlock({ block, index, onChange, onDelete, onEnterKey }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterKey(index);
    } else if (e.key === 'Backspace' && block.text === '' && (!block.children || block.children.length === 0)) {
      e.preventDefault();
      onDelete(index);
    }
  };

  const toggleOpen = () => {
    onChange(index, { ...block, isOpen: !block.isOpen });
  };

  const handleChildChange = (childIdx, updatedChildText) => {
    const newChildren = [...(block.children || [])];
    newChildren[childIdx] = updatedChildText;
    onChange(index, { ...block, children: newChildren });
  };

  const handleAddChild = () => {
    const newChildren = [...(block.children || []), ''];
    onChange(index, { ...block, children: newChildren, isOpen: true });
  };

  const handleDeleteChild = (childIdx) => {
    const newChildren = (block.children || []).filter((_, i) => i !== childIdx);
    onChange(index, { ...block, children: newChildren });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="block-row">
        <span
          className={`toggle-arrow ${block.isOpen ? 'open' : ''}`}
          onClick={toggleOpen}
          title="Desplegar / Plegar"
        >
          <ChevronRight size={14} />
        </span>
        <input
          type="text"
          className="block-text-input"
          style={{ fontWeight: 500 }}
          value={block.text}
          onChange={(e) => onChange(index, { ...block, text: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Encabezado desplegable..."
        />
      </div>

      {block.isOpen && (
        <div style={{ paddingLeft: '22px', borderLeft: 'var(--border-hairline)', marginLeft: '7px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(block.children || []).map((childText, cIdx) => (
            <div key={cIdx} className="block-row">
              <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', marginTop: '4px' }}>•</span>
              <input
                type="text"
                className="block-text-input"
                style={{ fontSize: '0.82rem' }}
                value={childText}
                onChange={(e) => handleChildChange(cIdx, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChild();
                  } else if (e.key === 'Backspace' && childText === '') {
                    e.preventDefault();
                    handleDeleteChild(cIdx);
                  }
                }}
                placeholder="Detalle o sub-elemento..."
              />
            </div>
          ))}

          <button
            onClick={handleAddChild}
            className="font-mono"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-subtle)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textAlign: 'left',
              paddingTop: '2px'
            }}
          >
            + Añadir sub-elemento
          </button>
        </div>
      )}
    </div>
  );
}
