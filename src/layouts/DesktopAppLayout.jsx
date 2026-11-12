import React, { useState } from 'react';
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
  Pin,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { DocumentBoardView } from '../components/DocumentBoardView';
import { CanvasBoard } from '../components/CanvasBoard';
import { PlanView } from '../components/PlanView';
import { SCHEDULES } from '../data/schedules';
import { SPRINTS, sprintSchedule } from '../data/sprints';
import { isoOf } from '../lib/areaPlan';
import sumayPlan from '../../docs/sumay-instagram.plan.json';
import { exportContentPlan, baseStackIds } from '../lib/contentPlan';
import { AuthButton } from '../components/AuthButton';
import { SaveButton } from '../components/SaveButton';
import { LoadButton } from '../components/LoadButton';

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
  areaPlan,
  setAreaPlan,
  planTab,
  setPlanTab,
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
  onImportSchedule,
  onImportContentPlan,
  theme,
  onThemeChange,
  topExtra,
  onTopExtraChange,
  gcal,
  legacyCount,
  onOpenLegacy,
  setIsSidebarOpen,
  onMouseMoveSurface,
  onSaveToCloud,
  onLoadFromCloud
}) {
  const currentDoc = documents.find(d => d.id === activeDocId) || documents[0];
  const [scheduleResult, setScheduleResult] = useState({});
  const [contentResult, setContentResult] = useState(null);
  const contentFileRef = React.useRef(null);
  // Downloads each stack as a content-plan file with the edits made here (to hand back to the content conversation).
  const handleExportContent = () => {
    const ids = baseStackIds(areaPlan); // Stories and Posts travel inside their plan's file
    if (!ids.length) { setContentResult({ error: 'No hay ningún plan de contenido importado.' }); return; }
    ids.forEach((id) => {
      const blob = new Blob([JSON.stringify(exportContentPlan(areaPlan, id), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${id}.plan.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    setContentResult({ exported: ids.length });
  };
  const handleContentFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setContentResult(onImportContentPlan(JSON.parse(reader.result))); }
      catch { setContentResult({ error: 'No se pudo leer el archivo (JSON no válido).' }); }
    };
    reader.readAsText(file);
  };

  // Views are stacked vertically; each sits at its distance from the active one.
  const VIEW_ORDER = ['notes', 'board', 'planner'];
  const viewOffset = (view) =>
    `translateY(${(VIEW_ORDER.indexOf(view) - VIEW_ORDER.indexOf(activeView)) * 100}vh)`;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
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

        {/* Week Switcher Controls in Planner View (only while looking at the week) */}
        {activeView === 'planner' && planTab === 'week' && (
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
            <Pin size={13} />
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

        <AuthButton />
        <SaveButton onSave={onSaveToCloud} />
        <LoadButton onLoad={onLoadFromCloud} />

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

              {/* Events that still have no area */}
              {legacyCount > 0 && (
                <>
                  <div className="panel-section-title font-mono">EVENTOS SIN ÁREA</div>
                  <button
                    className="btn-icon"
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '12px' }}
                    onClick={() => { onOpenLegacy(); setShowMoreMenu(false); }}
                  >
                    <CheckSquare size={12} />
                    <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                      Asignar área a {legacyCount} evento{legacyCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </>
              )}

              {/* Google Calendar (app -> Google) */}
              <div className="panel-section-title font-mono">APARIENCIA</div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                {[['system', 'Sistema', Monitor], ['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    className="btn-icon"
                    aria-pressed={theme === id}
                    style={{ flex: 1, minWidth: 0, justifyContent: 'center', padding: '4px 6px', gap: '4px', ...(theme === id ? { background: 'var(--bg-active)', border: 'var(--border-strong)' } : {}) }}
                    onClick={() => onThemeChange(id)}
                  >
                    <Icon size={12} />
                    <span className="font-mono" style={{ fontSize: '0.7rem' }}>{label}</span>
                  </button>
                ))}
              </div>

              <div className="panel-section-title font-mono">APP INSTALADA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="font-mono" style={{ fontSize: '0.7rem', flex: 1 }}>Margen superior</span>
                <button className="btn-icon" aria-label="Menos margen" onClick={() => onTopExtraChange(topExtra - 4)}>−</button>
                <span className="font-mono" style={{ fontSize: '0.7rem', minWidth: '34px', textAlign: 'center' }}>{topExtra} px</span>
                <button className="btn-icon" aria-label="Más margen" onClick={() => onTopExtraChange(topExtra + 4)}>+</button>
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>Si la barra del título tapa la parte de arriba de la app, sube este valor hasta que se vea.</div>

              <div className="panel-section-title font-mono">GOOGLE CALENDAR</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                <button
                  className={`btn-icon ${gcal.on ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'space-between' }}
                  disabled={!gcal.canUse || gcal.phase === 'syncing' && !gcal.on}
                  onClick={gcal.on ? gcal.disable : gcal.enable}
                  title={gcal.canUse ? 'Enviar tu plan a un calendario de Google' : 'Inicia sesión para usarlo'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} />
                    <span className="font-mono" style={{ fontSize: '0.75rem' }}>Sincronizar con Google</span>
                  </div>
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: gcal.on ? 'inherit' : 'var(--text-muted)' }}>
                    {gcal.on ? 'ON' : 'OFF'}
                  </span>
                </button>
                {!gcal.canUse && (
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                    Inicia sesión para usarlo.
                  </span>
                )}
                {gcal.on && (
                  <button className="btn-icon" style={{ width: '100%' }} disabled={gcal.phase === 'syncing'} onClick={gcal.syncNow}>
                    <span className="font-mono" style={{ fontSize: '0.75rem' }}>
                      {gcal.phase === 'syncing' ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </span>
                  </button>
                )}
                {(gcal.message || (gcal.on && gcal.phase === 'ok')) && (
                  <span
                    className="font-mono"
                    style={{ fontSize: '0.68rem', padding: '0 4px', color: gcal.phase === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}
                  >
                    {gcal.phase === 'error' ? '⚠ ' : ''}
                    {gcal.message || `✓ ${gcal.count} evento${gcal.count === 1 ? '' : 's'} en Google${gcal.lastSync ? ` · ${gcal.lastSync.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                  </span>
                )}
              </div>

              {/* Timetables */}
              <div className="panel-section-title font-mono">HORARIOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {SCHEDULES.map(sch => {
                  const r = scheduleResult[sch.id];
                  return (
                    <React.Fragment key={sch.id}>
                      <button
                        className="btn-icon"
                        style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => setScheduleResult(prev => ({ ...prev, [sch.id]: onImportSchedule(sch) }))}
                      >
                        <Calendar size={12} />
                        <span className="font-mono" style={{ fontSize: '0.75rem' }}>{sch.label}</span>
                      </button>
                      {r && (
                        <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                          {r.added > 0
                            ? `✓ ${r.added} clases añadidas a ${sch.area}. Míralas en Plan → Semana o Mes.`
                            : 'Ya estaban importadas, no se añadió nada.'}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Content plans */}
              <div className="panel-section-title font-mono">PLAN DE CONTENIDO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                <button
                  className="btn-icon"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setContentResult(onImportContentPlan(sumayPlan))}
                >
                  <Calendar size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>{sumayPlan.label}</span>
                </button>
                <button
                  className="btn-icon"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => contentFileRef.current && contentFileRef.current.click()}
                >
                  <Upload size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>Importar plan de contenido (.json)</span>
                </button>
                <button
                  className="btn-icon"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={handleExportContent}
                >
                  <Download size={12} />
                  <span className="font-mono" style={{ fontSize: '0.75rem' }}>Exportar plan con mis ediciones (.json)</span>
                </button>
                <input ref={contentFileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleContentFile} />
                {contentResult && (
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: contentResult.error ? 'var(--danger)' : 'var(--text-muted)', padding: '0 4px' }}>
                    {contentResult.exported
                      ? '✓ Archivo descargado. Pásalo a la conversación de marketing.'
                      : contentResult.error
                      ? contentResult.error
                      : contentResult.added > 0 || contentResult.moved > 0
                        ? `✓ ${contentResult.added} bloques añadidos a ${contentResult.area}${contentResult.moved ? `, ${contentResult.moved} movidos a otra área` : ''}. El stack está en el panel izquierdo.`
                        : 'Ya estaba importado, no se añadió nada.'}
                  </span>
                )}
              </div>

              {/* Loginet sprints */}
              <div className="panel-section-title font-mono">SPRINTS LOGINET</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {SPRINTS.map(sp => {
                  const id = `sprint-${sp.n}`;
                  const r = scheduleResult[id];
                  return (
                    <React.Fragment key={id}>
                      <button
                        className="btn-icon"
                        style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => setScheduleResult(prev => ({ ...prev, [id]: onImportSchedule(sprintSchedule(sp, isoOf(new Date()))) }))}
                      >
                        <Calendar size={12} />
                        <span className="font-mono" style={{ fontSize: '0.75rem' }}>Sprint {sp.n} · {sp.title}</span>
                      </button>
                      {r && (
                        <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 4px' }}>
                          {r.added > 0
                            ? `✓ ${r.added} bloques añadidos a Loginet para hoy.`
                            : 'Ya estaba importado, no se añadió nada.'}
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

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
          transform: viewOffset('notes'),
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
          transform: viewOffset('board'),
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

        <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: '12px' }}>
          <button
            className="subtle-spatial-nav"
            onClick={() => setActiveView('planner')}
            title="Ir al Plan"
          >
            <ChevronDown size={14} />
            <span className="nav-label font-mono">Plan</span>
          </button>
        </div>
      </div>

      {/* View 3: Plan — area board, week and month (BELOW MAIN BOARD) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: viewOffset('planner'),
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <PlanView
          tab={planTab}
          onTabChange={setPlanTab}
          areaPlan={areaPlan}
          onChangeAreaPlan={setAreaPlan}
          onBack={() => setActiveView('board')}
          boardNotes={notes}
          plannerTasks={plannerTasks}
          onUpdatePlannerTasks={handleUpdatePlannerTasks}
          onUpdateBoardNotes={handleUpdateNote}
          onOpenCalendarModal={setCalendarModalNote}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
        />
      </div>
    </div>
  );
}
