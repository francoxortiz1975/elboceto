import { supabase } from './supabaseClient';
import {
  noteToRow, rowToNote,
  documentToRow, rowToDocument,
  taskToRow, rowToTask,
  settingsToRow, rowToSettings
} from './dataMapping';

export async function hasCloudData(userId) {
  const [{ count: docCount }, { count: noteCount }, { count: taskCount }] = await Promise.all([
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('planner_tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);
  return (docCount || 0) > 0 || (noteCount || 0) > 0 || (taskCount || 0) > 0;
}

export async function pullCloudToLocal(userId) {
  const [{ data: docRows }, { data: noteRows }, { data: taskRows }, { data: settingsRow }] = await Promise.all([
    supabase.from('documents').select('*').eq('user_id', userId),
    supabase.from('notes').select('*').eq('user_id', userId),
    supabase.from('planner_tasks').select('*').eq('user_id', userId),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  ]);

  const notesByDocId = {};
  const topLevelNotes = [];
  for (const row of noteRows || []) {
    const note = rowToNote(row);
    if (row.document_id) {
      (notesByDocId[row.document_id] ||= []).push(note);
    } else {
      topLevelNotes.push(note);
    }
  }

  const documents = (docRows || []).map(row => rowToDocument(row, notesByDocId[row.id] || []));
  const plannerTasks = (taskRows || []).map(rowToTask);
  const settings = settingsRow ? rowToSettings(settingsRow) : { gridMode: 'dots', viewport: { pan: { x: 0, y: 0 }, homePin: { x: 0, y: 0 } } };

  return {
    notes: topLevelNotes,
    documents,
    plannerTasks,
    gridMode: settings.gridMode,
    viewport: settings.viewport
  };
}

async function reconcileTable({ table, userId, rows, extraFilter }) {
  let query = supabase.from(table).select('id').eq('user_id', userId);
  if (extraFilter) query = extraFilter(query);
  const { data: existing } = await query;

  const existingIds = new Set((existing || []).map(r => r.id));
  const localIds = new Set(rows.map(r => r.id));
  const toDelete = [...existingIds].filter(id => !localIds.has(id));

  if (rows.length > 0) {
    await supabase.from(table).upsert(rows);
  }
  if (toDelete.length > 0) {
    await supabase.from(table).delete().in('id', toDelete);
  }
}

export async function syncLocalToCloud(userId, { notes, documents, plannerTasks, gridMode, viewport }) {
  // Order matters: parents before children, due to the composite FKs
  // (notes.document_id -> documents, planner_tasks.note_id -> notes).
  await reconcileTable({
    table: 'documents',
    userId,
    rows: (documents || []).map(d => documentToRow(d, userId))
  });

  const flattenedNotes = [
    ...(notes || []).map(n => noteToRow(n, userId, null)),
    ...(documents || []).flatMap(doc => (doc.notes || []).map(n => noteToRow(n, userId, doc.id)))
  ];
  await reconcileTable({ table: 'notes', userId, rows: flattenedNotes });

  await reconcileTable({
    table: 'planner_tasks',
    userId,
    rows: (plannerTasks || []).map(t => taskToRow(t, userId))
  });

  await supabase.from('user_settings').upsert(settingsToRow(userId, gridMode, viewport));
}
