import React from 'react';
import {
  FileText,
  Plus,
  Calendar,
  BookOpen,
  MapPin
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
  onMouseMoveSurface,
  handleGoToHomePin,
  handleConfirmSetHomePin,
  showPinConfirm,
  setShowPinConfirm
}) {
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0];

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'var(--bg-book)' }}>
      {/* Mobile Top Header */}
      <header className="mobile-header" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        padding: '0 12px',
        background: 'rgba(247, 244, 238, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: 'var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="brand-title" style={{ fontSize: '1.05rem' }}>el boceto</span>
          <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeView === 'notes' ? 'Notas' : activeView === 'planner' ? 'Planificador' : 'Lienzo'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Inicio (Home Pin) Button for Notes and Lienzo */}
          {(activeView === 'notes' || activeView === 'board') && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                className="btn-icon"
                style={{ borderRadius: '14px 0 0 14px', padding: '4px 8px', fontSize: '0.7rem' }}
                onClick={handleGoToHomePin}
                title="Ir a Posición de Inicio"
              >
                <MapPin size={12} />
                <span className="font-mono">Inicio</span>
              </button>
              <button
                className="dock-pin-toggle font-mono"
                style={{ borderRadius: '0 14px 14px 0', padding: '4px 6px', fontSize: '0.62rem' }}
                onClick={(e) => { e.stopPropagation(); setShowPinConfirm(prev => !prev); }}
                title="Fijar posición de Inicio (▼)"
              >
                ▼
              </button>

              {showPinConfirm && (
                <div className="home-pin-popover" style={{ right: 0, left: 'auto', top: 'calc(100% + 6px)', zIndex: 1200 }}>
                  <div className="home-pin-title font-mono">📍 Posición Fija de Inicio</div>
                  <div className="home-pin-desc">
                    ¿Fijar posición actual como inicio (`X: {activeView === 'notes' ? (currentDoc?.viewport?.pan?.x || 0) : (viewport.pan?.x || 0)}, Y: {activeView === 'notes' ? (currentDoc?.viewport?.pan?.y || 0) : (viewport.pan?.y || 0)}`)?
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
          )}

          <button
            className="btn-icon active"
            style={{ borderRadius: '14px', padding: '4px 8px', fontSize: '0.7rem' }}
            onClick={() => handleAddNote(180, 180, false)}
            title="Crear Nota"
          >
            <Plus size={12} />
            <span className="font-mono">Nota</span>
          </button>
        </div>
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
      </div>
    </div>
  );
}
