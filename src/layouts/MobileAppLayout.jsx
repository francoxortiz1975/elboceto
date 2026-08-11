import React from 'react';
import {
  FileText,
  Plus,
  Calendar,
  BookOpen
} from 'lucide-react';
import { DocumentBoardView } from '../components/DocumentBoardView';
import { CanvasBoard } from '../components/CanvasBoard';
import { WeeklyPlanner } from '../components/WeeklyPlanner';

export function MobileAppLayout({
  activeView,
  setActiveView,
  documents,
  activeDocId,
  setActiveDocId,
  handleCreateDoc,
  handleUpdateDoc,
  handleDeleteDoc,
  notes,
  selectedNoteIds,
  handleSelectNotes,
  handleUpdateNote,
  handleDeleteNote,
  setCalendarModalNote,
  handleAddNote,
  gridMode,
  setGridMode,
  viewport,
  setViewport,
  autoSortCompleted,
  plannerTasks,
  handleUpdatePlannerTasks,
  weekOffset,
  setWeekOffset,
  setIsSidebarOpen,
  onMouseMoveSurface
}) {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg-book)' }}>
      {/* Mobile Top Header */}
      <header className="mobile-header" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        padding: '0 16px',
        background: 'rgba(247, 244, 238, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: 'var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="brand-title" style={{ fontSize: '1.1rem' }}>el boceto</span>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeView === 'notes' ? 'Notas' : activeView === 'planner' ? 'Planificador' : 'Lienzo'}
          </span>
        </div>

        <button
          className="btn-icon active"
          style={{ borderRadius: '16px', padding: '4px 10px', fontSize: '0.72rem' }}
          onClick={() => handleAddNote(180, 180, false)}
          title="Crear Nota"
        >
          <Plus size={12} />
          <span className="font-mono">Nota</span>
        </button>
      </header>

      {/* Main Viewport Container */}
      <div style={{ position: 'absolute', top: '48px', bottom: '80px', left: 0, right: 0, overflow: 'hidden' }}>
        {activeView === 'notes' && (
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
            onMouseMoveSurface={onMouseMoveSurface}
          />
        )}

        {activeView === 'board' && (
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
            onMouseMoveSurface={onMouseMoveSurface}
          />
        )}

        {activeView === 'planner' && (
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
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="mobile-nav-bar">
        <button
          className={`btn-icon ${activeView === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveView('notes')}
        >
          <FileText size={16} />
          <span className="font-mono">Notas</span>
        </button>

        <button
          className={`btn-icon ${activeView === 'board' ? 'active' : ''}`}
          onClick={() => setActiveView('board')}
        >
          <Plus size={16} />
          <span className="font-mono">Lienzo</span>
        </button>

        <button
          className={`btn-icon ${activeView === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveView('planner')}
        >
          <Calendar size={16} />
          <span className="font-mono">Planificador</span>
        </button>

        <button
          className="btn-icon"
          onClick={() => setIsSidebarOpen(true)}
        >
          <BookOpen size={16} />
          <span className="font-mono">Índice</span>
        </button>
      </div>
    </div>
  );
}
