import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  Calendar,
  CheckSquare,
  ListOrdered,
  ListCollapse,
  Heading,
  StickyNote,
  Check,
  ChevronRight,
  List,
  Bold,
  Type,
  X,
  Clock,
  GripVertical,
  Copy
} from 'lucide-react';


// ─── Inline Event Scheduler Popover ───────────────────────────────────────────
function EventSchedulerPopover({ node, onUpdate, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(node.eventDate || today);
  const [time, setTime] = useState(node.eventTime || '09:00');
  const [duration, setDuration] = useState(node.eventDurationMin || 60);
  const [isEvent, setIsEvent] = useState(node.isEvent || false);

  const handleSave = () => {
    onUpdate({
      ...node,
      eventDate: date || null,
      eventTime: time || null,
      eventDurationMin: duration || 60,
      isEvent
    });
    onClose();
  };

  const handleClear = () => {
    onUpdate({ ...node, isEvent: false, eventDate: null, eventTime: null, eventDurationMin: null });
    onClose();
  };

  return (
    <div
      className="event-scheduler-popover"
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Fecha y Hora
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '0 2px' }}>
          <X size={12} />
        </button>
      </div>

      {/* Date, Time, Duration (Always visible) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>FECHA</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              border: 'var(--border-hairline)',
              borderRadius: '3px',
              background: 'var(--bg-book)',
              color: 'var(--text-ink)',
              fontSize: '0.8rem',
              padding: '4px 6px',
              fontFamily: 'inherit',
              outline: 'none',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>HORA</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                border: 'var(--border-hairline)',
                borderRadius: '3px',
                background: 'var(--bg-book)',
                color: 'var(--text-ink)',
                fontSize: '0.8rem',
                padding: '4px 6px',
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>DURACIÓN (min)</span>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              style={{
                border: 'var(--border-hairline)',
                borderRadius: '3px',
                background: 'var(--bg-book)',
                color: 'var(--text-ink)',
                fontSize: '0.8rem',
                padding: '4px 6px',
                fontFamily: 'inherit',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Toggle event (Optional styling at the bottom) */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
          <div
            onClick={() => setIsEvent(!isEvent)}
            style={{
              width: '28px', height: '16px',
              borderRadius: '8px',
              background: isEvent ? 'var(--text-ink)' : 'rgba(24,24,27,0.15)',
              position: 'relative',
              transition: 'background 0.2s',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: isEvent ? '14px' : '2px',
              width: '12px', height: '12px',
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </div>
          <span style={{ fontSize: '0.76rem', color: isEvent ? 'var(--text-ink)' : 'var(--text-muted)' }}>
            Destacar en negro (Evento)
          </span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '5px 10px',
            background: 'var(--text-ink)',
            color: 'var(--bg-book)',
            border: 'none',
            borderRadius: '3px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Guardar
        </button>
        {node.eventDate && (
          <button
            onClick={handleClear}
            style={{
              padding: '5px 8px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'var(--border-hairline)',
              borderRadius: '3px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Quitar
          </button>
        )}
      </div>

      {/* Future: Google Calendar */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: 'var(--border-hairline)', textAlign: 'center' }}>
        <span className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--text-subtle)' }}>
          ○ Google Calendar — próximamente
        </span>
      </div>
    </div>
  );
}

// ─── FreeformNode ──────────────────────────────────────────────────────────────
export function FreeformNode({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onOpenCalendarModal,
  onDragStart,
  showCompleted = false
}) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [showEventPopover, setShowEventPopover] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [focusedTarget, setFocusedTarget] = useState(null);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const containerRef = useRef(null);
  const inputRefs = useRef({});

  const normalizeBlock = (b) => ({
    id: b.id || 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    text: b.text || '',
    isHeading: !!b.isHeading || b.type === 'heading',
    isSubheading: !!b.isSubheading || b.type === 'subheading',
    isBold: !!b.isBold,
    isCheck: !!b.isCheck || b.type === 'check',
    isBullet: !!b.isBullet || b.type === 'bullet',
    isNumber: !!b.isNumber || b.type === 'number',
    isToggle: !!b.isToggle || b.type === 'toggle',
    completed: !!b.completed,
    isOpen: b.isOpen !== undefined ? b.isOpen : true,
    indent: b.indent || 0
  });

  // Flatten any legacy b.children into flat block objects with indent = 1
  const rawBlocks = node.blocks || [];
  const blocks = [];
  rawBlocks.forEach((rawB) => {
    const parentB = normalizeBlock(rawB);
    blocks.push(parentB);
    if (rawB.children && rawB.children.length > 0) {
      rawB.children.forEach((c, cIdx) => {
        const isObj = typeof c === 'object' && c !== null;
        const txt = isObj ? c.text || '' : String(c || '');
        const done = isObj ? !!c.completed : false;
        const bold = isObj ? !!c.isBold : false;
        blocks.push(normalizeBlock({
          id: 'b_child_' + (parentB.id) + '_' + cIdx,
          text: txt,
          completed: done,
          isBold: bold,
          isCheck: true,
          indent: (parentB.indent || 0) + 1
        }));
      });
    }
  });

  const handleCopyNoteContent = (e) => {
    if (e) e.stopPropagation();
    const textContent = blocks.map(b => {
      let line = b.text || '';
      if (b.isHeading) line = `# ${line}`;
      else if (b.isSubheading) line = `## ${line}`;
      else if (b.isCheck) line = `[${b.completed ? 'x' : ' '}] ${line}`;
      else if (b.isBullet) line = `- ${line}`;
      else if (b.isNumber) line = `1. ${line}`;

      const indentSpaces = '  '.repeat(b.indent || 0);
      return `${indentSpaces}${line}`;
    }).join('\n');

    navigator.clipboard.writeText(textContent);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };




  // Close toolbar when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowToolbar(false);
        setShowEventPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);


  // Auto-focus input when focusedTarget changes and set precise caret position once
  useEffect(() => {
    if (focusedTarget) {
      const target = focusedTarget;
      setFocusedTarget(null);

      const key = target.type === 'main'
        ? `main_${target.index}`
        : `child_${target.blockIdx}_${target.childIdx}`;
      const el = inputRefs.current[key];
      if (el) {
        el.focus();
        if (target.caretPos !== undefined) {
          try {
            el.setSelectionRange(target.caretPos, target.caretPos);
          } catch (err) {}
        }
      }
    }
  }, [focusedTarget]);



  const handleListMouseDown = (e) => {
    e.stopPropagation();
    const startEl = e.target;
    if (!startEl) return;

    const handleMouseMove = (moveEv) => {
      const rect = startEl.getBoundingClientRect();
      if (moveEv.clientY < rect.top || moveEv.clientY > rect.bottom || moveEv.clientX < rect.left || moveEv.clientX > rect.right) {
        const hoverEl = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
        if (hoverEl && containerRef.current && containerRef.current.contains(hoverEl)) {
          try {
            const sel = window.getSelection();
            const range = document.createRange();
            if (containerRef.current) {
              range.selectNodeContents(containerRef.current);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch (err) {
            // Ignore range errors gracefully
          }
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const adjustTextareaBounds = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    el.style.width = 'auto';
    el.style.width = `${Math.max(el.scrollWidth, 180)}px`;
  };

  const updateBlocks = (newBlocks) => onUpdate({ ...node, blocks: newBlocks });


  const handleTextChange = (idx, rawText) => {
    // Strip any newlines (\r, \n) inserted into single-row textarea during Enter/paste events
    const cleanText = (rawText || '').replace(/[\r\n]/g, '');
    const newBlocks = [...blocks];
    let b = { ...newBlocks[idx], text: cleanText };

    if (cleanText.startsWith('## ')) {
      b.isSubheading = true; b.isHeading = false;
      b.text = cleanText.replace(/^##\s*/, '');
    } else if (cleanText.startsWith('# ')) {
      b.isHeading = true; b.isSubheading = false;
      b.text = cleanText.replace(/^#\s*/, '');
    } else if (cleanText.startsWith('[] ') || cleanText.startsWith('[ ] ') || cleanText.startsWith('- [ ] ')) {
      b.isCheck = true;
      b.text = cleanText.replace(/^(\[\]|\[ \]|-\s*\[ \])\s*/, '');
    } else if (cleanText.startsWith('[x] ') || cleanText.startsWith('- [x] ')) {
      b.isCheck = true; b.completed = true;
      b.text = cleanText.replace(/^(\[x\]|-\s*\[x\])\s*/, '');
    } else if (/^\d+[\.]\s/.test(cleanText)) {
      b.isNumber = true;
      b.text = cleanText.replace(/^\d+[\.]\s*/, '');
    } else if (cleanText.startsWith('- ') || cleanText.startsWith('* ') || cleanText.startsWith('• ')) {
      b.isBullet = true;
      b.text = cleanText.replace(/^(-\s*|\*\s*|•\s*)/, '');
    } else if (cleanText.startsWith('> ')) {
      b.isToggle = true; b.isOpen = true;
      if (!b.children.length) b.children = [''];
      b.text = cleanText.replace(/^>\s*/, '');
    }

    newBlocks[idx] = b;
    updateBlocks(newBlocks);
  };


  const toggleProperty = (idx, prop) => {
    const newBlocks = [...blocks];
    const b = { ...newBlocks[idx] };
    if (prop === 'isHeading') {
      b.isHeading = !b.isHeading;
      if (b.isHeading) b.isSubheading = false;
    } else if (prop === 'isSubheading') {
      b.isSubheading = !b.isSubheading;
      if (b.isSubheading) b.isHeading = false;
    } else {
      b[prop] = !b[prop];
    }
    if (prop === 'isToggle' && b.isToggle && !b.children.length) {
      b.children = ['']; b.isOpen = true;
    }
    newBlocks[idx] = b;
    updateBlocks(newBlocks);
  };

  const handlePaste = (e, idx) => {
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (!text) return;

    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return; // Single line paste, let browser paste natively

    e.preventDefault();
    const el = e.target;
    const currentVal = el ? el.value || '' : '';
    const selStart = el ? el.selectionStart || 0 : 0;
    const selEnd = el ? el.selectionEnd || 0 : 0;

    const headText = currentVal.slice(0, selStart);
    const tailText = currentVal.slice(selEnd);
    const currentB = blocks[idx];
    const newBlockList = [];

    lines.forEach((rawLine, i) => {
      let lineText = rawLine;
      if (i === 0) {
        lineText = headText + lineText;
      }
      if (i === lines.length - 1) {
        lineText = lineText + tailText;
      }

      let isH = false;
      let isSub = false;
      let isCheck = false;
      let isCompleted = false;
      let isBullet = false;
      let isNumber = false;
      let cleanText = lineText;

      if (cleanText.startsWith('## ')) {
        isSub = true;
        cleanText = cleanText.replace(/^##\s*/, '');
      } else if (cleanText.startsWith('# ')) {
        isH = true;
        cleanText = cleanText.replace(/^#\s*/, '');
      } else if (cleanText.startsWith('[] ') || cleanText.startsWith('[ ] ') || cleanText.startsWith('- [ ] ')) {
        isCheck = true;
        cleanText = cleanText.replace(/^(\[\]|\[ \]|-\s*\[ \])\s*/, '');
      } else if (cleanText.startsWith('[x] ') || cleanText.startsWith('- [x] ')) {
        isCheck = true;
        isCompleted = true;
        cleanText = cleanText.replace(/^(\[x\]|-\s*\[x\])\s*/, '');
      } else if (/^\d+[\.]\s/.test(cleanText)) {
        isNumber = true;
        cleanText = cleanText.replace(/^\d+[\.]\s*/, '');
      } else if (cleanText.startsWith('- ') || cleanText.startsWith('* ') || cleanText.startsWith('• ')) {
        isBullet = true;
        cleanText = cleanText.replace(/^(-\s*|\*\s*|•\s*)/, '');
      } else if (i > 0 && currentB.isBullet) {
        isBullet = true;
      } else if (i > 0 && currentB.isCheck) {
        isCheck = true;
      }

      newBlockList.push(normalizeBlock({
        id: i === 0 ? currentB.id : 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i,
        text: cleanText,
        isHeading: isH,
        isSubheading: isSub,
        isCheck,
        completed: isCompleted,
        isBullet,
        isNumber,
        isBold: !!currentB.isBold
      }));
    });

    const newBlocks = [...blocks];
    newBlocks.splice(idx, 1, ...newBlockList);
    updateBlocks(newBlocks);

    // Place caret cursor at the VERY END of the newly pasted text block
    const lastPastedIdx = idx + newBlockList.length - 1;
    const lastPastedBlock = newBlockList[newBlockList.length - 1];
    const targetCaret = (lastPastedBlock.text || '').length - tailText.length;
    setFocusedTarget({
      type: 'main',
      index: lastPastedIdx,
      caretPos: Math.max(0, targetCaret)
    });
  };

  const handleToggleCardMode = () => onUpdate({ ...node, isCard: !node.isCard });


  const handleKeyDown = (e, idx) => {
    const el = e.target;
    const val = el ? el.value || '' : '';
    const selStart = el ? el.selectionStart || 0 : 0;
    const selEnd = el ? el.selectionEnd || 0 : 0;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        if (containerRef.current) {
          range.selectNodeContents(containerRef.current);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (err) {}
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleProperty(idx, 'isBold');
      return;
    }

    // ── ENTER: Split text at caret and create new block ───────────────────────
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentB = blocks[idx];
      const headText = val.slice(0, selStart);
      const tailText = val.slice(selStart);

      const updatedCurrentB = { ...currentB, text: headText };
      const newB = normalizeBlock({
        id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: tailText,
        isCheck: currentB.isCheck,
        isNumber: currentB.isNumber,
        isBullet: currentB.isBullet,
        indent: currentB.indent || 0, // Inherit indent level on Enter!
        isBold: false, // Reset bold to normal text for next line!
        isToggle: false, isHeading: false, isSubheading: false // Reset heading to normal text for next line!
      });

      const newBlocks = [...blocks];
      newBlocks[idx] = updatedCurrentB;
      newBlocks.splice(idx + 1, 0, newB);
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'main', index: idx + 1, caretPos: 0 });
      return;
    }

    // ── TAB / SHIFT+TAB: Indent or outdent current block row ──────────────────
    if (e.key === 'Tab') {
      e.preventDefault();
      const newBlocks = [...blocks];
      const currentB = { ...newBlocks[idx] };
      if (!e.shiftKey) {
        currentB.indent = Math.min(3, (currentB.indent || 0) + 1);
        if (idx > 0 && !newBlocks[idx - 1].isToggle) {
          newBlocks[idx - 1] = { ...newBlocks[idx - 1], isToggle: true, isOpen: true };
        }
      } else {
        currentB.indent = Math.max(0, (currentB.indent || 0) - 1);
      }
      newBlocks[idx] = currentB;
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'main', index: idx, caretPos: selStart });
      return;
    }


    // ── BACKSPACE / DELETE: Merge line, delete block or note card ──────────────
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const isAllSelectedInBlock = selStart === 0 && selEnd === val.length && val.length > 0;
      const isEmptyBlock = val === '';
      const sel = window.getSelection();
      const selStr = sel ? sel.toString() : '';
      const isEntireNodeSelected = containerRef.current && sel && sel.anchorNode && containerRef.current.contains(sel.anchorNode) && selStr.length > val.length;

      // Full note container selected (Cmd+A + Backspace)
      if (isEntireNodeSelected) {
        e.preventDefault();
        onDelete(node.id);
        return;
      }

      // Single block note and ALL text selected or empty block
      if (blocks.length === 1 && (isAllSelectedInBlock || isEmptyBlock)) {
        e.preventDefault();
        onDelete(node.id);
        return;
      }

      // Multi-block note and ALL text in block selected
      if (blocks.length > 1 && isAllSelectedInBlock) {
        e.preventDefault();
        const newBlocks = blocks.filter((_, i) => i !== idx);
        updateBlocks(newBlocks);
        setFocusedTarget({ type: 'main', index: Math.max(0, idx - 1), caretPos: blocks[Math.max(0, idx - 1)].text.length });
        return;
      }

      // Backspace at caret position 0 → Merge current line into previous block!
      if (e.key === 'Backspace' && selStart === 0 && selEnd === 0) {
        e.preventDefault();
        if (idx > 0) {
          const prevB = { ...blocks[idx - 1] };
          const targetCaret = prevB.text.length;
          prevB.text = prevB.text + val;

          const newBlocks = [...blocks];
          newBlocks[idx - 1] = prevB;
          newBlocks.splice(idx, 1);
          updateBlocks(newBlocks);
          setFocusedTarget({ type: 'main', index: idx - 1, caretPos: targetCaret });
        } else if (idx === 0 && blocks.length > 1 && isEmptyBlock) {
          const newBlocks = blocks.filter((_, i) => i !== 0);
          updateBlocks(newBlocks);
          setFocusedTarget({ type: 'main', index: 0, caretPos: 0 });
        }
        return;
      }
    }

    // ── ARROW KEY NAVIGATION BETWEEN BLOCKS ──────────────────────────────────
    if (e.key === 'ArrowUp' && idx > 0 && selStart === 0) {
      e.preventDefault();
      const prevLen = blocks[idx - 1].text.length;
      setFocusedTarget({ type: 'main', index: idx - 1, caretPos: Math.min(selStart, prevLen) });
    } else if (e.key === 'ArrowDown' && idx < blocks.length - 1 && selEnd === val.length) {
      e.preventDefault();
      const nextLen = blocks[idx + 1].text.length;
      setFocusedTarget({ type: 'main', index: idx + 1, caretPos: Math.min(selEnd, nextLen) });
    } else if (e.key === 'ArrowLeft' && idx > 0 && selStart === 0 && selEnd === 0) {
      e.preventDefault();
      setFocusedTarget({ type: 'main', index: idx - 1, caretPos: blocks[idx - 1].text.length });
    } else if (e.key === 'ArrowRight' && idx < blocks.length - 1 && selStart === val.length && selEnd === val.length) {
      e.preventDefault();
      setFocusedTarget({ type: 'main', index: idx + 1, caretPos: 0 });
    } else if (e.key === 'Escape') {
      setShowToolbar(false);
      setShowEventPopover(false);
    }
  };

  const handleChildKeyDown = (e, blockIdx, childIdx) => {
    const el = e.target;
    const val = el ? el.value || '' : '';
    const selStart = el ? el.selectionStart || 0 : 0;
    const selEnd = el ? el.selectionEnd || 0 : 0;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const currentB = blocks[blockIdx];
      const children = [...(currentB.children || [])];
      const cur = children[childIdx];
      const isObj = typeof cur === 'object' && cur !== null;
      const text = isObj ? cur.text || '' : String(cur || '');
      const completed = isObj ? !!cur.completed : false;
      const isBold = isObj ? !cur.isBold : true;
      children[childIdx] = { text, completed, isBold };

      const newBlocks = [...blocks];
      newBlocks[blockIdx] = { ...currentB, children };
      updateBlocks(newBlocks);
      return;
    }

    const currentB = blocks[blockIdx];
    const children = [...(currentB.children || [])];


    if (e.key === 'Enter') {
      e.preventDefault();
      const headText = val.slice(0, selStart);
      const tailText = val.slice(selStart);
      children[childIdx] = headText;
      children.splice(childIdx + 1, 0, tailText);

      const newBlocks = [...blocks];
      newBlocks[blockIdx] = { ...currentB, children };
      updateBlocks(newBlocks);
      setFocusedTarget({ type: 'child', blockIdx, childIdx: childIdx + 1, caretPos: 0 });
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const isAllSelectedInBlock = selStart === 0 && selEnd === val.length && val.length > 0;
      const isEmptyBlock = val === '';
      const sel = window.getSelection();
      const selStr = sel ? sel.toString() : '';
      const isEntireNodeSelected = containerRef.current && sel && sel.anchorNode && containerRef.current.contains(sel.anchorNode) && selStr.length > val.length;

      if (isEntireNodeSelected) {
        e.preventDefault();
        onDelete(node.id);
        return;
      }

      if (isAllSelectedInBlock || (isEmptyBlock && e.key === 'Backspace' && selStart === 0)) {
        e.preventDefault();
        children.splice(childIdx, 1);
        const newBlocks = [...blocks];
        newBlocks[blockIdx] = { ...currentB, children };
        updateBlocks(newBlocks);
        if (children.length > 0) {
          setFocusedTarget({ type: 'child', blockIdx, childIdx: Math.max(0, childIdx - 1), caretPos: (children[Math.max(0, childIdx - 1)] || '').length });
        } else {
          setFocusedTarget({ type: 'main', index: blockIdx, caretPos: currentB.text.length });
        }
        return;
      }

      // Backspace at position 0 in child item → merge with previous child item
      if (e.key === 'Backspace' && selStart === 0 && selEnd === 0 && childIdx > 0) {
        e.preventDefault();
        const prevChildText = children[childIdx - 1] || '';
        const targetCaret = prevChildText.length;
        children[childIdx - 1] = prevChildText + val;
        children.splice(childIdx, 1);

        const newBlocks = [...blocks];
        newBlocks[blockIdx] = { ...currentB, children };
        updateBlocks(newBlocks);
        setFocusedTarget({ type: 'child', blockIdx, childIdx: childIdx - 1, caretPos: targetCaret });
        return;
      }
    }
  };



  // Format date-only label for indicator (no clock icon, no time)
  const eventLabel = node.eventDate
    ? (() => {
        const d = new Date(node.eventDate + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      })()
    : null;

  // Auto-expand all textareas to fit wrapped content reactively
  useEffect(() => {
    Object.values(inputRefs.current).forEach(el => {
      if (el && el.tagName === 'TEXTAREA') {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [blocks]);

  return (
    <div
      ref={containerRef}
      className={`freeform-node ${node.isCard ? 'is-card' : ''} ${isSelected ? 'selected' : ''} ${node.isEvent ? 'is-event-node' : ''}`}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        zIndex: showToolbar || isSelected ? 1000 : 10
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id, e.shiftKey);
      }}

      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
        setShowToolbar(true);
      }}
    >

      {/* Left Grip Handle — matching Document Notes view */}
      <div
        className="node-left-grip"
        onMouseDown={(e) => onDragStart(e, node.id)}
        onTouchStart={(e) => onDragStart(e, node.id)}
        title="Mantén presionado para mover"
      >
        <GripVertical size={14} />
      </div>
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          className="inline-context-bar"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Event Scheduler Button */}
          <button
            className={`btn-icon ${node.isEvent ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowEventPopover(p => !p);
            }}
            title={node.isEvent ? `Evento: ${eventLabel}` : 'Programar como evento'}
            style={{ position: 'relative' }}
          >
            <Calendar size={12} />
            {node.isEvent && (
              <span style={{
                position: 'absolute',
                top: '-3px', right: '-3px',
                width: '5px', height: '5px',
                borderRadius: '50%',
                background: 'var(--text-ink)'
              }} />
            )}
          </button>

          <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

          {/* Active target index for toolbar actions */}
          {(() => {
            const curIdx = Math.min(activeBlockIdx, blocks.length - 1);
            const curBlock = blocks[curIdx] || {};

            return (
              <>
                <button className={`btn-icon ${curBlock.isHeading ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isHeading'); }} title="Título (#)">
                  <Heading size={12} />
                </button>
                <button className={`btn-icon ${curBlock.isSubheading ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isSubheading'); }} title="Subtítulo (##)">
                  <Type size={12} />
                </button>
                <button className={`btn-icon ${curBlock.isBold ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isBold'); }} title="Negrita (Ctrl+B)">
                  <Bold size={12} />
                </button>

                <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

                <button className={`btn-icon ${curBlock.isCheck ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isCheck'); }} title="Checkmark">
                  <CheckSquare size={12} />
                </button>
                <button className={`btn-icon ${curBlock.isBullet ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isBullet'); }} title="Bullet">
                  <List size={12} />
                </button>
                <button className={`btn-icon ${curBlock.isNumber ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isNumber'); }} title="Número">
                  <ListOrdered size={12} />
                </button>
                <button className={`btn-icon ${curBlock.isToggle ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); toggleProperty(curIdx, 'isToggle'); }} title="Toggle">
                  <ListCollapse size={12} />
                </button>
              </>
            );
          })()}

          <div style={{ width: '1px', height: '14px', background: 'rgba(24,24,27,0.15)', margin: '0 2px' }} />

          <button className={`btn-icon ${node.isCard ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleToggleCardMode(); }} title="Post-It">
            <StickyNote size={12} />
          </button>

          <button className="btn-icon" onClick={handleCopyNoteContent} title="Copiar Contenido de la Nota">
            <Copy size={12} />
          </button>

          <button className="btn-icon" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Eliminar">
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Copied Toast Alert */}
      {copiedToast && (
        <div className="copy-toast-alert font-mono">
          ✓ ¡Nota copiada al portapapeles!
        </div>
      )}


      {/* Event Scheduler Popover */}
      {showToolbar && showEventPopover && (
        <EventSchedulerPopover
          node={node}
          onUpdate={onUpdate}
          onClose={() => setShowEventPopover(false)}
        />
      )}

      {/* Date badge on the LEFT SIDE of the node (Date only, no time, no clock icon) */}
      {eventLabel && (
        <div style={{
          position: 'absolute',
          top: 0,
          height: '28px',
          right: 'calc(100% + 8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {eventLabel}
          </span>
        </div>
      )}

      {/* Render Note Body Content — Standard Block-Based Editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>

        {(() => {
          // Calculate collapsed visibility for indented blocks under closed toggle parents
          const hiddenMap = {};
          let closedToggleIndent = null;

          blocks.forEach((b, i) => {
            if (closedToggleIndent !== null) {
              if ((b.indent || 0) > closedToggleIndent) {
                hiddenMap[i] = true;
              } else {
                closedToggleIndent = null;
              }
            }
            if (b.isToggle && !b.isOpen) {
              if (closedToggleIndent === null || (b.indent || 0) <= closedToggleIndent) {
                closedToggleIndent = b.indent || 0;
              }
            }
          });

          return blocks.map((b, idx) => {
            if (hiddenMap[idx]) return null;
            if (!showCompleted && b.isCheck && b.completed) return null;

            const numberCount = blocks.slice(0, idx + 1).filter(item => item.isNumber).length;
            const inputClass = b.isHeading
              ? 'node-heading-input'
              : b.isSubheading
              ? 'node-subheading-input'
              : 'block-text-input';

            return (
              <div key={b.id || idx} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div className="block-row" style={{ paddingLeft: `${(b.indent || 0) * 18}px`, position: 'relative' }}>
                  {b.indent > 0 && (
                    <div style={{
                      position: 'absolute',
                      left: `${(b.indent - 1) * 18 + 6}px`,
                      top: 0, bottom: 0,
                      width: '1px',
                      background: 'rgba(24,24,27,0.1)'
                    }} />
                  )}
                  {b.isCheck && (
                    <button
                      className={`block-checkmark ${b.completed ? 'checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newBlocks = [...blocks];
                        newBlocks[idx] = { ...b, completed: !b.completed };
                        updateBlocks(newBlocks);
                      }}
                    >
                      {b.completed && <Check size={11} strokeWidth={3} />}
                    </button>
                  )}
                  {b.isBullet && (
                    <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-ink)', marginTop: '2px', minWidth: '14px' }}>•</span>
                  )}
                  {b.isNumber && (
                    <span className="numbered-badge">{numberCount}.</span>
                  )}
                  {b.isToggle && (
                    <span
                      className={`toggle-arrow ${b.isOpen ? 'open' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newBlocks = [...blocks];
                        newBlocks[idx] = { ...b, isOpen: !b.isOpen };
                        updateBlocks(newBlocks);
                      }}
                    >
                      <ChevronRight size={14} />
                    </span>
                  )}
                  <textarea
                    ref={(el) => {
                      inputRefs.current[`main_${idx}`] = el;
                      if (el) adjustTextareaBounds(el);
                    }}
                    wrap="off"
                    className={`${inputClass} ${b.completed ? 'completed' : ''} ${b.isBold ? 'is-bold' : ''}`}
                    value={b.text}
                    rows={1}
                    onMouseDown={handleListMouseDown}
                    onTouchStart={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      adjustTextareaBounds(e.target);
                      handleTextChange(idx, e.target.value);
                    }}
                    onFocus={(e) => {
                      adjustTextareaBounds(e.target);
                      setActiveBlockIdx(idx);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    onPaste={(e) => handlePaste(e, idx)}
                    placeholder={b.isHeading ? 'Título...' : b.isSubheading ? 'Subtítulo...' : 'Escribe...'}
                  />
                </div>
              </div>
            );
          });
        })()}

      </div>
    </div>
  );
}




