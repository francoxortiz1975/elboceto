import React, { useMemo } from 'react';
import { FreeformNode } from './FreeformNode';

export function MobileBoardView({
  notes = [],
  onUpdateNote,
  onDeleteNote,
  onOpenCalendarModal,
  autoSortCompleted = true
}) {
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    [notes]
  );

  if (sortedNotes.length === 0) {
    return (
      <div className="mobile-board-empty">
        <span className="font-mono">Sin notas todavía — toca "+ Nota" para crear una.</span>
      </div>
    );
  }

  return (
    <div className="mobile-board-feed">
      {sortedNotes.map(node => (
        <FreeformNode
          key={node.id}
          node={node}
          positioned={false}
          isSelected={false}
          onSelect={() => {}}
          onUpdate={onUpdateNote}
          onDelete={onDeleteNote}
          onOpenCalendarModal={onOpenCalendarModal}
          onDragStart={() => {}}
          autoSortCompleted={autoSortCompleted}
        />
      ))}
    </div>
  );
}
