// Pure translation functions between the app's local (camelCase) state shapes
// and the Supabase (snake_case) row shapes. This is the only place that needs
// to know both shapes.

const trimTime = (t) => (t ? t.slice(0, 5) : t); // 'HH:MM:SS' -> 'HH:MM'

export function noteToRow(note, userId, documentId) {
  return {
    id: note.id,
    user_id: userId,
    document_id: documentId,
    x: note.x,
    y: note.y,
    is_card: !!note.isCard,
    is_event: !!note.isEvent,
    event_date: note.eventDate || null,
    event_time: note.eventTime || null,
    event_duration_min: note.eventDurationMin || null,
    calendar_synced: !!note.calendarSynced,
    blocks: note.blocks || []
  };
}

export function rowToNote(row) {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    isCard: row.is_card,
    isEvent: row.is_event,
    eventDate: row.event_date || undefined,
    eventTime: trimTime(row.event_time) || undefined,
    eventDurationMin: row.event_duration_min || undefined,
    calendarSynced: row.calendar_synced,
    blocks: row.blocks || []
  };
}

export function documentToRow(doc, userId) {
  const pan = doc.viewport?.pan || { x: 0, y: 140 };
  const homePin = doc.viewport?.homePin || pan;
  return {
    id: doc.id,
    user_id: userId,
    title: doc.title,
    icon: doc.icon,
    viewport_pan_x: pan.x,
    viewport_pan_y: pan.y,
    viewport_home_pin_x: homePin.x,
    viewport_home_pin_y: homePin.y
  };
}

export function rowToDocument(row, notesForDoc) {
  return { ...rowToDocumentMeta(row), notes: notesForDoc };
}

// Document fields only, no `notes` — for merging a realtime document change
// into an existing local document without clobbering its notes array.
export function rowToDocumentMeta(row) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    viewport: {
      pan: { x: row.viewport_pan_x, y: row.viewport_pan_y },
      homePin: { x: row.viewport_home_pin_x, y: row.viewport_home_pin_y }
    }
  };
}

export function taskToRow(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    note_id: task.noteId || null,
    text: task.text || '',
    completed: !!task.completed,
    day_key: task.dayKey,
    day_iso: task.dayIso || null,
    time_slot: task.timeSlot,
    duration_min: task.durationMin || 60
  };
}

export function rowToTask(row) {
  return {
    id: row.id,
    noteId: row.note_id || undefined,
    text: row.text,
    completed: row.completed,
    dayKey: row.day_key,
    dayIso: row.day_iso || undefined,
    timeSlot: trimTime(row.time_slot),
    durationMin: row.duration_min
  };
}

export function settingsToRow(userId, gridMode, viewport) {
  const pan = viewport?.pan || { x: 0, y: 0 };
  const homePin = viewport?.homePin || pan;
  return {
    user_id: userId,
    grid_mode: gridMode,
    viewport_pan_x: pan.x,
    viewport_pan_y: pan.y,
    viewport_home_pin_x: homePin.x,
    viewport_home_pin_y: homePin.y
  };
}

export function rowToSettings(row) {
  return {
    gridMode: row.grid_mode,
    viewport: {
      pan: { x: row.viewport_pan_x, y: row.viewport_pan_y },
      homePin: { x: row.viewport_home_pin_x, y: row.viewport_home_pin_y }
    }
  };
}
