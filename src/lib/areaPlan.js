// Data + date logic for the "Plan por áreas" view.
//
// An item lives at (day, at):
//   day: 'YYYY-MM-DD' or 'later'
//   at:  minutes since midnight (a time block: today and tomorrow have the
//        detailed grid), 'am' | 'pm' | 'ev' (the day after tomorrow's bands)
//        or 'any' (no specific time)
// Dates are stored absolutely and "Hoy / Mañana" are resolved at render time,
// so the board rotates by itself at midnight.

export const AREA_COLORS = ['#6E8B5B', '#4F6FA8', '#9A6B2F', '#8A5A9E', '#2F8A86', '#A8546A', '#6B6B6B'];
export const SLOT_STEP = 30; // one grid row
export const SNAP = 15; // finest block precision (minutes)
export const DAY_FROM = 7 * 60;
export const DAY_TO = 24 * 60;
export const BANDS = [
  { id: 'am', label: 'Mañana', note: '08–13' },
  { id: 'pm', label: 'Tarde', note: '13–19' },
  { id: 'ev', label: 'Noche', note: '19–24' }
];

const STORAGE_KEY = 'el_boceto_area_plan_v1';
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const uid = () => 'ap_' + Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');

export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
export const dayLabel = (iso) => {
  const d = fromIso(iso);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};
export const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
// Block length in minutes. Legacy items stored `d` in 30-min units.
export const durOf = (it) => it.dur || (it.d ? it.d * SLOT_STEP : 60);
export const rowStart = (min) => Math.floor(min / SLOT_STEP) * SLOT_STEP;
export const durLabel = (m) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h${r ? pad(r) : ''}` : `${r} min`;
};

export const SLOTS = (() => {
  const out = [];
  for (let m = DAY_FROM; m < DAY_TO; m += SLOT_STEP) out.push(m);
  return out;
})();

// Where an item is actually drawn, given what "today" is. Overdue items
// surface in today's "Cuando sea" instead of silently disappearing.
export function effectiveSlot(item, today) {
  const { day, at } = item;
  if (day === 'later' || day > addDays(today, 6)) return { day: 'later', at: 'any' };
  if (day < today) return { day: today, at: 'any' };
  // Today and tomorrow have the detailed grid. A band item that rolls into
  // tomorrow has no exact time, so it lands in that day's "Cuando sea".
  if (day === today || day === addDays(today, 1)) return { day, at: typeof at === 'number' ? at : 'any' };
  if (day === addDays(today, 2)) return { day, at: BANDS.some((b) => b.id === at) ? at : 'am' };
  return { day, at: 'any' };
}

// Side-by-side lanes for time blocks that overlap within one column and day.
// entries: [{ it, eff }]; returns { [itemId]: { lane, n } }.
export function computeLanes(entries) {
  const blocks = entries
    .filter((e) => typeof e.eff.at === 'number')
    .map((e) => ({ id: e.it.id, day: e.eff.day, a: e.eff.at, b: e.eff.at + durOf(e.it) }))
    .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : x.a - y.a || y.b - x.b));

  const result = {};
  let day = null;
  let cluster = [];
  let ends = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((id) => { result[id].n = ends.length; });
    cluster = [];
    ends = [];
  };
  blocks.forEach((blk) => {
    if (blk.day !== day) { flush(); clusterEnd = -1; day = blk.day; }
    if (blk.a >= clusterEnd) { flush(); clusterEnd = -1; }
    let lane = ends.findIndex((end) => end <= blk.a);
    if (lane < 0) { lane = ends.length; ends.push(blk.b); } else ends[lane] = blk.b;
    result[blk.id] = { lane, n: 1 };
    cluster.push(blk.id);
    clusterEnd = Math.max(clusterEnd, blk.b);
  });
  flush();
  return result;
}

export function defaultAreaPlan(today = isoOf(new Date())) {
  const tomorrow = addDays(today, 1);
  const T = (area, text) => ({ id: uid(), area, text, done: false, day: today, at: 'any' });
  const M = (area, text, at) => ({ id: uid(), area, text, done: false, day: tomorrow, at });
  const L = (area, text) => ({ id: uid(), area, text, done: false, day: 'later', at: 'any' });
  return {
    view: 'areas',
    hidden: [],
    areas: [
      { id: 'life', name: 'Life', c: 0 },
      { id: 'school', name: 'School', c: 1 },
      { id: 'work', name: 'Work', c: 2 },
      { id: 'medilyft', name: 'MediLyft', c: 4 },
      { id: 'campus', name: 'Campus France', c: 3 },
      { id: 'loginet', name: 'Loginet', c: 5 }
    ],
    items: [
      T('life', 'Go search desk!'),
      T('life', 'Film first video'),
      T('school', 'TP ML pt.1'),
      T('work', 'Send applications'),
      T('medilyft', 'Talk about psicología + Google AI Studio'),
      T('medilyft', 'Send factura'),
      T('loginet', 'Send factura + datos'),
      T('loginet', 'Start deciding'),
      M('school', 'TP M2 pt.2', 'am'),
      M('school', 'TP M3 pt.3', 'pm'),
      L('life', 'Cambiar número'),
      L('life', 'Cambiar dirección EFF'),
      L('school', 'Derecho pt.1'),
      L('school', 'Derecho pt.2'),
      L('school', 'Derecho pt.3'),
      L('school', 'English press review'),
      L('school', 'POO'),
      L('school', 'Systèmes distribués'),
      L('school', 'Firmar stage professionnel'),
      L('medilyft', 'Seguimiento systems'),
      L('medilyft', 'Add AI model'),
      L('medilyft', 'Cambiar a botón las plantillas'),
      L('medilyft', 'Add consentimiento flow en el chatbot (psicología)')
    ]
  };
}

export function loadAreaPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.areas) && Array.isArray(saved.items)) {
      return { view: 'areas', hidden: [], ...saved };
    }
  } catch (e) {
    console.error('Error loading area plan:', e);
  }
  return defaultAreaPlan();
}

export function saveAreaPlan(plan) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch (e) {
    console.error('Error saving area plan:', e);
  }
}

// True when the plan is still the starter example, with nothing edited. Used so
// a device that never synced can't upload its untouched example over real data.
const planSignature = (plan) => JSON.stringify({
  areas: plan.areas.map((a) => [a.name, a.c]),
  items: plan.items
    .map((i) => [i.area, i.text, i.day === 'later' ? 'later' : 'dated', typeof i.at === 'number' ? 'n' : i.at, !!i.done])
    .sort()
});
export const isUntouchedPlan = (plan) => planSignature(plan) === planSignature(defaultAreaPlan());
