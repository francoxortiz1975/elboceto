import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasBoard } from './components/CanvasBoard';
import { SidebarList } from './components/SidebarList';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { LeftEdgePanel } from './components/LeftEdgePanel';
import { DocumentBoardView } from './components/DocumentBoardView';
import {
  Plus,
  BookOpen,
  Grid,
  Download,
  Upload,
  Layers,
  StickyNote,
  ArrowDown,
  Calendar,
  RotateCcw,
  Undo2,
  Redo2,
  CheckSquare,
  FileText,
  MapPin,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const STORAGE_KEY_NOTES = 'el_boceto_notes_v2';
const STORAGE_KEY_PLANNER = 'el_boceto_planner_v1';
const STORAGE_KEY_VIEWPORT = 'el_boceto_viewport_v1';
const STORAGE_KEY_DOCUMENTS = 'el_boceto_documents_v2';
const STORAGE_KEY_GRID_MODE = 'el_boceto_grid_mode_v1';


const INITIAL_DOCUMENTS = [
  {
    id: 'doc_1',
    title: 'Notas de Desarrollo e Ideas',
    icon: '📝',
    notes: [
      {
        id: 'doc_note_1',
        x: 48,
        y: 56,
        isCard: false,
        blocks: [
          { id: 'db1', isHeading: true, text: 'Notas de Desarrollo e Ideas' },
          { id: 'db2', isCheck: true, text: 'Tablero individual de nota organizada', completed: true },
          { id: 'db3', isCheck: true, text: 'Crear nuevas notas desde la barra superior', completed: false }
        ]
      }
    ],
    viewport: { pan: { x: 0, y: 140 } }
  }
];


const INITIAL_DEMO_NOTES = [
  {
    id: 'demo_1',
    x: 100,
    y: 100,
    isCard: false,
    date: 'Hoy',
    calendarSynced: false,
    blocks: [
      { id: 'b1', type: 'heading', isHeading: true, text: 'Le Brouillon — Écriture Libre' },
      { id: 'b2', type: 'check', isCheck: true, text: 'Escribir directamente sobre el papel sin recuadros', completed: true },
      { id: 'b3', type: 'check', isCheck: true, text: 'Escribir "1. " para crear lista numerada', completed: true },
      { id: 'b4', type: 'check', isCheck: true, text: 'Escribir "[] " para crear checkmark', completed: true },
      { id: 'b5', type: 'toggle', isToggle: true, text: 'Doble clic para barra de herramientas y TAB para sangrar', isOpen: true, children: ['Combina Título + Toggle list + Checkmarks', 'Desliza hacia abajo a Vista 2: Planificador Semanal'] }
    ]
  },
  {
    id: 'demo_2',
    x: 540,
    y: 120,
    isCard: true,
    date: 'Lunes',
    calendarSynced: true,
    blocks: [
      { id: 'b6', type: 'heading', isHeading: true, text: 'Reunión Lunes 10am' },
      { id: 'b7', type: 'check', isCheck: true, text: 'Revisar prototipo en teléfono y escritorio', completed: true },
      { id: 'b8', type: 'check', isCheck: true, text: 'Definir sincronización con Supabase', completed: false }
    ]
  }
];

const INITIAL_PLANNER_TASKS = [
  { id: 'p1', text: 'Revisar avances de diseño con el equipo', completed: true, dayKey: 'mon', timeSlot: '09:00' },
  { id: 'p2', text: 'Publicar actualización de la aplicación', completed: false, dayKey: 'wed', timeSlot: '15:00' }
];

export default function App() {
  const [activeView, setActiveView] = useState('board');

  // Notes state
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading notes:', e);
    }
    return INITIAL_DEMO_NOTES;
  });

  // Planner tasks state
  const [plannerTasks, setPlannerTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLANNER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading planner tasks:', e);
    }
    return INITIAL_PLANNER_TASKS;
  });

  // Freeform Document Notes state
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOCUMENTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading documents:', e);
    }
    return INITIAL_DOCUMENTS;
  });

  const [activeDocId, setActiveDocId] = useState(() => documents[0]?.id || 'doc_1');

  const handleCreateDoc = () => {
    const docId = `doc_${Date.now()}`;
    const titleNoteId = `note_title_${Date.now()}`;
    const titleBlockId = `b_title_${Date.now()}`;

    const newDoc = {
      id: docId,
      title: 'Insertar Título...',
      icon: '📝',
      notes: [
        {
          id: titleNoteId,
          x: 48,
          y: 56,
          isCard: false,
          blocks: [
            {
              id: titleBlockId,
              text: 'Insertar Título...',
              isHeading: true
            }
          ]
        }
      ],
      viewport: { pan: { x: 0, y: 140 } }
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveDocId(docId);
  };


  const handleUpdateDoc = (updatedDoc) => {
    setDocuments(prev => prev.map(d => (d.id === updatedDoc.id ? updatedDoc : d)));
  };

  const handleDeleteDoc = (docId) => {
    if (documents.length <= 1) return;
    setDocuments(prev => {
      const next = prev.filter(d => d.id !== docId);
      if (activeDocId === docId) {
        setActiveDocId(next[0]?.id || '');
      }
      return next;
    });
  };


  // Persistent pan state & customizable homePin
  const [viewport, setViewport] = useState(() => {
    const defaultHome = { x: 0, y: 140 };
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEWPORT);
      if (saved) {
        const v = JSON.parse(saved);
        return {
          pan: v.pan || defaultHome,
          homePin: v.homePin || defaultHome
        };
      }
    } catch (e) {}
    return { pan: defaultHome, homePin: defaultHome };
  });

  const [showPinConfirm, setShowPinConfirm] = useState(false);


  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const selectedNoteId = selectedNoteIds[0] || null;

  const handleSelectNotes = useCallback((val) => {
    if (Array.isArray(val)) {
      setSelectedNoteIds(val);
    } else if (val) {
      setSelectedNoteIds([val]);
    } else {
      setSelectedNoteIds([]);
    }
  }, []);

  const [gridMode, setGridMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GRID_MODE);
      if (saved) return saved;
    } catch (e) {}
    return 'dots';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GRID_MODE, gridMode);
    } catch (e) {}
  }, [gridMode]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [calendarModalNote, setCalendarModalNote] = useState(null);
  const [autoSortCompleted, setAutoSortCompleted] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekLabel = React.useMemo(() => {
    const now = new Date();
    const distanceToMon = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMon + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDayMonth = (d) => `${d.getDate()} ${d.toLocaleString('es-ES', { month: 'short' })}`;
    return `Semana del ${formatDayMonth(monday)} al ${formatDayMonth(sunday)}`;
  }, [weekOffset]);

  // Undo / Redo History Stacks
  const historyPast = useRef([]);
  const historyFuture = useRef([]);
  const lastHistoryTime = useRef(0);

  const pushSnapshot = useCallback(() => {
    const now = Date.now();
    if (now - lastHistoryTime.current < 300 && historyPast.current.length > 0) {
      return;
    }
    lastHistoryTime.current = now;
    historyPast.current.push({
      notes: JSON.parse(JSON.stringify(notes)),
      plannerTasks: JSON.parse(JSON.stringify(plannerTasks))
    });
    if (historyPast.current.length > 60) {
      historyPast.current.shift();
    }
    historyFuture.current = [];
  }, [notes, plannerTasks]);

  const handleUndo = useCallback(() => {
    if (historyPast.current.length === 0) return;
    const previous = historyPast.current.pop();
    historyFuture.current.push({
      notes: JSON.parse(JSON.stringify(notes)),
      plannerTasks: JSON.parse(JSON.stringify(plannerTasks))
    });
    setNotes(previous.notes);
    setPlannerTasks(previous.plannerTasks);
  }, [notes, plannerTasks]);

  const handleRedo = useCallback(() => {
    if (historyFuture.current.length === 0) return;
    const next = historyFuture.current.pop();
    historyPast.current.push({
      notes: JSON.parse(JSON.stringify(notes)),
      plannerTasks: JSON.parse(JSON.stringify(plannerTasks))
    });
    setNotes(next.notes);
    setPlannerTasks(next.plannerTasks);
  }, [notes, plannerTasks]);

  const copiedNoteCards = useRef([]);

  // Global Keyboard Listener for Undo (Cmd+Z), Redo (Cmd+Shift+Z / Cmd+Y), and Copy/Paste Note Cards (Cmd+C / Cmd+V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const activeEl = document.activeElement;
      const isEditingText = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      if (isCtrlOrCmd && key === 'z' && !e.shiftKey) {
        if (!isEditingText) {
          e.preventDefault();
          handleUndo();
        }
      } else if ((isCtrlOrCmd && key === 'z' && e.shiftKey) || (isCtrlOrCmd && key === 'y')) {
        if (!isEditingText) {
          e.preventDefault();
          handleRedo();
        }
      } else if (isCtrlOrCmd && key === 'c' && !isEditingText && selectedNoteIds.length > 0) {
        e.preventDefault();
        const selectedNotesList = notes.filter(n => selectedNoteIds.includes(n.id));
        copiedNoteCards.current = JSON.parse(JSON.stringify(selectedNotesList));

        const textContent = selectedNotesList.map(n => {
          return (n.blocks || []).map(b => {
            let line = b.text || '';
            if (b.isHeading) line = `# ${line}`;
            else if (b.isSubheading) line = `## ${line}`;
            else if (b.isCheck) line = `[${b.completed ? 'x' : ' '}] ${line}`;
            else if (b.isBullet) line = `- ${line}`;
            else if (b.isNumber) line = `1. ${line}`;
            if (b.isToggle && b.children?.length) {
              line += '\n' + b.children.map(c => `  - ${c}`).join('\n');
            }
            return line;
          }).join('\n');
        }).join('\n\n---\n\n');
        navigator.clipboard.writeText(textContent);
      } else if (isCtrlOrCmd && key === 'v' && !isEditingText && copiedNoteCards.current.length > 0) {
        e.preventDefault();
        pushSnapshot();
        const newPastedIds = [];
        const pastedNotes = copiedNoteCards.current.map(n => {
          const newId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          newPastedIds.push(newId);
          return {
            ...JSON.parse(JSON.stringify(n)),
            id: newId,
            x: n.x + 24,
            y: n.y + 28
          };
        });
        setNotes(prev => [...prev, ...pastedNotes]);
        setSelectedNoteIds(newPastedIds);
      } else if ((key === 'backspace' || key === 'delete') && !isEditingText && selectedNoteIds.length > 0) {
        e.preventDefault();
        pushSnapshot();
        setNotes(prev => prev.filter(n => !selectedNoteIds.includes(n.id)));
        setSelectedNoteIds([]);
      }
    };


    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, notes, handleUndo, handleRedo, pushSnapshot]);


  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error('Error saving notes:', e);
    }
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLANNER, JSON.stringify(plannerTasks));
    } catch (e) {
      console.error('Error saving planner tasks:', e);
    }
  }, [plannerTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DOCUMENTS, JSON.stringify(documents));
    } catch (e) {
      console.error('Error saving documents:', e);
    }
  }, [documents]);


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEWPORT, JSON.stringify(viewport));
    } catch (e) {
      console.error('Error saving viewport:', e);
    }
  }, [viewport]);

  // Handle Wheel Scroll transitions between View 1 (Notes), View 2 (Board), View 3 (Planner)
  const lastTransitionTime = useRef(0);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.closest('.note-card') || e.target.closest('.freeform-node')) {
        return;
      }

      const now = Date.now();
      if (now - lastTransitionTime.current < 500) {
        return; // Lock transition during continuous scroll gestures to prevent skipping views
      }

      if (activeView === 'board') {
        if (e.deltaY < -60) {
          lastTransitionTime.current = now;
          setActiveView('notes');
        } else if (e.deltaY > 60) {
          lastTransitionTime.current = now;
          setActiveView('planner');
        }
      } else if (activeView === 'notes' && e.deltaY > 60) {
        lastTransitionTime.current = now;
        setActiveView('board');
      } else if (activeView === 'planner' && e.deltaY < -60) {
        lastTransitionTime.current = now;
        setActiveView('board');
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [activeView]);

  // Disable Safari / macOS trackpad horizontal swipe history back/forward navigation
  useEffect(() => {
    const preventSafariHorizontalSwipe = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventSafariHorizontalSwipe, { passive: false });
    return () => window.removeEventListener('wheel', preventSafariHorizontalSwipe);
  }, []);




  const handleAddNote = (x = 140, y = 160, isCard = false) => {
    pushSnapshot();
    const newNote = {
      id: 'node_' + Date.now(),
      x,
      y,
      isCard,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      calendarSynced: false,
      blocks: [
        { id: 'b_' + Date.now(), type: 'text', text: '', completed: false }
      ]
    };
    setNotes(prev => [newNote, ...prev]);
    handleSelectNotes(newNote.id);
  };

  const handleUpdateNote = (updatedNote) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const handleDeleteNote = (id) => {
    pushSnapshot();
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) handleSelectNotes(null);
  };

  const handleUpdatePlannerTasks = (actionOrValue) => {
    setPlannerTasks(actionOrValue);
  };

  const handleCalendarSyncSuccess = (noteId, syncData) => {
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return { ...n, calendarSynced: true, calendarInfo: syncData };
      }
      return n;
    }));
  };

  const handleExportJSON = () => {
    const backupData = { notes, plannerTasks, viewport };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `le-brouillon-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            setNotes(imported);
          } else if (imported.notes) {
            setNotes(imported.notes);
            if (imported.plannerTasks) setPlannerTasks(imported.plannerTasks);
            if (imported.viewport) setViewport(imported.viewport);
          }
        } catch (err) {
          alert('Archivo JSON no válido.');
        }
      };
    }
  };

  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0];

  const handleGoToHomePin = () => {
    if (activeView === 'notes' && currentDoc) {
      const targetHome = currentDoc.viewport?.homePin || { x: 0, y: 140 };
      handleUpdateDoc({
        ...currentDoc,
        viewport: { ...currentDoc.viewport, pan: targetHome }
      });
    } else {
      const targetHome = viewport.homePin || { x: 0, y: 140 };
      setViewport(prev => ({ ...prev, pan: targetHome }));
    }
  };

  const handleConfirmSetHomePin = () => {
    if (activeView === 'notes' && currentDoc) {
      const curPan = currentDoc.viewport?.pan || { x: 0, y: 140 };
      handleUpdateDoc({
        ...currentDoc,
        viewport: { ...currentDoc.viewport, homePin: { ...curPan } }
      });
    } else {
      setViewport(prev => ({ ...prev, homePin: { ...prev.pan } }));
    }
    setShowPinConfirm(false);
  };


  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Permanent Top-Left Brand Title */}
      <div className="brand-header-top-left">
        <span className="brand-title">el boceto</span>
      </div>

      {/* Permanent Top-Right Reactive Floating Dock */}
      <div className="reactive-floating-dock">
        {/* Document Switcher Pill in Notes View */}
        {activeView === 'notes' && (
          <>
            <div style={{ position: 'relative' }}>
              <button
                className="dock-icon-btn active"
                onClick={(e) => { e.stopPropagation(); setShowDocDropdown(prev => !prev); }}
                title="Cambiar Nota Organizada"
              >
                <span>{currentDoc?.icon || '📝'}</span>
                <span className="font-mono" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentDoc?.title || 'Sin título'}
                </span>
                <ChevronDown size={11} />
              </button>

              {showDocDropdown && (
                <div
                  className="vertical-more-panel"
                  style={{ right: 0, width: '240px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="panel-section-title font-mono">MIS NOTAS ({documents.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto', marginBottom: '8px' }}>
                    {documents.map(d => (
                      <div
                        key={d.id}
                        className={`sidebar-item ${d.id === activeDocId ? 'active' : ''}`}
                        style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={() => {
                          setActiveDocId(d.id);
                          setShowDocDropdown(false);
                        }}
                      >
                        <span className="font-mono" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.icon || '📝'} {d.title || 'Sin título'}
                        </span>
                        {documents.length > 1 && (
                          <button
                            className="btn-icon"
                            style={{ padding: '2px', color: 'var(--text-muted)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoc(d.id);
                            }}
                            title="Eliminar esta nota"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-icon active"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      handleCreateDoc();
                      setShowDocDropdown(false);
                    }}
                  >
                    <Plus size={12} />
                    <span className="font-mono" style={{ fontSize: '0.75rem' }}>+ Nueva Nota</span>
                  </button>
                </div>
              )}
            </div>
            <div className="dock-divider" />
          </>
        )}

        {/* Week Switcher Controls in Planner View */}
        {activeView === 'planner' && (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                className="dock-icon-btn"
                onClick={() => setWeekOffset(p => p - 1)}
                title="Semana Anterior"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="font-mono" style={{ fontSize: '0.75rem', padding: '0 4px', whiteSpace: 'nowrap' }}>
                {currentWeekLabel}
              </span>
              <button
                className="dock-icon-btn"
                onClick={() => setWeekOffset(p => p + 1)}
                title="Semana Siguiente"
              >
                <ChevronRight size={13} />
              </button>
              {weekOffset !== 0 && (
                <button
                  className="dock-icon-btn active font-mono"
                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                  onClick={() => setWeekOffset(0)}
                  title="Ir a Semana Actual"
                >
                  Hoy
                </button>
              )}
            </div>
            <div className="dock-divider" />
          </>
        )}

        {/* 1. Pin / Inicio Button with ▼ toggle popover */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            className="dock-icon-btn"
            onClick={handleGoToHomePin}
            title="Ir a Inicio"
          >
            <MapPin size={13} />
            <span className="font-mono">Inicio</span>
          </button>
          <button
            className="dock-pin-toggle font-mono"
            onClick={(e) => { e.stopPropagation(); setShowPinConfirm(prev => !prev); }}
            title="Opciones de posición de Inicio (▼)"
          >
            ▼
          </button>

          {showPinConfirm && (
            <div className="home-pin-popover" style={{ right: 0, left: 'auto', top: 'calc(100% + 6px)' }}>
              <div className="home-pin-title font-mono">📍 Posición Fija de Inicio</div>
              <div className="home-pin-desc">
                ¿Actualizar posición de inicio (`X: {activeView === 'notes' ? (currentDoc?.viewport?.pan?.x || 0) : (viewport.pan?.x || 0)}, Y: {activeView === 'notes' ? (currentDoc?.viewport?.pan?.y || 0) : (viewport.pan?.y || 0)}`)?
              </div>
              <div className="home-pin-actions">
                <button className="btn-pin-cancel font-mono" onClick={() => setShowPinConfirm(false)}>
                  Cancelar
                </button>
                <button className="btn-pin-confirm font-mono" onClick={handleConfirmSetHomePin}>
                  Fijar Posición
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="dock-divider" />

        {/* 2. Undo & Redo */}
        <button className="dock-icon-btn" onClick={handleUndo} title="Deshacer (Cmd+Z)">
          <Undo2 size={13} />
        </button>
        <button className="dock-icon-btn" onClick={handleRedo} title="Rehacer (Cmd+Shift+Z)">
          <Redo2 size={13} />
        </button>

        <div className="dock-divider" />

        {/* Create Note Action */}
        <button className="dock-icon-btn active" onClick={() => handleAddNote(180, 180, false)} title="Crear Nota">
          <Plus size={13} />
          <span className="font-mono">Escribir</span>
        </button>

        <div className="dock-divider" />

        {/* 3. More Button (⋯) with Vertical Panel */}
        <div style={{ position: 'relative' }}>
          <button
            className={`dock-icon-btn ${showMoreMenu ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowMoreMenu(prev => !prev); }}
            title="Más Opciones"
          >
            <MoreVertical size={13} />
          </button>

          {showMoreMenu && (
            <div className="vertical-more-panel" onClick={(e) => e.stopPropagation()}>
              {/* Índice de Notas */}
              <div className="panel-section-title font-mono">ÍNDICE DE NOTAS</div>
              <button
                className="btn-icon"
                style={{ width: '100%', marginBottom: '12px' }}
                onClick={() => { setIsSidebarOpen(true); setShowMoreMenu(false); }}
              >
                <BookOpen size={12} />
                <span className="font-mono" style={{ fontSize: '0.75rem' }}>Ver Índice ({notes.length})</span>
              </button>

              {/* Puntos / Líneas */}
              <div className="panel-section-title font-mono">ESTILO DE CUADRÍCULA</div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                <button
                  className={`btn-icon ${gridMode === 'dots' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setGridMode('dots')}
                >
                  <Grid size={12} />
                  <span className="font-mono" style={{ fontSize: '0.72rem' }}>Puntos</span>
                </button>
                <button
                  className={`btn-icon ${gridMode === 'lines' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setGridMode('lines')}
                >
                  <Layers size={12} />
                  <span className="font-mono" style={{ fontSize: '0.72rem' }}>Líneas</span>
                </button>
              </div>

              {/* Auto-ordenar Toggle */}
              <div className="panel-section-title font-mono">TAREAS COMPLETADAS</div>
              <button
                className={`btn-icon ${autoSortCompleted ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between', marginBottom: '12px' }}
                onClick={() => setAutoSortCompleted(p => !p)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>Auto-ordenar completadas</span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.68rem', color: autoSortCompleted ? 'var(--text-ink)' : 'var(--text-muted)' }}>
                  {autoSortCompleted ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Export & Import */}
              <div className="panel-section-title font-mono">COPIA DE SEGURIDAD</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button className="btn-icon" style={{ width: '100%' }} onClick={handleExportJSON}>
                  <Download size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>Exportar Copia (.json)</span>
                </button>
                <label className="btn-icon" style={{ width: '100%', margin: 0, cursor: 'pointer' }}>
                  <Upload size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>Importar Copia (.json)</span>
                  <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View 1: Freeform Document Notes (ABOVE MAIN BOARD) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: activeView === 'notes' ? 'translateY(0)' : activeView === 'board' ? 'translateY(-100vh)' : 'translateY(-200vh)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <DocumentBoardView
          documents={documents}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          onCreateDoc={handleCreateDoc}
          onUpdateDoc={handleUpdateDoc}
          onDeleteDoc={handleDeleteDoc}
          gridMode={gridMode}
          onGridModeChange={setGridMode}
          onTransitionToBoard={() => setActiveView('board')}
        />
      </div>

      {/* View 2: Main Canvas Board (CENTER) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: activeView === 'board' ? 'translateY(0)' : activeView === 'notes' ? 'translateY(100vh)' : 'translateY(-100vh)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Main Canvas Board with Persistent Pan & Zoom */}
        <CanvasBoard
          notes={notes}
          selectedNoteIds={selectedNoteIds}
          onSelectNotes={handleSelectNotes}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onOpenCalendarModal={setCalendarModalNote}
          onDoubleTapCanvas={(x, y) => handleAddNote(x, y, false)}
          gridMode={gridMode}
          pan={viewport.pan}
          onPanChange={(newPan) => setViewport(prev => ({ ...prev, pan: newPan }))}
          autoSortCompleted={autoSortCompleted}
        />

        {/* Subtle Transparent Spatial Navigation Triggers — Centered on X-axis */}
        <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <button
            className="subtle-spatial-nav"
            onClick={() => setActiveView('notes')}
            title="Ir a Notas"
          >
            <ChevronUp size={14} />
            <span className="nav-label font-mono">Notas</span>
          </button>
        </div>

        <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <button
            className="subtle-spatial-nav"
            onClick={() => setActiveView('planner')}
            title="Ir a Planificador"
          >
            <ChevronDown size={14} />
            <span className="nav-label font-mono">Planificador</span>
          </button>
        </div>

        {/* Mobile Nav Bar */}
        <div className="mobile-nav-bar">
          <button className="btn-icon" onClick={() => setActiveView('notes')}>
            <FileText size={14} />
            <span>Notas</span>
          </button>
          <button className="btn-icon active" onClick={() => setActiveView('board')}>
            <Plus size={14} />
            <span>Lienzo</span>
          </button>
          <button className="btn-icon" onClick={() => setActiveView('planner')}>
            <Calendar size={14} />
            <span>Planificador</span>
          </button>
          <button className="btn-icon" onClick={() => setIsSidebarOpen(true)}>
            <BookOpen size={14} />
            <span>Índice</span>
          </button>
        </div>
      </div>

      {/* View 3: Weekly Planner (BELOW MAIN BOARD) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: activeView === 'planner' ? 'translateY(0)' : activeView === 'board' ? 'translateY(100vh)' : 'translateY(200vh)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <WeeklyPlanner
          boardNotes={notes}
          plannerTasks={plannerTasks}
          onUpdatePlannerTasks={handleUpdatePlannerTasks}
          onUpdateBoardNotes={handleUpdateNote}
          onOpenCalendarModal={setCalendarModalNote}
          onTransitionToBoard={() => setActiveView('board')}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
        />
      </div>



      {/* Sidebar List Panel */}
      <SidebarList
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        notes={notes}
        onSelectNote={(id) => {
          handleSelectNotes(id);
          setActiveView('board');
        }}
        onAddNote={() => {
          handleAddNote(200, 200, false);
          setActiveView('board');
        }}
        onOpenCalendarModal={setCalendarModalNote}
      />

      {/* Left Edge Panel — hover left border to reveal */}
      <LeftEdgePanel
        activeView={activeView}
        plannerTasks={plannerTasks}
        boardNotes={notes}
        onUpdatePlannerTasks={handleUpdatePlannerTasks}
        onUpdateBoardNotes={handleUpdateNote}
      />

      {/* Google Calendar Sync Modal */}
      <GoogleCalendarModal
        note={calendarModalNote}
        isOpen={!!calendarModalNote}
        onClose={() => setCalendarModalNote(null)}
        onSyncSuccess={handleCalendarSyncSuccess}
      />
    </div>
  );
}
