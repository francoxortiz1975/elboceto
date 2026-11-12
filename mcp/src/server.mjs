#!/usr/bin/env node
// El Boceto MCP server: lets any Claude conversation read and edit the planner.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, readPlan, mutatePlan } from './cloud.mjs';
import { addDays, isoOf, fmtMin, durOf, placeAreaItem, uid, BANDS } from '../../src/lib/areaPlan';
import { validateContentPlan, importContentPlan } from '../../src/lib/contentPlan';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const BAND_LABEL = Object.fromEntries(BANDS.map((b) => [b.id, b.label.toLowerCase()]));
const today = () => isoOf(new Date());
const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });
// Wraps a handler so a thrown error comes back as a tool error instead of killing the call.
const safe = (fn) => async (args) => {
  try { return await fn(args || {}); } catch (e) { return fail(e.message || String(e)); }
};

const areaOf = (plan, ref) => {
  const r = String(ref || '').trim().toLowerCase();
  return plan.areas.find((a) => a.id.toLowerCase() === r || a.name.trim().toLowerCase() === r);
};
const noArea = (plan, ref) => `No existe el área "${ref}". Áreas: ${plan.areas.map((a) => a.name).join(', ')}.`;

const resolveDay = (d) => {
  if (!d) return null;
  if (d === 'today') return today();
  if (d === 'tomorrow') return addDays(today(), 1);
  if (d === 'later') return 'later';
  if (ISO.test(d)) return d;
  throw new Error(`Día no válido: "${d}". Usa AAAA-MM-DD, "today", "tomorrow" o "later".`);
};
const parseTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`Hora no válida: "${t}". Usa HH:MM.`);
  return +m[1] * 60 + +m[2];
};
// time / band -> the plan's `at` (minutes, a band id, or 'any')
const atFrom = ({ time, band }) => (time ? parseTime(time) : band ? band : 'any');

const when = (it) => {
  if (it.day === 'later') return 'más adelante';
  if (typeof it.at === 'number') return `${it.day} ${fmtMin(it.at)}–${fmtMin(it.at + durOf(it))}`;
  return `${it.day} ${BAND_LABEL[it.at] || 'cuando sea'}`;
};
const lineOf = (plan, it) => {
  const a = plan.areas.find((x) => x.id === it.area);
  return `${it.done ? '[x]' : '[ ]'} ${it.text} · ${a ? a.name : '?'} · ${when(it)} · id ${it.id}${it.note ? `\n      nota: ${it.note.split('\n')[0].slice(0, 120)}` : ''}`;
};
const sortKey = (it) => `${it.day}${typeof it.at === 'number' ? String(it.at).padStart(5, '0') : '99999'}`;
const list = (plan, items, empty) => (items.length ? [...items].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1)).map((it) => lineOf(plan, it)).join('\n') : empty);
const dated = (it) => ISO.test(it.day);

const cfg = loadConfig();
const server = new McpServer({ name: 'el-boceto', version: '0.1.0' });

server.registerTool('get_today', {
  description: 'Hoy en El Boceto: los bloques de hoy y lo atrasado (días pasados sin hacer). Empieza por aquí para saber cómo va el día.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  const t = today();
  const now = plan.items.filter((it) => it.day === t);
  const late = plan.items.filter((it) => dated(it) && it.day < t && !it.done);
  return text(`Hoy es ${t}.\n\nHOY (${now.length})\n${list(plan, now, '(nada)')}\n\nATRASADO (${late.length})\n${list(plan, late, '(nada)')}`);
}));

server.registerTool('get_range', {
  description: 'Bloques entre dos fechas (inclusive). Úsalo para ver una semana o un mes antes de proponer horarios.',
  inputSchema: { from: z.string().describe('AAAA-MM-DD'), to: z.string().describe('AAAA-MM-DD'), area: z.string().optional().describe('Nombre del área, para filtrar') }
}, safe(async ({ from, to, area }) => {
  if (!ISO.test(from) || !ISO.test(to)) throw new Error('from y to deben ser AAAA-MM-DD.');
  const { plan } = await readPlan(cfg);
  const a = area ? areaOf(plan, area) : null;
  if (area && !a) throw new Error(noArea(plan, area));
  const items = plan.items.filter((it) => dated(it) && it.day >= from && it.day <= to && (!a || it.area === a.id));
  return text(`${from} → ${to}${a ? ` · ${a.name}` : ''}\n${list(plan, items, '(nada en ese rango)')}`);
}));

server.registerTool('get_overdue', {
  description: 'Tareas de días pasados que no se marcaron como hechas.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  const late = plan.items.filter((it) => dated(it) && it.day < today() && !it.done);
  return text(`ATRASADO (${late.length})\n${list(plan, late, '(nada atrasado)')}`);
}));

server.registerTool('list_backlog', {
  description: 'La lista "Más adelante": tareas sin día todavía.',
  inputSchema: { area: z.string().optional() }
}, safe(async ({ area }) => {
  const { plan } = await readPlan(cfg);
  const a = area ? areaOf(plan, area) : null;
  if (area && !a) throw new Error(noArea(plan, area));
  const items = plan.items.filter((it) => it.day === 'later' && !it.done && (!a || it.area === a.id));
  return text(`MÁS ADELANTE (${items.length})\n${items.map((it) => lineOf(plan, it)).join('\n') || '(vacío)'}`);
}));

server.registerTool('list_areas', {
  description: 'Las áreas (columnas) del plan, con cuántas tareas abiertas tiene cada una.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  return text(plan.areas.map((a) => `${a.name} · ${plan.items.filter((i) => i.area === a.id && !i.done).length} abiertas`).join('\n'));
}));

const timing = {
  day: z.string().optional().describe('AAAA-MM-DD, "today", "tomorrow" o "later" (más adelante, sin día)'),
  time: z.string().optional().describe('Hora de inicio HH:MM (24 h). Hace un bloque con hora exacta.'),
  band: z.enum(['am', 'pm', 'ev']).optional().describe('Franja si no hay hora exacta: am mañana, pm tarde, ev noche'),
  duration_minutes: z.number().int().min(15).max(960).optional().describe('Duración, solo con hora exacta (por defecto 60)')
};

server.registerTool('add_item', {
  description: 'Añade una tarea o bloque al plan. Si no das día, va a "Más adelante". Dile al usuario lo que añadiste y cuándo.',
  inputSchema: {
    text: z.string().min(1).describe('Título corto de la tarea'),
    area: z.string().describe('Nombre del área (ver list_areas)'),
    ...timing,
    note: z.string().optional(),
    source: z.string().optional().describe('De qué conversación o proyecto viene, p. ej. "chat Loginet"')
  }
}, safe(async (a) => {
  const day = resolveDay(a.day) || 'later';
  const at = day === 'later' ? 'any' : atFrom(a);
  const out = await mutatePlan(cfg, (plan) => {
    const area = areaOf(plan, a.area);
    if (!area) throw new Error(noArea(plan, a.area));
    const item = {
      id: uid(), area: area.id, text: a.text.trim(), done: false, day, at,
      ...(typeof at === 'number' ? { dur: a.duration_minutes || 60 } : {}),
      ...(a.note ? { note: a.note } : {}), ...(a.source ? { src: a.source } : {})
    };
    return { plan: { ...plan, items: [...plan.items, item] }, result: lineOf(plan, item) };
  });
  return text(`Añadido:\n${out}`);
}));

server.registerTool('move_item', {
  description: 'Cambia el día / hora / franja (y opcionalmente el área) de una tarea. Para pasarla a "Más adelante" usa day "later".',
  inputSchema: { id: z.string(), ...timing, area: z.string().optional() }
}, safe(async (a) => {
  const day = resolveDay(a.day);
  if (!day) throw new Error('Falta day.');
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === a.id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${a.id}.`);
    const area = a.area ? areaOf(plan, a.area) : null;
    if (a.area && !area) throw new Error(noArea(plan, a.area));
    let next = placeAreaItem(plan, a.id, { day, at: day === 'later' ? 'any' : atFrom(a), area: area && area.id });
    if (typeof atFrom(a) === 'number' && a.duration_minutes && day !== 'later') {
      next = { ...next, items: next.items.map((i) => (i.id === a.id ? { ...i, dur: a.duration_minutes } : i)) };
    }
    return { plan: next, result: lineOf(next, next.items.find((i) => i.id === a.id)) };
  });
  return text(`Movido:\n${out}`);
}));

server.registerTool('complete_item', {
  description: 'Marca una tarea como hecha (o deshecha con done=false).',
  inputSchema: { id: z.string(), done: z.boolean().optional() }
}, safe(async ({ id, done = true }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    const next = { ...plan, items: plan.items.map((i) => (i.id === id ? { ...i, done } : i)) };
    return { plan: next, result: lineOf(next, { ...it, done }) };
  });
  return text(`Actualizado:\n${out}`);
}));

server.registerTool('edit_item', {
  description: 'Cambia el título o la nota de una tarea.',
  inputSchema: { id: z.string(), text: z.string().optional(), note: z.string().optional() }
}, safe(async ({ id, text: title, note }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    const upd = { ...it, ...(title ? { text: title.trim() } : {}), ...(note !== undefined ? { note } : {}) };
    return { plan: { ...plan, items: plan.items.map((i) => (i.id === id ? upd : i)) }, result: lineOf(plan, upd) };
  });
  return text(`Actualizado:\n${out}`);
}));

server.registerTool('delete_item', {
  description: 'Borra una tarea del plan. Solo si el usuario lo ha pedido; si dudas, márcala como hecha o muévela.',
  inputSchema: { id: z.string() }
}, safe(async ({ id }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    return { plan: { ...plan, items: plan.items.filter((i) => i.id !== id) }, result: lineOf(plan, it) };
  });
  return text(`Borrado:\n${out}`);
}));

server.registerTool('import_content_plan', {
  description: 'Importa o actualiza un plan de contenido (formato "boceto-content-plan": Reels, Stories, Posts con fechas). Es idempotente: lo ya existente y las ediciones del usuario se respetan.',
  inputSchema: { plan: z.record(z.any()).describe('El JSON del plan de contenido') }
}, safe(async ({ plan: content }) => {
  const error = validateContentPlan(content);
  if (error) throw new Error(error);
  const out = await mutatePlan(cfg, (plan) => {
    const r = importContentPlan(plan, content);
    return { plan: r.plan, result: `${r.added} bloques nuevos, ${r.moved} movidos, ${r.total} en el archivo (área ${content.area}).` };
  });
  return text(`Plan de contenido importado: ${out}`);
}));

await server.connect(new StdioServerTransport());
