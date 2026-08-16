import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasBoard } from './components/CanvasBoard';
import { SidebarList } from './components/SidebarList';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { WeeklyPlanner } from './components/WeeklyPlanner';
import { LeftEdgePanel } from './components/LeftEdgePanel';
import { DocumentBoardView } from './components/DocumentBoardView';
import { MobileAppLayout } from './layouts/MobileAppLayout';
import { DesktopAppLayout } from './layouts/DesktopAppLayout';
import { useAuth } from './context/AuthContext';
import { hasCloudData, pullCloudToLocal, syncLocalToCloud } from './lib/cloudSync';
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

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

function parseTextToBlocks(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  return lines.map((line, i) => {
    let text = line;
    let indent = 0;
    const leadingSpaces = line.match(/^(\s+)/);
    if (leadingSpaces) {
      indent = Math.min(4, Math.floor(leadingSpaces[1].length / 2));
      text = line.trim();
    } else {
      text = line.trim();
    }

    let isHeading = false;
    let isSubheading = false;
    let isCheck = false;
    let completed = false;
    let isBullet = false;
    let isNumber = false;

    if (text.startsWith('## ')) {
      isSubheading = true;
      text = text.substring(3);
    } else if (text.startsWith('# ')) {
      isHeading = true;
      text = text.substring(2);
    } else if (text.startsWith('[x] ') || text.startsWith('[X] ') || text.startsWith('- [x] ') || text.startsWith('- [X] ')) {
      isCheck = true;
      completed = true;
      text = text.replace(/^(\[x\]|\[X\]|-\s*\[x\]|-\s*\[X\])\s*/, '');
    } else if (text.startsWith('[ ] ') || text.startsWith('[] ') || text.startsWith('- [ ] ') || text.startsWith('- [] ')) {
      isCheck = true;
      completed = false;
      text = text.replace(/^(\[ \]|\[\]|-\s*\[ \]|-\s*\[\])\s*/, '');
    } else if (text.startsWith('- ') || text.startsWith('* ') || text.startsWith('• ')) {
      isBullet = true;
      text = text.replace(/^(-\s*|\*\s*|•\s*)/, '');
    } else if (/^\d+\.\s/.test(text)) {
      isNumber = true;
      text = text.replace(/^\d+\.\s*/, '');
    }

    return {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + i,
      text,
      isHeading,
      isSubheading,
      isCheck,
      completed,
      isBullet,
      isNumber,
      indent
    };
  });
}

  const lastMouseSurfacePos = useRef(null);
  const handleMouseMoveSurface = (pos) => {
    lastMouseSurfacePos.current = pos;
  };

  // Global Keyboard Listener for Undo (Cmd+Z), Redo (Cmd+Shift+Z / Cmd+Y), and Copy/Paste Note Cards (Cmd+C / Cmd+V)
  useEffect(() => {
    const pasteBlocksToActiveBoard = (pastedText) => {
      if (!pastedText || !pastedText.trim()) return;
      pushSnapshot();
      const parsedBlocks = parseTextToBlocks(pastedText);
      const newId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

      const activePan = activeView === 'notes'
        ? ((documents.find(d => d.id === activeDocId) || documents[0])?.viewport?.pan || { x: 0, y: 140 })
        : (viewport.pan || { x: 0, y: 140 });

      let targetX, targetY;
      if (lastMouseSurfacePos.current && typeof lastMouseSurfacePos.current.x === 'number') {
        targetX = Math.max(48, Math.round(lastMouseSurfacePos.current.x / 24) * 24);
        targetY = Math.max(56, Math.round(lastMouseSurfacePos.current.y / 28) * 28);
      } else {
        targetX = Math.max(48, Math.round((-activePan.x + 200) / 24) * 24);
        targetY = Math.max(56, Math.round((-activePan.y + 180) / 28) * 28);
      }

      const newNote = {
        id: newId,
        x: targetX,
        y: targetY,
        isCard: false,
        date: 'Hoy',
        calendarSynced: false,
        blocks: parsedBlocks
      };

      if (activeView === 'notes') {
        const curDoc = documents.find(d => d.id === activeDocId) || documents[0];
        if (curDoc) {
          handleUpdateDoc({
            ...curDoc,
            notes: [...(curDoc.notes || []), newNote]
          });
        }
      } else {
        setNotes(prev => [...prev, newNote]);
        setSelectedNoteIds([newId]);
      }
    };

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
      } else if (isCtrlOrCmd && key === 'v' && !isEditingText) {
        e.preventDefault();
        const activePan = activeView === 'notes'
          ? ((documents.find(d => d.id === activeDocId) || documents[0])?.viewport?.pan || { x: 0, y: 140 })
          : (viewport.pan || { x: 0, y: 140 });

        let baseTargetX, baseTargetY;
        if (lastMouseSurfacePos.current && typeof lastMouseSurfacePos.current.x === 'number') {
          baseTargetX = Math.max(48, Math.round(lastMouseSurfacePos.current.x / 24) * 24);
          baseTargetY = Math.max(56, Math.round(lastMouseSurfacePos.current.y / 28) * 28);
        } else {
          baseTargetX = Math.max(48, Math.round((-activePan.x + 200) / 24) * 24);
          baseTargetY = Math.max(56, Math.round((-activePan.y + 180) / 28) * 28);
        }

        if (copiedNoteCards.current.length > 0) {
          pushSnapshot();
          const newPastedIds = [];
          const pastedNotes = copiedNoteCards.current.map((n, idx) => {
            const newId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_' + idx;
            newPastedIds.push(newId);
            return {
              ...JSON.parse(JSON.stringify(n)),
              id: newId,
              x: baseTargetX + (idx * 24),
              y: baseTargetY + (idx * 28)
            };
          });

          if (activeView === 'notes') {
            const curDoc = documents.find(d => d.id === activeDocId) || documents[0];
            if (curDoc) {
              handleUpdateDoc({
                ...curDoc,
                notes: [...(curDoc.notes || []), ...pastedNotes]
              });
            }
          } else {
            setNotes(prev => [...prev, ...pastedNotes]);
            setSelectedNoteIds(newPastedIds);
          }
        } else if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(text => {
            if (text) pasteBlocksToActiveBoard(text);
          }).catch(err => {
            console.warn('Clipboard access denied:', err);
          });
        }
      } else if ((key === 'backspace' || key === 'delete') && !isEditingText && selectedNoteIds.length > 0) {
        e.preventDefault();
        pushSnapshot();
        setNotes(prev => prev.filter(n => !selectedNoteIds.includes(n.id)));
        setSelectedNoteIds([]);
      }
    };

    const handlePasteEvent = (e) => {
      const activeEl = document.activeElement;
      const isEditingText = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      if (isEditingText) return;

      const pastedText = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (pastedText && pastedText.trim()) {
        e.preventDefault();
        pasteBlocksToActiveBoard(pastedText);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [selectedNoteIds, notes, activeView, activeDocId, documents, viewport, handleUndo, handleRedo, pushSnapshot]);


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

  // ── Cloud sync (Supabase) ──────────────────────────────────────────────
  // Local-first: everything above works identically with no session. Once a
  // user is signed in, reconcile once (cloud wins if it already has data,
  // otherwise push current local state as the initial cloud copy). After
  // that, saving to the cloud is an explicit user action (handleSaveToCloud,
  // wired to a "Guardar" button) rather than continuous background sync —
  // simpler and avoids races between multiple devices/tabs syncing at once.
  const { user } = useAuth();
  const reconcileStartedForRef = useRef(null);

  useEffect(() => {
    if (!user) {
      reconcileStartedForRef.current = null;
      return;
    }
    if (reconcileStartedForRef.current === user.id) return;
    reconcileStartedForRef.current = user.id;

    (async () => {
      try {
        const cloudHasData = await hasCloudData(user.id);
        if (cloudHasData) {
          const cloud = await pullCloudToLocal(user.id);
          setNotes(cloud.notes);
          setDocuments(cloud.documents);
          setPlannerTasks(cloud.plannerTasks);
          setGridMode(cloud.gridMode);
          setViewport(cloud.viewport);
        } else {
          await syncLocalToCloud(user.id, { notes, documents, plannerTasks, gridMode, viewport });
        }
      } catch (e) {
        console.error('Error reconciling cloud data:', e);
      }
    })();
  }, [user]);

  const handleSaveToCloud = useCallback(() => {
    if (!user) return Promise.reject(new Error('No hay sesión iniciada'));
    return syncLocalToCloud(user.id, { notes, documents, plannerTasks, gridMode, viewport });
  }, [user, notes, documents, plannerTasks, gridMode, viewport]);

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
      {isMobile ? (
        <MobileAppLayout
          activeView={activeView}
          setActiveView={setActiveView}
          documents={documents}
          activeDocId={activeDocId}
          setActiveDocId={setActiveDocId}
          handleCreateDoc={handleCreateDoc}
          handleUpdateDoc={handleUpdateDoc}
          handleDeleteDoc={handleDeleteDoc}
          notes={notes}
          selectedNoteIds={selectedNoteIds}
          handleSelectNotes={handleSelectNotes}
          handleUpdateNote={handleUpdateNote}
          handleDeleteNote={handleDeleteNote}
          setCalendarModalNote={setCalendarModalNote}
          handleAddNote={handleAddNote}
          gridMode={gridMode}
          setGridMode={setGridMode}
          viewport={viewport}
          setViewport={setViewport}
          autoSortCompleted={autoSortCompleted}
          plannerTasks={plannerTasks}
          handleUpdatePlannerTasks={handleUpdatePlannerTasks}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          setIsSidebarOpen={setIsSidebarOpen}
          onMouseMoveSurface={handleMouseMoveSurface}
          handleGoToHomePin={handleGoToHomePin}
          handleConfirmSetHomePin={handleConfirmSetHomePin}
          showPinConfirm={showPinConfirm}
          setShowPinConfirm={setShowPinConfirm}
          onSaveToCloud={handleSaveToCloud}
        />
      ) : (
        <DesktopAppLayout
          activeView={activeView}
          setActiveView={setActiveView}
          documents={documents}
          activeDocId={activeDocId}
          setActiveDocId={setActiveDocId}
          handleCreateDoc={handleCreateDoc}
          handleUpdateDoc={handleUpdateDoc}
          handleDeleteDoc={handleDeleteDoc}
          notes={notes}
          selectedNoteIds={selectedNoteIds}
          handleSelectNotes={handleSelectNotes}
          handleUpdateNote={handleUpdateNote}
          handleDeleteNote={handleDeleteNote}
          setCalendarModalNote={setCalendarModalNote}
          handleAddNote={handleAddNote}
          gridMode={gridMode}
          setGridMode={setGridMode}
          viewport={viewport}
          setViewport={setViewport}
          autoSortCompleted={autoSortCompleted}
          setAutoSortCompleted={setAutoSortCompleted}
          plannerTasks={plannerTasks}
          handleUpdatePlannerTasks={handleUpdatePlannerTasks}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          currentWeekLabel={currentWeekLabel}
          handleGoToHomePin={handleGoToHomePin}
          handleConfirmSetHomePin={handleConfirmSetHomePin}
          showPinConfirm={showPinConfirm}
          setShowPinConfirm={setShowPinConfirm}
          showDocDropdown={showDocDropdown}
          setShowDocDropdown={setShowDocDropdown}
          showMoreMenu={showMoreMenu}
          setShowMoreMenu={setShowMoreMenu}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          handleExportJSON={handleExportJSON}
          handleImportJSON={handleImportJSON}
          setIsSidebarOpen={setIsSidebarOpen}
          onMouseMoveSurface={handleMouseMoveSurface}
          onSaveToCloud={handleSaveToCloud}
        />
      )}



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
