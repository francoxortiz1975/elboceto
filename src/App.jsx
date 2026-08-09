import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasBoard } from './components/CanvasBoard';
import { SidebarList } from './components/SidebarList';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { LeftEdgePanel } from './components/LeftEdgePanel';
import { FreeformDocEditor } from './components/FreeformDocEditor';
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
  FileText
} from 'lucide-react';

const STORAGE_KEY_NOTES = 'el_boceto_notes_v2';
const STORAGE_KEY_PLANNER = 'el_boceto_planner_v1';
const STORAGE_KEY_VIEWPORT = 'el_boceto_viewport_v1';
const STORAGE_KEY_DOCUMENTS = 'el_boceto_documents_v1';

const INITIAL_DOCUMENTS = [
  {
    id: 'doc_1',
    title: 'Notas de Desarrollo y Ideas',
    icon: '📝',
    blocks: [
      { id: 'b1', type: 'heading-1', text: 'Notas en Documento Libre' },
      { id: 'b2', type: 'callout', text: 'Escribe de forma fluida como en Notion o arrastra bloques libremente al margen.', color: 'amber' },
      { id: 'b3', type: 'paragraph', text: 'Presiona Enter para crear párrafos, Tab para sangrar o "/" para desplegar el menú de bloques.' },
      { id: 'b4', type: 'heading-2', text: 'Lista de Objetivos' },
      { id: 'b5', type: 'check', text: 'Organizar ideas en vista de documento fluida', completed: true },
      { id: 'b6', type: 'check', text: 'Arrastrar bloques libres al margen derecho', completed: false }
    ],
    floatingNotes: [
      { id: 'fn1', x: 20, y: 140, title: 'Recordatorio', text: 'Puedes deslizar hacia arriba para el Lienzo o hacia abajo para el Planificador.' }
    ]
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
    const newDoc = {
      id: `doc_${Date.now()}`,
      title: 'Nuevo Documento',
      icon: '📝',
      blocks: [
        { id: `b_${Date.now()}`, type: 'heading-1', text: 'Nuevo Documento' },
        { id: `b_${Date.now() + 1}`, type: 'paragraph', text: 'Empieza a escribir aquí...' }
      ],
      floatingNotes: []
    };
    setDocuments(prev => [...prev, newDoc]);
    setActiveDocId(newDoc.id);
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


  // Persistent pan state only (zoom removed — always 1:1 for grid alignment)
  const [viewport, setViewport] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEWPORT);
      if (saved) {
        const v = JSON.parse(saved);
        return { pan: v.pan || { x: 0, y: 140 } };
      }
    } catch (e) {}
    return { pan: { x: 0, y: 140 } };
  });

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

  const [gridMode, setGridMode] = useState('dots');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [calendarModalNote, setCalendarModalNote] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

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

  // Global Keyboard Listener for Undo (Control+Z / Cmd+Z) and Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && isZ && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((isCtrlOrCmd && isZ && e.shiftKey) || (isCtrlOrCmd && isY)) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

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
    setSelectedNoteId(newNote.id);
  };

  const handleUpdateNote = (updatedNote) => {
    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
  };

  const handleDeleteNote = (id) => {
    pushSnapshot();
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
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

  const resetViewportPosition = () => setViewport({ pan: { x: 0, y: 140 } });

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* View 1: Freeform Document Notes (ABOVE MAIN BOARD) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: activeView === 'notes' ? 'translateY(0)' : activeView === 'board' ? 'translateY(-100vh)' : 'translateY(-200vh)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <FreeformDocEditor
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
        <header className="top-header">
          <div className="brand-pill">
            <span className="brand-title">le brouillon</span>
            <span className="minimal-badge">escritura libre</span>
          </div>

          <div className="floating-toolbar">
            <button className="btn-icon active" onClick={() => handleAddNote(180, 180, false)}>
              <Plus size={14} />
              <span className="font-mono">Escribir</span>
            </button>

            <button className="btn-icon" onClick={() => handleAddNote(240, 240, true)} title="Añadir tarjeta Post-It">
              <StickyNote size={13} />
              <span className="font-mono">Post-it</span>
            </button>

            <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

            <button
              className={`btn-icon ${gridMode === 'dots' ? 'active' : ''}`}
              onClick={() => setGridMode('dots')}
              title="Cuadrícula Puntos"
            >
              <Grid size={13} />
              <span className="font-mono">Puntos</span>
            </button>
            <button
              className={`btn-icon ${gridMode === 'lines' ? 'active' : ''}`}
              onClick={() => setGridMode('lines')}
              title="Líneas Cuaderno"
            >
              <Layers size={13} />
              <span className="font-mono">Líneas</span>
            </button>

            <button className="btn-icon" onClick={handleUndo} title="Deshacer (Control+Z / Cmd+Z)">
              <Undo2 size={13} />
            </button>
            <button className="btn-icon" onClick={handleRedo} title="Rehacer (Control+Shift+Z / Cmd+Shift+Z)">
              <Redo2 size={13} />
            </button>

            <button
              className={`btn-icon ${showCompleted ? 'active' : ''}`}
              onClick={() => setShowCompleted(p => !p)}
              title={showCompleted ? "Ocultar tareas completadas" : "Mostrar tareas completadas"}
            >
              <CheckSquare size={13} />
              <span className="font-mono">{showCompleted ? 'Ver completadas' : 'Ocultar Done'}</span>
            </button>

            <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

            <button className="btn-icon" onClick={resetViewportPosition} title="Reajustar Inicio de Lienzo">
              <RotateCcw size={12} />
            </button>

            <div style={{ width: '1px', height: '16px', background: 'rgba(24,24,27,0.12)', margin: '0 4px' }} />

            <button className="btn-icon" onClick={() => setIsSidebarOpen(true)}>
              <BookOpen size={13} />
              <span className="font-mono">Índice ({notes.length})</span>
            </button>

            <button className="btn-icon" onClick={handleExportJSON} title="Exportar Copia de Seguridad">
              <Download size={13} />
            </button>
            <label className="btn-icon" style={{ margin: 0, cursor: 'pointer' }} title="Importar Copia de Seguridad">
              <Upload size={13} />
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>
          </div>
        </header>

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
          showCompleted={showCompleted}
        />

        {/* Spatial Navigation Triggers */}
        <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 100 }}>
          <button
            className="btn-icon active"
            style={{ borderRadius: '20px', padding: '8px 14px', boxShadow: 'var(--shadow-floating)' }}
            onClick={() => setActiveView('notes')}
          >
            <FileText size={14} />
            <span className="font-mono">↑ Vista 1: Notas Organizadas</span>
          </button>
        </div>

        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
          <button
            className="btn-icon active"
            style={{ borderRadius: '20px', padding: '8px 14px', boxShadow: 'var(--shadow-floating)' }}
            onClick={() => setActiveView('planner')}
          >
            <Calendar size={14} />
            <span className="font-mono">↓ Vista 3: Planificador Semanal</span>
            <ArrowDown size={12} />
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
        />
      </div>



      {/* Sidebar List Panel */}
      <SidebarList
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        notes={notes}
        onSelectNote={(id) => {
          setSelectedNoteId(id);
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
