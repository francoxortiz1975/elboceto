import React from 'react';
import {
  Plus,
  BookOpen,
  Grid,
  Download,
  Upload,
  Layers,
  Calendar,
  Undo2,
  Redo2,
  CheckSquare,
  FileText,
  MapPin,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { DocumentBoardView } from '../components/DocumentBoardView';
import { CanvasBoard } from '../components/CanvasBoard';
import { WeeklyPlanner } from '../components/WeeklyPlanner';

export function DesktopAppLayout({
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
  setAutoSortCompleted,
  plannerTasks,
  handleUpdatePlannerTasks,
  weekOffset,
  setWeekOffset,
  currentWeekLabel,
  handleGoToHomePin,
  handleConfirmSetHomePin,
  showPinConfirm,
  setShowPinConfirm,
  showDocDropdown,
  setShowDocDropdown,
  showMoreMenu,
  setShowMoreMenu,
  handleUndo,
  handleRedo,
  handleExportJSON,
  handleImportJSON,
  setIsSidebarOpen,
  onMouseMoveSurface
}) {
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0];

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
            title="Ir a Posición de Inicio"
          >
            <span>📍</span>
            <span className="font-mono">Fijar</span>
          </button>
          <button
            className="dock-pin-toggle font-mono"
            onClick={(e) => { e.stopPropagation(); setShowPinConfirm(prev => !prev); }}
            title="Fijar posición de Inicio"
          >
            ▼
          </button>

          {showPinConfirm && (
            <div className="home-pin-popover" style={{ right: 0, left: 'auto', top: 'calc(100% + 6px)' }}>
              <div className="home-pin-title font-mono">📍 Posición de Inicio</div>
              <div className="home-pin-desc">
                ¿Fijar posición actual como inicio?
              </div>
              <div className="home-pin-actions">
                <button className="btn-pin-cancel font-mono" onClick={() => setShowPinConfirm(false)}>
                  Cancelar
                </button>
                <button className="btn-pin-confirm font-mono" onClick={handleConfirmSetHomePin}>
                  Fijar
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
          onMouseMoveSurface={onMouseMoveSurface}
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
          onMouseMoveSurface={onMouseMoveSurface}
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
    </div>
  );
}
