import { addDays, fromIso, isoOf, uid } from './areaPlan';

// Events from before every block had an area: dated "Planificador" tasks and
// canvas notes that were given a date. They are listed so each one can be given
// an area (becoming a normal block) or discarded. Nothing is converted silently.

const WEEKDAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Old tasks that only knew a weekday ("every Monday") get their next occurrence.
export function nextDateForWeekday(dow, today) {
  const diff = (dow - fromIso(today).getDay() + 7) % 7;
  return addDays(today, diff);
}

// Upcoming (today onwards) events that still have no area.
export function collectLegacyEvents({ plannerTasks = [], notes = [], today = isoOf(new Date()) }) {
  const out = [];
  const noteIdsOfTasks = new Set(plannerTasks.filter((t) => t.noteId).map((t) => t.noteId));

  plannerTasks.forEach((t) => {
    if (!t.dayIso && !t.timeSlot) return; // a loose task from "Pendientes", not an event
    let day = t.dayIso;
    let repeats = false;
    if (!day) {
      const dow = WEEKDAY[t.dayKey];
      if (dow === undefined) return;
      day = nextDateForWeekday(dow, today);
      repeats = true;
    }
    if (day < today) return;
    out.push({
      key: `task:${t.id}`, kind: 'task', id: t.id, noteId: t.noteId, text: t.text || '',
      day, at: t.timeSlot && t.timeSlot !== 'all_day' ? toMinutes(t.timeSlot) : null,
      dur: t.durationMin || 60, done: !!t.completed, repeats, weekday: t.dayKey
    });
  });

  notes.forEach((n) => {
    if (!n.eventDate || n.eventDate < today) return;
    if (noteIdsOfTasks.has(n.id)) return; // already covered by its planner task
    out.push({
      key: `note:${n.id}`, kind: 'note', id: n.id,
      text: (n.blocks && n.blocks[0] && n.blocks[0].text) || 'Evento',
      day: n.eventDate, at: n.eventTime ? toMinutes(n.eventTime) : null,
      dur: n.eventDurationMin || 60, done: false
    });
  });

  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.at === null ? -1 : a.at) - (b.at === null ? -1 : b.at));
}

// The normal block that replaces a legacy event.
export const legacyToItem = (ev, areaId) => ({
  id: uid(), area: areaId, text: ev.text, done: ev.done, day: ev.day,
  ...(ev.at === null ? { at: 'any' } : { at: ev.at, dur: ev.dur })
});

// Which old records must be removed once these events are converted or discarded.
export function legacyRemovals(events) {
  const taskIds = new Set(events.filter((e) => e.kind === 'task').map((e) => e.id));
  const noteIds = new Set([
    ...events.filter((e) => e.kind === 'note').map((e) => e.id),
    ...events.filter((e) => e.kind === 'task' && e.noteId).map((e) => e.noteId)
  ]);
  return { taskIds, noteIds };
}
