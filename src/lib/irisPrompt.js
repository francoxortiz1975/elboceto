// The text an area's conversation receives when IRIS+ opens it. One place builds it, so the web page can show it BEFORE it is sent
// (and let the user edit it) and the launcher sends exactly the same thing. Pure: no file or network access.
import { notesOf } from './iris';
import { devBrief, isDev } from './devStacks';

const code = (item) => (item.dev && item.dev.code) || '';
const tag = (item) => `${code(item) ? `[${code(item)}] ` : ''}"${item.text}"`;

// The task itself: for a correction or a push to main, the order saved when it was requested; otherwise the ticket as it is NOW
// (title, comments, plan and verification pieces), so changing a comment after scheduling is not lost.
export function briefFor(plan, item) {
  const orders = notesOf(plan).filter((n) => n.item === item.id && n.kind === 'order' && n.dir === 'to_area');
  const last = orders[orders.length - 1];
  if (item.deploy) return last ? last.text : `Subir "${item.text}" a main.`;
  if (last && /^CORRECCIÓN v\d+/.test(last.text)) return last.text;
  if (isDev(item) && item.dev.r === 'build') return devBrief(plan, item.id) || item.text;
  return last ? last.text : item.text;
}

const RULES = (areaName, items, deploy) => [
  deploy
    ? '- Esta ejecución SÍ puede hacer git merge y push a main, solo para lo que pide el encargo. Si hay conflictos o pruebas rotas, para y cuéntalo; nunca fuerces nada.'
    : '- Trabaja en una rama local (iris/<CÓDIGO>-nombre-corto) con commits locales. Sin push, sin deploy, sin publicar. Lo que no puedas hacer, déjalo en PENDIENTE.',
  `- Al terminar o si te bloqueas: report_progress(area="${areaName}", item_id=${items.length > 1 ? '<el id de cada uno>' : `"${items[0].id}"`}, text="…", done=true solo si quedó terminado).`,
  '- Ante una duda NO te detengas ni preguntes: elige la opción recomendada (la de menos fricción), impleméntala y sigue. Solo paras si no puedes decidirlo tú (accesos, datos que faltan, algo irreversible o que cuesta dinero) y entonces lo dejas en PENDIENTE.',
  '- Formato del texto: RESUMEN (una frase) / HECHO / VERIFICAR (pasos numerados) / DECISIONES (todas las que tomaste, sin límite ni resumir: una por línea, ¿Pregunta? | A) … | B) … | RECOMIENDO: B | ELEGIDA: B) / PENDIENTE / RAMA · COMMIT. Si dejas un .md para leer, escribe su ruta relativa.',
  '- Si no ves report_progress, búscala con ToolSearch: el servidor boceto tarda unos segundos en conectar.'
].join('\n');

// The default message. items: the lead block plus the ones that ride along in the same conversation (a batch).
export function defaultPrompt(plan, items, areaName) {
  const lead = items[0];
  const deploy = !!lead.deploy;
  const intro = `IRIS · ${areaName}. Encargo automático: nadie está escribiendo. Trabaja solo en esto. No consultes el calendario, el backlog ni los bloques de El Boceto, y no sigas la regla del CLAUDE.md de "al empezar una sesión".`;
  const body = items.length === 1
    ? `ENCARGO ${tag(lead)}\n${briefFor(plan, lead)}`
    : `Son ${items.length} encargos seguidos, hazlos EN ESTE ORDEN, uno tras otro en esta sesión:\n\n${items.map((it, i) => `${i + 1}. ENCARGO ${tag(it)} (item_id="${it.id}")\n${briefFor(plan, it)}`).join('\n\n')}`;
  return `${intro}\n\n${body}\n\nREGLAS\n${RULES(areaName, items, deploy)}`;
}

// What will really be sent: the user's edited text when there is one, else the default.
export const promptFor = (plan, items, areaName) => (items[0].iris && typeof items[0].iris.prompt === 'string' && items[0].iris.prompt.trim() ? items[0].iris.prompt : defaultPrompt(plan, items, areaName));
export const isEdited = (item) => !!(item.iris && typeof item.iris.prompt === 'string' && item.iris.prompt.trim());

// Saves the user's version of the message on the block (until it is launched). An empty text, or one equal to the default, restores the default.
export function setLaunchPrompt(plan, itemId, text, defaultText = '') {
  const clean = String(text || '').replace(/\r/g, '');
  const reset = !clean.trim() || clean.trim() === String(defaultText).trim();
  return { ...plan, items: plan.items.map((i) => {
    if (i.id !== itemId) return i;
    const { prompt, ...iris } = i.iris || {};
    return { ...i, iris: reset ? iris : { ...iris, prompt: clean } };
  }) };
}

// A rough size, to see what each message costs. Spanish text: about 4 characters per token.
export const approxTokens = (text) => Math.ceil(String(text).length / 4);
