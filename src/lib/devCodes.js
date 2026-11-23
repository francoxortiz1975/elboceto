// Ticket codes for dev stacks. Format: <area letter><module letters><3 digits>, e.g. MC001 = MediLyft, Chat, feature 1.
// A modification adds .N to its feature: MC001.1, MC001.2 (always under the feature, never under another modification).
// The code is written on the stack's Desarrollo block (dev.code, dev.mod) and never changes.
import { uid } from './areaPlan';
import { isDev } from './devStacks';

// Areas that already have a code scheme (by area id). Other areas have no codes until they get one.
export const DEFAULT_CODES = {
  medilyft: {
    letter: 'M',
    modules: {
      P: 'Psicología', T: 'Teleconsulta', C: 'Chat WhatsApp', CB: 'Chat B2B', CC: 'Chat B2C', CE: 'Chat empresarial',
      D: 'Demos empresariales', A: 'Agenda y citas', E: 'Empresas / OIM', S: 'Seguridad y privacidad', M: 'Panel del médico', G: 'Gestión interna'
    }
  }
};
export const codeConfig = (plan, areaId) => (plan.devCodes && plan.devCodes[areaId]) || DEFAULT_CODES[areaId] || null;

const norm = (t = '') => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const codeOf = (it) => (it && it.dev && it.dev.code) || '';
const rootOf = (code) => String(code).split('.')[0];

// Finds a stack's Desarrollo block by id or by ticket code (MC001, mc001, MC001.1).
export function findByRef(plan, ref) {
  const r = String(ref || '').trim();
  return plan.items.find((i) => i.id === r) || plan.items.find((i) => isDev(i) && i.dev.r === 'build' && codeOf(i).toLowerCase() === r.toLowerCase()) || null;
}

export function nextFeatureCode(plan, areaId, mod) {
  const cfg = codeConfig(plan, areaId);
  if (!cfg || !cfg.modules[mod]) return '';
  const prefix = `${cfg.letter}${mod}`;
  const re = new RegExp(`^${prefix}(\\d{3})(?:\\.\\d+)?$`);
  const max = plan.items.reduce((m, i) => { const x = re.exec(codeOf(i)); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// Gives an uncoded stack the next code of a module. A coded stack keeps its code.
export function assignCode(plan, stackId, mod) {
  const it = plan.items.find((i) => i.id === stackId);
  if (!it || !isDev(it) || it.dev.r !== 'build') return { plan, error: 'No es un stack.' };
  if (codeOf(it)) return { plan, error: `Ya tiene el código ${codeOf(it)} (los códigos no cambian).` };
  const code = nextFeatureCode(plan, it.area, mod);
  if (!code) return { plan, error: 'Ese módulo no existe en esta área.' };
  return { plan: { ...plan, items: plan.items.map((i) => (i.id === stackId ? { ...i, dev: { ...i.dev, mod, code } } : i)) }, code, error: '' };
}

// A modification of a feature: a new stack with the code <feature>.<n>.
export function addModification(plan, parentRef, name, { day = 'later' } = {}) {
  const parent = findByRef(plan, parentRef);
  const text = String(name || '').trim();
  if (!parent || !codeOf(parent)) return { plan, error: 'La feature necesita tener código para tener modificaciones.' };
  if (!text) return { plan, error: 'La modificación necesita un nombre.' };
  const root = rootOf(codeOf(parent));
  const n = plan.items.reduce((m, i) => { const x = new RegExp(`^${root}\\.(\\d+)$`).exec(codeOf(i)); return x ? Math.max(m, Number(x[1])) : m; }, 0) + 1;
  const id = uid();
  const item = { id, area: parent.area, text, done: false, day, at: 'any', src: 'desarrollo', dev: { s: id, r: 'build', mod: parent.dev.mod, code: `${root}.${n}`, parent: root, created: new Date().toISOString() } };
  return { plan: { ...plan, items: [...plan.items, item] }, id, code: item.dev.code, error: '' };
}

// First guess of the module from the title (the user confirms before codes are assigned).
const RULES = [
  ['D', /demo/], ['P', /psicolog|fundacion amor/], ['M', /medico|despertar|kpi|satisfaccion/], ['T', /video|teleconsulta|everhealth/],
  ['A', /agendamiento|agendar|cita\b|citas\b|antelacion/], ['S', /privacidad|consentimiento|seguridad|eliminar|\bpdf|documento-url/],
  ['E', /\boim\b|empresa|prestasalud|reporting|portal/], ['G', /factura|reunion|backlog|prueba iris|grokbot/],
  ['C', /bot\b|chat|whatsapp|plantilla|flujo|triaje|mensaje|router|datos|respuestas|contactos|telegram/]
];
export function suggestModule(text, areaId, plan) {
  const cfg = plan ? codeConfig(plan, areaId) : DEFAULT_CODES[areaId];
  if (!cfg) return '';
  const t = norm(text);
  const hit = RULES.find(([, re]) => re.test(t));
  return hit && cfg.modules[hit[0]] ? hit[0] : '';
}

// Codes for every uncoded stack of the area that has a suggestion, in day order (then creation order).
export function bulkAssign(plan, areaId) {
  const todo = plan.items.map((i, idx) => ({ i, idx })).filter(({ i }) => i.area === areaId && isDev(i) && i.dev.r === 'build' && !codeOf(i) && suggestModule(i.text, areaId, plan))
    .sort((a, b) => (/^\d{4}/.test(a.i.day) ? a.i.day : '9999').localeCompare(/^\d{4}/.test(b.i.day) ? b.i.day : '9999') || a.idx - b.idx);
  let next = plan; let n = 0;
  todo.forEach(({ i }) => { const out = assignCode(next, i.id, suggestModule(i.text, areaId, plan)); if (!out.error) { next = out.plan; n += 1; } });
  return { plan: next, n, left: plan.items.filter((i) => i.area === areaId && isDev(i) && i.dev.r === 'build' && !codeOf(i)).length - n };
}
