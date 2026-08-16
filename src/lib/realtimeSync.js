import { supabase } from './supabaseClient';
import { rowToNote, rowToDocumentMeta, rowToTask } from './dataMapping';

function forward(table, userId, mapRow, onChange) {
  return supabase
    .channel(`realtime-${table}-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onChange({ eventType: 'DELETE', id: payload.old.id, documentId: payload.old.document_id });
        } else {
          onChange({ eventType: payload.eventType, item: mapRow(payload.new), documentId: payload.new.document_id });
        }
      }
    )
    .subscribe();
}

export function subscribeToCloudChanges(userId, { onNoteChange, onDocumentChange, onTaskChange }) {
  const channels = [
    forward('notes', userId, rowToNote, onNoteChange),
    forward('documents', userId, rowToDocumentMeta, onDocumentChange),
    forward('planner_tasks', userId, rowToTask, onTaskChange)
  ];

  return () => {
    channels.forEach(ch => supabase.removeChannel(ch));
  };
}
