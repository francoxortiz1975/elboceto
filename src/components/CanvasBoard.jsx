import React, { useState, useRef } from 'react';
import { FreeformNode } from './FreeformNode';

// Grid constants — must match index.css background-size
const GRID_X = 24;
const GRID_Y = 28;
const DRAG_THRESHOLD = 3; // pixels moved before drag starts

export function CanvasBoard({
  notes,
  selectedNoteIds = [],
  onSelectNotes,
  onUpdateNote,
  onDeleteNote,
  onOpenCalendarModal,
  onDoubleTapCanvas,
  gridMode,
  pan,
  onPanChange,
  autoSortCompleted = true,
  onMouseMoveSurface
}) {
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Marquee selection state: { startX, startY, currentX, currentY, active: boolean }
  const [selectionBox, setSelectionBox] = useState(null);

  // Pending / active note drag state
  const pendingDrag = useRef(null);
  const [activeDragId, setActiveDragId] = useState(null);

  const snapToGrid = (rawX, rawY) => ({
    x: Math.max(GRID_X, Math.round(rawX / GRID_X) * GRID_X),
    y: Math.max(GRID_Y, Math.round(rawY / GRID_Y) * GRID_Y)
  });

  const getCoords = (e) => {
    if (e.touches?.length > 0) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    if (e.changedTouches?.length > 0) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseDownCanvas = (e) => {
    if (
      e.target.closest('.freeform-node') ||
      e.target.closest('.inline-context-bar') ||
      e.target.closest('.event-scheduler-popover') ||
      e.target.closest('.top-header') ||
      e.target.closest('.mobile-nav-bar')
    ) return;

    const { clientX, clientY } = getCoords(e);
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const surfaceX = clientX - rect.left - pan.x;
    const surfaceY = clientY - rect.top - pan.y;

    // Shift + Click Drag or standard empty canvas drag → Marquee selection square
    if (e.shiftKey) {
      setSelectionBox({
        startX: surfaceX,
        startY: surfaceY,
        currentX: surfaceX,
        currentY: surfaceY,
        active: true
      });
      if (!e.shiftKey) onSelectNotes([]);
    } else {
      setIsPanning(true);
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      onSelectNotes([]);
    }
  };

  const handleMouseMoveCanvas = (e) => {
    const { clientX, clientY } = getCoords(e);
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const surfaceX = clientX - rect.left - pan.x;
    const surfaceY = clientY - rect.top - pan.y;

    if (onMouseMoveSurface) {
      onMouseMoveSurface({ x: surfaceX, y: surfaceY });
    }

    // 1. Marquee selection drag
    if (selectionBox && selectionBox.active) {
      setSelectionBox(prev => prev ? { ...prev, currentX: surfaceX, currentY: surfaceY } : null);

      const boxLeft   = Math.min(selectionBox.startX, surfaceX);
      const boxRight  = Math.max(selectionBox.startX, surfaceX);
      const boxTop    = Math.min(selectionBox.startY, surfaceY);
      const boxBottom = Math.max(selectionBox.startY, surfaceY);

      // Find all nodes that intersect the selection box
      const hitIds = notes.filter(n => {
        const nodeW = n.isCard ? 260 : 220;
        const nodeH = 100;
        return (
          n.x + nodeW >= boxLeft &&
          n.x <= boxRight &&
          n.y + nodeH >= boxTop &&
          n.y <= boxBottom
        );
      }).map(n => n.id);

      onSelectNotes(hitIds);
      return;
    }

    // 2. Multi-node / Single-node drag
    if (pendingDrag.current) {
      if (isPanning) setIsPanning(false);
      const pd = pendingDrag.current;
      const dist = Math.hypot(clientX - pd.startX, clientY - pd.startY);

      if (!pd.isStarted && dist > DRAG_THRESHOLD) {
        pd.isStarted = true;
        setActiveDragId(pd.primaryId);
        if (pd.targetEl && typeof pd.targetEl.blur === 'function') {
          pd.targetEl.blur();
        }
      }

      if (pd.isStarted) {
        const dx = clientX - pd.startX;
        const dy = clientY - pd.startY;

        // Move all selected nodes together as a group
        pd.selectedIds.forEach(id => {
          const init = pd.initialPositions[id];
          if (init) {
            const activeNode = notes.find(n => n.id === id);
            if (activeNode) {
              const snapped = snapToGrid(init.x + dx, init.y + dy);
              onUpdateNote({ ...activeNode, x: snapped.x, y: snapped.y });
            }
          }
        });
      }
    } else if (isPanning) {
      const rawX = clientX - panStart.x;
      const rawY = clientY - panStart.y;
      onPanChange({
        x: Math.round(rawX / GRID_X) * GRID_X,
        y: Math.round(rawY / GRID_Y) * GRID_Y
      });
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setSelectionBox(null);
    pendingDrag.current = null;
    setActiveDragId(null);
  };

  const handleDragStartNote = (e, noteId) => {
    if (!e.target.closest('.node-drag-handle') && !e.target.closest('.node-left-grip')) return;



    e.stopPropagation();

    // Determine target selection group
    let currentSelected = [...selectedNoteIds];
    if (e.shiftKey) {
      if (!currentSelected.includes(noteId)) {
        currentSelected.push(noteId);
      }
    } else if (!currentSelected.includes(noteId)) {
      currentSelected = [noteId];
    }
    onSelectNotes(currentSelected);

    const { clientX, clientY } = getCoords(e);
    const initialPositions = {};
    currentSelected.forEach(id => {
      const n = notes.find(item => item.id === id);
      if (n) initialPositions[id] = { x: n.x, y: n.y };
    });

    pendingDrag.current = {
      primaryId: noteId,
      startX: clientX,
      startY: clientY,
      selectedIds: currentSelected,
      initialPositions,
      isStarted: false,
      targetEl: e.target
    };
  };

  const handleDoubleClickCanvas = (e) => {
    if (e.target.closest('.freeform-node') || e.target.closest('.top-header') || e.target.closest('.mobile-nav-bar')) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { clientX, clientY } = getCoords(e);
    const snapped = snapToGrid(clientX - rect.left - pan.x, clientY - rect.top - pan.y);
    onDoubleTapCanvas(snapped.x, snapped.y);
  };

  const gridClass = gridMode === 'dots' ? 'bg-grid-dots' : gridMode === 'lines' ? 'bg-grid-lines' : 'bg-clean';

  return (
    <div
      ref={containerRef}
      className={`canvas-viewport ${gridClass} ${isPanning ? 'panning' : ''}`}
      style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      onMouseLeave={handleMouseUpCanvas}
      onDoubleClick={handleDoubleClickCanvas}
      onTouchStart={handleMouseDownCanvas}
      onTouchMove={handleMouseMoveCanvas}
      onTouchEnd={handleMouseUpCanvas}
    >
      <div
        className="canvas-surface"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}
      >
        {/* Marquee Selection Square */}
        {selectionBox && selectionBox.active && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              border: '1px dashed rgba(24, 24, 27, 0.4)',
              background: 'rgba(24, 24, 27, 0.05)',
              borderRadius: '2px',
              pointerEvents: 'none',
              zIndex: 999
            }}
          />
        )}

        {notes.map((node) => (
          <FreeformNode
            key={node.id}
            node={node}
            isSelected={selectedNoteIds.includes(node.id)}
            onSelect={(id, isShift) => {
              if (isShift) {
                if (selectedNoteIds.includes(id)) {
                  onSelectNotes(selectedNoteIds.filter(item => item !== id));
                } else {
                  onSelectNotes([...selectedNoteIds, id]);
                }
              } else {
                onSelectNotes([id]);
              }
            }}

            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
            onOpenCalendarModal={onOpenCalendarModal}
            onDragStart={handleDragStartNote}
            autoSortCompleted={autoSortCompleted}
          />
        ))}
      </div>
    </div>
  );
}
