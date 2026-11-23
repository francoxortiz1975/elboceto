#!/usr/bin/env node
// El Boceto MCP server: lets any Claude conversation read and edit the planner.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, readPlan, mutatePlan } from './cloud.mjs';
import { addDays, isoOf, fmtMin, durOf, placeAreaItem, uid, BANDS } from '../../src/lib/areaPlan';
import { validateContentPlan, importContentPlan } from '../../src/lib/contentPlan';
import { buildEngineInput, nowMinutes, getScheduler, kindDur, areaWindow, windowLabel } from '../../src/lib/scheduler/config';
import { runEngine, fmtMin as hhmm, WEIGHTS } from '../../src/lib/scheduler/engine';
import { overdueItems, resolveItem, whyPlaced } from '../../src/lib/scheduler/overdue';
import { daysBetween } from '../../src/lib/areaPlan';
import { ticketStatus } from '../../src/lib/devStacks';
import { devStacks, isDev, DEV_ROLES, addDevSlot, addDevStack, editDevItem, moveDevStack, setDevTime, setDevLaunch, setDevBatch } from '../../src/lib/devStacks';
import { findByRef, assignCode, addModification, codeOf, codeConfig, nextFeatureCode } from '../../src/lib/devCodes';
import { loadAreas } from './irisAreas.mjs';
import { addNotes, notesOf, unreadFor, markRead, noteLine, areaSummary, whenText, NOTE_KINDS } from '../../src/lib/iris';

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
  return `${it.done ? '[x]' : '[ ]'}${it.dev && it.dev.code ? ` [${it.dev.code}]` : ''}${it.lock ? ' [candado]' : ''}${it.iris && it.iris.launch ? ` [abre sola: ${({ pending: 'pendiente', launched: 'abierta', missed: 'perdida', skipped: 'omitida' })[it.iris.state] || it.iris.state}]` : ''}${it.kind === 'meeting' ? ' [reunión]' : ''} ${it.text} · ${a ? a.name : '?'} · ${when(it)} · id ${it.id}${it.note ? `\n      nota: ${it.note.split('\n')[0].slice(0, 120)}` : ''}`;
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

server.registerTool('list_dev_stacks', {
  description: 'La pestaña Desarrollo de El Boceto: los stacks de desarrollo (una feature por fila con Plan, Desarrollo y Verificación, cada pieza con sus comentarios). Úsala para saber qué se está construyendo en un área (por defecto MediLyft), en qué día va cada cosa y cuál está hecha o sale sola con IRIS+.',
  inputSchema: { area: z.string().optional().describe('Nombre del área; por defecto MediLyft') }
}, safe(async ({ area }) => {
  const { plan } = await readPlan(cfg);
  const a = area ? areaOf(plan, area) : (plan.areas.find((x) => /medilyft/i.test(x.name)) || null);
  if (!a) throw new Error(noArea(plan, area || 'MediLyft'));
  // Open tasks that the app has not turned into stacks yet (the Desarrollo tab does it when it is opened) are listed apart.
  const stacks = devStacks(plan, a.id);
  const loose = plan.items.filter((i) => i.area === a.id && !i.done && !isDev(i) && !i.stackId && !i.reel && !i.film && !i.gen);
  const piece = (label, it) => (it ? `   ${label}: ${it.done ? (it.dev && it.dev.v ? '[x validado]' : '[x por validar]') : '[ ]'} ${it.text} · id ${it.id}${it.iris && it.iris.launch ? ` [abre sola: ${it.iris.state || 'pendiente'}]` : ''}${it.note ? `\n      ${it.note.split('\n').join('\n      ').slice(0, 600)}` : ''}` : '');
  const block = stacks.map((st) => [`• ${codeOf(st.main) ? `${codeOf(st.main)} · ` : ''}${st.main.text} · ${when(st.main)} · ESTADO: ${ticketStatus(plan, st).label}`, ...DEV_ROLES.map((r) => piece(r.label, r.role === 'build' ? st.main : st[r.role]))].filter(Boolean).join('\n'));
  return text(`DESARROLLO · ${a.name} (${stacks.length} stacks)\n${block.join('\n\n') || '(vacío)'}${loose.length ? `\n\nTAREAS ABIERTAS QUE AÚN NO SON STACKS (${loose.length}; se convierten al abrir la pestaña Desarrollo)\n${loose.map((it) => lineOf(plan, it)).join('\n')}` : ''}`);
}));

server.registerTool('add_dev_piece', {
  description: 'Pestaña Desarrollo: añade el Plan o la Verificación a una feature (stack) que ya existe. stack_id es el id de la pieza de Desarrollo (el que muestra list_dev_stacks, o el de una tarea abierta que aún no es stack: entonces se convierte en stack). La pieza queda el mismo día que la feature. Si ya existe esa pieza, avisa y no la duplica.',
  inputSchema: {
    stack_id: z.string(),
    role: z.enum(['plan', 'check']).describe('plan = qué se va a hacer y cómo; check = pruebas, revisión, despliegue'),
    text: z.string().optional().describe('Título; por defecto "Plan: <feature>" o "Verificación: <feature>"'),
    note: z.string().optional().describe('Comentarios: decisiones, enlaces, criterio de terminado')
  }
}, safe(async ({ stack_id, role, text: title, note }) => {
  const out = await mutatePlan(cfg, (plan) => {
    let it = findByRef(plan, stack_id);
    if (!it) throw new Error(`No hay ninguna tarea con id o código ${stack_id}.`);
    let p = plan;
    if (isDev(it)) it = plan.items.find((i) => i.id === it.dev.s) || it; // a piece id points to its stack
    if (!isDev(it)) p = editDevItem(p, it.id, { dev: { s: it.id, r: 'build' } }); // an open task becomes a stack first
    const made = addDevSlot(p, it.id, role);
    if (!made.id) throw new Error(`Esa feature ya tiene su pieza de ${role === 'plan' ? 'Plan' : 'Verificación'}.`);
    const next = editDevItem(made.plan, made.id, { ...(title ? { text: title.trim() } : {}), ...(note ? { note } : {}) });
    return { plan: next, result: lineOf(next, next.items.find((i) => i.id === made.id)) };
  });
  return text(`Añadido a la feature:\n${out}`);
}));

server.registerTool('set_dev_stack', {
  description: 'Pestaña Desarrollo: cambia el día, la hora y/o el tick "Lanzar solo" de una feature (stack). stack_id es el id de su pieza de Desarrollo (list_dev_stacks). El día se aplica a todas las piezas del stack. launch=true hace que la conversación del área empiece sola a esa hora con el encargo (la feature, sus comentarios, Plan y Verificación); necesita día y hora exactos. Varios stacks seguidos de noche (21:00-07:00) van en un solo lote. time="none" quita la hora (y el lanzamiento). No uses esto para pasar un encargo nuevo con fecha: para eso assign_order.',
  inputSchema: {
    stack_id: z.string(),
    day: z.string().optional().describe('AAAA-MM-DD, "today", "tomorrow" o "later"'),
    time: z.string().optional().describe('HH:MM (24 h) o "none" para quitar la hora'),
    launch: z.boolean().optional().describe('true = empieza sola a su hora; false = no')
  }
}, safe(async ({ stack_id, day, time, launch }) => {
  const out = await mutatePlan(cfg, (plan) => {
    let it = findByRef(plan, stack_id);
    if (!it) throw new Error(`No hay ninguna tarea con id o código ${stack_id}.`);
    let p = plan;
    if (isDev(it)) it = plan.items.find((i) => i.id === it.dev.s) || it;
    if (!isDev(it)) { p = editDevItem(p, it.id, { dev: { s: it.id, r: 'build' } }); } // an open task becomes a stack first
    if (day) {
      const d = day === 'today' ? isoOf(new Date()) : day === 'tomorrow' ? addDays(isoOf(new Date()), 1) : day;
      if (d !== 'later' && !ISO.test(d)) throw new Error('El día debe ser AAAA-MM-DD, "today", "tomorrow" o "later".');
      p = moveDevStack(p, it.id, d);
    }
    if (time !== undefined) {
      if (time === 'none') p = setDevLaunch(setDevTime(p, it.id, null), it.id, false);
      else {
        const m = /^(\d{1,2}):(\d{2})$/.exec(time);
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error('La hora debe ser HH:MM (24 h) o "none".');
        p = setDevTime(p, it.id, Number(m[1]) * 60 + Number(m[2]));
      }
    }
    if (launch !== undefined) {
      const cur = p.items.find((i) => i.id === it.id);
      if (launch && (typeof cur.at !== 'number' || !ISO.test(cur.day || ''))) throw new Error('Para que empiece sola el stack necesita un día y una hora exactos (day y time).');
      p = setDevLaunch(p, it.id, launch);
    }
    const final = p.items.find((i) => i.id === it.id);
    return { plan: p, result: lineOf(p, final) };
  });
  return text(`Stack actualizado:\n${out}`);
}));

server.registerTool('batch_dev_stacks', {
  description: 'Pestaña Desarrollo: lanza VARIAS features (2 a 5, del mismo área) en UN solo lote: la conversación del área se abre una sola vez a la hora dada y las hace una tras otra, en el orden que des. Así se paga un solo arranque en frío en vez de uno por feature (ahorra tokens). Cada feature queda en el calendario a continuación de la anterior. stack_ids son los ids de la pieza de Desarrollo (list_dev_stacks).',
  inputSchema: {
    stack_ids: z.array(z.string()).min(2).max(5).describe('En el orden en que se harán'),
    day: z.string().describe('AAAA-MM-DD, "today" o "tomorrow"'),
    time: z.string().describe('HH:MM (24 h): cuándo empieza la primera')
  }
}, safe(async ({ stack_ids, day, time }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const d = day === 'today' ? isoOf(new Date()) : day === 'tomorrow' ? addDays(isoOf(new Date()), 1) : day;
    const m = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error('La hora debe ser HH:MM (24 h).');
    let p = plan;
    // open tasks that are not stacks yet become stacks first
    const refs = stack_ids.map((ref) => { const it = findByRef(p, ref); if (!it) throw new Error(`No hay ninguna tarea con id o código ${ref}.`); if (!isDev(it)) p = editDevItem(p, it.id, { dev: { s: it.id, r: 'build' } }); return it.id; });
    const made = setDevBatch(p, refs.map((id) => (p.items.find((i) => i.id === id).dev.s)), { day: d, time: Number(m[1]) * 60 + Number(m[2]) });
    if (made.error) throw new Error(made.error);
    return { plan: made.plan, result: refs.map((id) => lineOf(made.plan, made.plan.items.find((i) => i.id === id))).join('\n') };
  });
  return text(`Lote creado (se abre una sola vez y las hace en este orden):\n${out}`);
}));

server.registerTool('add_dev_modification', {
  description: 'Pestaña Desarrollo: crea una MODIFICACIÓN de una feature con ticket (código MC001 → MC001.1, MC001.2…). parent es el código (o id) de la feature. La modificación queda como un stack nuevo, sin hora; para ponerle día, hora o lanzarla usa set_dev_stack.',
  inputSchema: { parent: z.string(), name: z.string(), day: z.string().optional().describe('AAAA-MM-DD, "today", "tomorrow" o "later"') }
}, safe(async ({ parent, name, day }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const d = day === 'today' ? isoOf(new Date()) : day === 'tomorrow' ? addDays(isoOf(new Date()), 1) : (day || 'later');
    const made = addModification(plan, parent, name, { day: d });
    if (made.error) throw new Error(made.error);
    return { plan: made.plan, result: lineOf(made.plan, made.plan.items.find((i) => i.id === made.id)) };
  });
  return text(`Modificación creada:\n${out}`);
}));

server.registerTool('assign_dev_code', {
  description: 'Pestaña Desarrollo: da código de ticket a un stack que no lo tiene (p. ej. MC001). stack es el id o el código del stack; module son las letras del módulo (MediLyft: P psicología, T teleconsulta, C chat WhatsApp, CB chat B2B, CC chat B2C, CE chat empresarial, D demos empresariales, A agenda y citas, E empresas/OIM, S seguridad y privacidad, M panel del médico, G gestión interna). Un código ya asignado no cambia.',
  inputSchema: { stack: z.string(), module: z.string() }
}, safe(async ({ stack, module }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = findByRef(plan, stack);
    if (!it) throw new Error(`No hay ninguna tarea con id o código ${stack}.`);
    const made = assignCode(plan, it.id, String(module).toUpperCase());
    if (made.error) throw new Error(made.error);
    return { plan: made.plan, result: lineOf(made.plan, made.plan.items.find((i) => i.id === it.id)) };
  });
  return text(`Ticket asignado:\n${out}`);
}));

server.registerTool('add_dev_stack', {
  description: 'Pestaña Desarrollo: crea una feature nueva (stack) con su pieza de Desarrollo, sin hora. Para que además empiece sola a una hora, usa assign_order. Luego puedes añadirle Plan y Verificación con add_dev_piece.',
  inputSchema: { name: z.string(), area: z.string().optional().describe('Nombre del área; por defecto MediLyft'), module: z.string().optional().describe('Módulo del ticket (letras: P, T, C, CB, CC, CE, D, A, E, S, M, G en MediLyft). Le asigna el código, p. ej. MC001'), day: z.string().optional().describe('AAAA-MM-DD, "today", "tomorrow" o "later"'), note: z.string().optional() }
}, safe(async ({ name, area, module, day, note }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const a = area ? areaOf(plan, area) : plan.areas.find((x) => /medilyft/i.test(x.name));
    if (!a) throw new Error(noArea(plan, area || 'MediLyft'));
    const d = day === 'today' ? isoOf(new Date()) : day === 'tomorrow' ? addDays(isoOf(new Date()), 1) : (day || 'later');
    const made = addDevStack(plan, { area: a.id, name, day: d, note: note || '' });
    if (!made.id) throw new Error('La feature necesita un nombre.');
    let np = made.plan;
    if (module) { const c = assignCode(np, made.id, String(module).toUpperCase()); if (c.error) throw new Error(c.error); np = c.plan; }
    return { plan: np, result: lineOf(np, np.items.find((i) => i.id === made.id)) };
  });
  return text(`Feature creada:\n${out}`);
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
  duration_minutes: z.number().int().min(15).max(960).optional().describe('Duración, solo con hora exacta (por defecto: la que reserva su área para ese tipo, o 60)')
};

server.registerTool('add_item', {
  description: 'Añade una tarea o bloque al plan. Si no das día, va a "Más adelante". Dile al usuario lo que añadiste y cuándo.',
  inputSchema: {
    text: z.string().min(1).describe('Título corto de la tarea'),
    area: z.string().describe('Nombre del área (ver list_areas)'),
    ...timing,
    note: z.string().optional(),
    kind: z.enum(['task', 'meeting']).optional().describe('"meeting" para una reunión (reserva su duración de reunión: 60 min por defecto). Por defecto "task".'),
    source: z.string().optional().describe('De qué conversación o proyecto viene, p. ej. "chat Loginet"')
  }
}, safe(async (a) => {
  const day = resolveDay(a.day) || 'later';
  const at = day === 'later' ? 'any' : atFrom(a);
  const out = await mutatePlan(cfg, (plan) => {
    const area = areaOf(plan, a.area);
    if (!area) throw new Error(noArea(plan, a.area));
    // Without an explicit duration, a block gets what its area reserves for that kind (meeting 60 min; Loginet task 30 min…).
    const dur = a.duration_minutes || kindDur(getScheduler(plan), area.id, a.kind === 'meeting' ? 'meeting' : 'task') || 60;
    const item = {
      id: uid(), area: area.id, text: a.text.trim(), done: false, day, at,
      ...(a.kind === 'meeting' ? { kind: 'meeting' } : {}),
      ...(typeof at === 'number' ? { dur } : {}),
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
    if (it.lock) throw new Error(`“${it.text}” tiene candado: tiene que hacerse donde está. Si el usuario quiere moverla, quítale el candado primero con lock_item (locked=false).`);
    const area = a.area ? areaOf(plan, a.area) : null;
    if (a.area && !area) throw new Error(noArea(plan, a.area));
    let next = placeAreaItem(plan, a.id, { day, at: day === 'later' ? 'any' : atFrom(a), area: area && area.id });
    if (typeof atFrom(a) === 'number' && a.duration_minutes && day !== 'later') {
      next = { ...next, items: next.items.map((i) => (i.id === a.id ? { ...i, dur: a.duration_minutes } : i)) };
    }
    const moved = next.items.find((i) => i.id === a.id);
    // The area that owns the block is told, so its conversation is not surprised later.
    const told = addNotes(next, [{ area: moved.area, kind: 'change', from: 'hub', item: moved.id, text: `“${moved.text}” se movió de ${whenText(it.day, it.at)} a ${whenText(moved.day, moved.at)}.${area && area.id !== it.area ? ' Cambió de área.' : ''}` }]);
    return { plan: told, result: lineOf(told, moved) };
  });
  return text(`Movido:\n${out}`);
}));

server.registerTool('lock_item', {
  description: 'Pone o quita el candado de una tarea. Con candado la tarea tiene que hacerse exactamente en su día y hora: ni el usuario arrastrándola, ni el motor de reagendamiento, ni move_item la mueven. Solo tiene sentido con día fijo (no "Más adelante").',
  inputSchema: { id: z.string(), locked: z.boolean().optional().describe('true (por defecto) pone el candado, false lo quita') }
}, safe(async ({ id, locked = true }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    if (locked && !dated(it)) throw new Error('Solo se puede poner candado a algo con día fijo; esta está en "Más adelante".');
    const { lock: _l, ...rest } = it;
    const upd = locked ? { ...rest, lock: true } : rest;
    const next = addNotes({ ...plan, items: plan.items.map((i) => (i.id === id ? upd : i)) }, [{ area: it.area, kind: 'change', from: 'hub', item: id, text: locked ? `“${it.text}” (${whenText(it.day, it.at)}) ahora tiene candado: tiene que hacerse justo ahí.` : `“${it.text}” ya no tiene candado: se puede mover.` }]);
    return { plan: next, result: lineOf(next, upd) };
  });
  return text(`${locked ? 'Candado puesto' : 'Candado quitado'}:\n${out}`);
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
    const next = addNotes({ ...plan, items: plan.items.filter((i) => i.id !== id) }, [{ area: it.area, kind: 'change', from: 'hub', text: `“${it.text}” (${whenText(it.day, it.at)}) se borró del plan.` }]);
    return { plan: next, result: lineOf(plan, it) };
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

// ---- Scheduler: the same engine as the app's Motor tab ----
const propose = (plan) => {
  const t = today();
  const inp = buildEngineInput(plan, t);
  return { t, inp, res: runEngine(inp.cfg, inp.tasks, { today: t, nowMin: nowMinutes(), blocks: inp.blocks }) };
};
const span = (res, c, dur) => `${res.G.days[c.d]} ${hhmm(c.start)}–${hhmm(c.start + dur)}`;
const areaName = (plan, id) => (plan.areas.find((a) => a.id === id) || {}).name || '?';

server.registerTool('get_overdue_proposals', {
  description: 'Lo atrasado (días pasados sin hacer) con la propuesta del motor de planificación de El Boceto: nuevo hueco, motivo y alternativas. Úsalo antes de resolver con resolve_overdue.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  const { t, res } = propose(plan);
  const od = overdueItems(plan, t);
  if (!od.length) return text(`Hoy es ${t}. Nada atrasado.`);
  const lines = od.map((it) => {
    const pl = res.placed.find((p) => p.task.id === it.id);
    const nr = res.unplaced.find((p) => p.task.id === it.id);
    const head = `${it.text} · ${areaName(plan, it.area)} · era ${when(it)} (hace ${daysBetween(it.day, t)} d) · id ${it.id}`;
    if (pl) {
      const why = whyPlaced(pl.choice.parts);
      return `${head}\n   propuesta: ${span(res, pl.choice, pl.task.dur)}${why ? ` (por ${why})` : ''}\n   alternativas: ${pl.alts.map((a) => span(res, a, pl.task.dur)).join(' | ') || '(ninguna)'}`;
    }
    if (it.lock) return `${head}\n   CON CANDADO: no se mueve sola. Pregunta al usuario: quitar el candado (lock_item locked=false) y volver a proponer, later, done o skip.`;
    return `${head}\n   sin hueco: ${nr ? nr.reason : 'no entra en la propuesta'} Opciones: later, done o move a mano.`;
  });
  return text(`Hoy es ${t}. ATRASADO (${od.length})\n${lines.join('\n')}`);
}));

server.registerTool('resolve_overdue', {
  description: 'Resuelve una tarea atrasada: "accept" aplica la propuesta actual del motor, "move" la lleva a un día y hora concretos, "done" la marca hecha, "later" la pasa a Más adelante, "skip" la deja como está (queda registrado). Confirma con el usuario antes de mover cosas en bloque.',
  inputSchema: {
    id: z.string(),
    action: z.enum(['accept', 'move', 'done', 'later', 'skip']),
    day: z.string().optional().describe('Solo con move: AAAA-MM-DD'),
    time: z.string().optional().describe('Solo con move: HH:MM')
  }
}, safe(async ({ id, action, day, time }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    const t = today();
    if (it.lock && (action === 'accept' || action === 'move')) throw new Error(`“${it.text}” tiene candado: no se mueve. Si el usuario quiere moverla, quítalo primero con lock_item (locked=false).`);
    let opts;
    if (action === 'accept') {
      const { res } = propose(plan);
      const pl = res.placed.find((p) => p.task.id === id);
      if (!pl) throw new Error('El motor no tiene propuesta para esta tarea (no hay hueco, o no está atrasada). Usa move, later, done o skip.');
      opts = { action: 'move', via: 'accept', target: { day: res.G.days[pl.choice.d], at: pl.choice.start, dur: pl.task.dur } };
    } else if (action === 'move') {
      const d = resolveDay(day);
      if (!d || d === 'later') throw new Error('Con move hace falta day (AAAA-MM-DD).');
      const at = parseTime(time);
      opts = { action: 'move', via: 'manual', target: { day: d, at, dur: it.dur || 60 } };
    } else opts = { action };
    const r = resolveItem(plan, id, { ...opts, today: t, by: 'claude' });
    const moved = r.plan.items.find((i) => i.id === id);
    const told = action === 'accept' || action === 'move' || action === 'later'
      ? addNotes(r.plan, [{ area: it.area, kind: 'change', from: 'hub', item: id, text: `“${it.text}” (era ${whenText(it.day, it.at)}) ${action === 'later' ? 'pasó a Más adelante' : `se reagendó a ${whenText(moved.day, moved.at)}`}.` }])
      : r.plan;
    return { plan: told, result: lineOf(told, moved) };
  });
  return text(`Hecho (${action}):\n${out}`);
}));

// ---------------- IRIS: inbox between the planner and one conversation per area ----------------
const areaArg = z.string().describe('Nombre del área (ver list_areas)');

server.registerTool('leave_note', {
  description: 'IRIS: deja una nota en el buzón de un área para que su conversación la lea al empezar (un hook se la muestra sola). Úsala para avisar de un cambio, dar contexto o pasar un encargo sin fecha. Si el encargo tiene fecha y hora, usa assign_order.',
  inputSchema: { area: areaArg, text: z.string().min(1).describe('La nota, clara y autosuficiente (la conversación del área no ve este chat)'), kind: z.enum(NOTE_KINDS).optional().describe('note (por defecto), order, change o report') }
}, safe(async ({ area, text: body, kind }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const a = areaOf(plan, area);
    if (!a) throw new Error(noArea(plan, area));
    return { plan: addNotes(plan, [{ area: a.id, kind: kind || 'note', from: 'hub', text: body }]), result: `Nota dejada en ${a.name}.` };
  });
  return text(out);
}));

server.registerTool('assign_order', {
  description: 'IRIS: encarga un trabajo a un área. Crea el bloque en el calendario (con día y hora, respetando lo que ya hay) y deja el encargo completo en el buzón del área, con el id del bloque. Úsalo cuando el usuario pega un feature o una tarea para un área. Confirma con el usuario el día y la hora si no los dio.',
  inputSchema: {
    area: areaArg, text: z.string().min(1).describe('Título corto del bloque'),
    brief: z.string().min(1).describe('El encargo completo para la conversación del área: qué hay que hacer, contexto, criterios de terminado. Debe entenderse sin este chat.'),
    ...timing, kind: z.enum(['task', 'meeting']).optional(), lock: z.boolean().optional().describe('true si tiene que hacerse justo en ese bloque (entrega, reunión)'),
    autostart: z.boolean().optional().describe('Que la conversación del área se abra SOLA cuando empiece el bloque, con este encargo (IRIS+). POR DEFECTO ESTÁ ACTIVADO para una tarea con día y hora exactos, que aún no ha pasado, en un área con carpeta registrada en este ordenador: no hace falta pedirlo ni preguntarlo. Pon false solo si el usuario dice que NO quiere que se abra sola. true fuerza el intento (requiere día y hora exactos).')
  }
}, safe(async (a) => {
  const day = resolveDay(a.day) || 'later';
  const at = day === 'later' ? 'any' : atFrom(a);
  if (a.autostart && typeof at !== 'number') throw new Error('Para que se abra sola hacen falta día y hora exactos (time).');
  let warn = '';
  let auto = false;
  const out = await mutatePlan(cfg, (plan) => {
    const area = areaOf(plan, a.area);
    if (!area) throw new Error(noArea(plan, a.area));
    const dur = a.duration_minutes || kindDur(getScheduler(plan), area.id, a.kind === 'meeting' ? 'meeting' : 'task') || 60;
    const hasDir = Object.keys(loadAreas().areas).some((k) => k.trim().toLowerCase() === area.name.trim().toLowerCase());
    // Default: ON for a timed task that has not ended yet, in an area whose repo is registered here. A meeting is a person, not a coding session.
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
    const notOver = typeof at === 'number' && (day > today() || (day === today() && nowMin < at + dur));
    auto = a.autostart === true ? true : a.autostart === false ? false : (a.kind !== 'meeting' && notOver && hasDir);
    if (auto && !hasDir) warn = `\nOJO: el área ${area.name} no tiene carpeta registrada en este ordenador, así que NO se abrirá sola. Corre: npm run iris:install -- "${area.name}" /ruta/al/repo`;
    else if (!auto && a.autostart === undefined && a.kind !== 'meeting' && notOver && !hasDir) warn = `\n(El área ${area.name} no tiene carpeta registrada en este ordenador, así que no se abrirá sola. Para registrarla: npm run iris:install -- "${area.name}" /ruta/al/repo)`;
    const item = {
      id: uid(), area: area.id, text: a.text.trim(), done: false, day, at, src: 'iris',
      ...(auto ? { iris: { launch: true, state: 'pending' } } : {}),
      ...(a.kind === 'meeting' ? { kind: 'meeting' } : {}), ...(a.lock && day !== 'later' ? { lock: true } : {}),
      ...(typeof at === 'number' ? { dur } : {})
    };
    const next = addNotes({ ...plan, items: [...plan.items, item] }, [{ area: area.id, kind: 'order', from: 'hub', item: item.id, text: `${a.brief.trim()}\n(Bloque: ${a.text.trim()} · ${when(item)}${item.lock ? ' · con candado' : ''}.)` }]);
    return { plan: next, result: lineOf(next, item) };
  });
  return text(`Encargo creado y avisado al área${auto ? '; se abrirá sola cuando empiece el bloque' : ''}:\n${out}${warn}`);
}));

server.registerTool('autostart_item', {
  description: 'IRIS+: activa o desactiva que la conversación del área se abra SOLA cuando empiece este bloque (con el encargo que el centro dejó para él). El bloque necesita día y hora exactos. assign_order ya lo activa por defecto; úsalo para bloques que ya existían o para quitarlo (on=false) si el usuario no quiere que se abra sola.',
  inputSchema: { id: z.string(), on: z.boolean().optional().describe('true (por defecto) la activa; false la quita') }
}, safe(async ({ id, on = true }) => {
  let warn = '';
  const out = await mutatePlan(cfg, (plan) => {
    const it = plan.items.find((i) => i.id === id);
    if (!it) throw new Error(`No hay ninguna tarea con id ${id}.`);
    if (on && typeof it.at !== 'number') throw new Error('Para que se abra sola hacen falta día y hora exactos.');
    const area = plan.areas.find((a) => a.id === it.area);
    if (on && area && !Object.keys(loadAreas().areas).some((k) => k.trim().toLowerCase() === area.name.trim().toLowerCase())) warn = `\nOJO: el área ${area.name} no tiene carpeta registrada en este ordenador, así que no se abrirá sola. Corre: npm run iris:install -- "${area.name}" /ruta/al/repo`;
    const { iris: _i, ...rest } = it;
    const upd = on ? { ...rest, iris: { launch: true, state: 'pending' } } : rest;
    return { plan: { ...plan, items: plan.items.map((i) => (i.id === id ? upd : i)) }, result: `${lineOf(plan, upd)}${on ? `\n(se abrirá sola a las ${fmtMin(it.at)})` : ''}` };
  });
  return text(`${on ? 'Arranque automático activado' : 'Arranque automático quitado'}:\n${out}${warn}`);
}));

server.registerTool('read_notes', {
  description: 'IRIS: lee notas del buzón. Una conversación de área llama con su área y for="area" (lo normal: lo que el centro le dejó). El centro de mando llama con for="hub" para ver los avances que dejaron las áreas.',
  inputSchema: {
    area: z.string().optional().describe('Nombre del área; sin él, todas'),
    for: z.enum(['area', 'hub']).optional().describe('"area" (por defecto): notas dirigidas al área. "hub": avances que las áreas dejaron al centro.'),
    include_read: z.boolean().optional().describe('Incluir las ya leídas (por defecto solo las nuevas)'),
    mark_read: z.boolean().optional().describe('Marcarlas como leídas al devolverlas (por defecto true)'),
    limit: z.number().int().min(1).max(100).optional()
  }
}, safe(async ({ area, for: dest = 'area', include_read, mark_read = true, limit = 30 }) => {
  const dir = dest === 'hub' ? 'to_hub' : 'to_area';
  const out = await mutatePlan(cfg, (plan) => {
    const a = area ? areaOf(plan, area) : null;
    if (area && !a) throw new Error(noArea(plan, area));
    const pool = notesOf(plan).filter((n) => n.dir === dir && (!a || n.area === a.id) && (include_read || !n.read)).slice(-limit);
    const body = pool.length ? pool.map((n) => noteLine(plan, n)).join('\n') : '(sin notas nuevas)';
    const head = `${pool.length} nota${pool.length === 1 ? '' : 's'}${include_read ? '' : ' sin leer'}${a ? ` de ${a.name}` : ''}:`;
    const unread = pool.filter((n) => !n.read).map((n) => n.id);
    if (mark_read && unread.length) return { plan: markRead(plan, { ids: unread }).plan, result: `${head}\n${body}` };
    return { plan, result: `${head}\n${body}` };
  });
  return text(out);
}));

server.registerTool('mark_notes_read', {
  description: 'IRIS: marca notas como leídas, por ids o todas las de un área.',
  inputSchema: { ids: z.array(z.string()).optional(), area: z.string().optional(), for: z.enum(['area', 'hub']).optional() }
}, safe(async ({ ids, area, for: dest = 'area' }) => {
  if (!ids && !area) throw new Error('Dame ids o un área.');
  const out = await mutatePlan(cfg, (plan) => {
    const a = area ? areaOf(plan, area) : null;
    if (area && !a) throw new Error(noArea(plan, area));
    const r = markRead(plan, { ids, area: a && a.id, dir: dest === 'hub' ? 'to_hub' : 'to_area' });
    return { plan: r.plan, result: `${r.changed} nota${r.changed === 1 ? '' : 's'} marcada${r.changed === 1 ? '' : 's'} como leída${r.changed === 1 ? '' : 's'}.` };
  });
  return text(out);
}));

server.registerTool('report_progress', {
  description: 'IRIS: la conversación de un área avisa al centro de mando de un avance o de que terminó un encargo. Opcionalmente marca el bloque como hecho. Úsalo al terminar algo relevante (una rama lista, algo bloqueado, una duda). Escribe el texto con ESTE FORMATO (cada sección en su línea, viñetas cortas, sin párrafos largos; omite una sección solo si no aplica):\nRESUMEN: una línea\nHECHO:\n- qué quedó hecho\nVERIFICAR:\n1. pasos concretos para que el usuario lo compruebe\nDECISIONES:\n- SOLO lo que el usuario debe decidir, una por línea: ¿Pregunta? | A) opción | B) opción | C) opción | RECOMIENDO: B (lo que ya decidiste tú va en HECHO)\nPENDIENTE:\n- lo que no pudiste completar y por qué\nRAMA: nombre · COMMIT: hash\nSi dejas un documento .md para leer, escribe su ruta relativa tal cual (docs/x.md): el usuario podrá abrirlo y descargarlo desde la web.',
  inputSchema: { area: areaArg, text: z.string().min(1).describe('Qué pasó: qué se hizo, dónde está (rama, archivo) y qué falta'), item_id: z.string().optional().describe('Id del bloque del encargo, si lo hay'), done: z.boolean().optional().describe('true si el encargo quedó terminado: marca el bloque como hecho') }
}, safe(async ({ area, text: body, item_id, done }) => {
  const out = await mutatePlan(cfg, (plan) => {
    const a = areaOf(plan, area);
    if (!a) throw new Error(noArea(plan, area));
    let next = plan;
    if (item_id) {
      const it = plan.items.find((i) => i.id === item_id);
      if (!it) throw new Error(`No hay ningún bloque con id ${item_id}.`);
      if (done) next = { ...next, items: next.items.map((i) => (i.id === item_id ? { ...i, done: true } : i)) };
    }
    next = addNotes(next, [{ area: a.id, dir: 'to_hub', kind: 'report', from: 'area', item: item_id, text: body }]);
    return { plan: next, result: `Avance registrado para el centro de mando (${a.name})${item_id && done ? '; bloque marcado como hecho' : ''}.` };
  });
  return text(out);
}));

server.registerTool('areas_summary', {
  description: 'IRIS: una línea por área: abiertas, atrasadas, con candado, lo próximo, y cuántas notas sin leer hay (hacia el área y hacia el centro). Úsalo para "¿cómo voy?" y al empezar en el centro de mando.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  const t = today();
  const od = new Set(overdueItems(plan, t).map((i) => i.id));
  const rows = areaSummary(plan, t, od);
  const lines = rows.map((r) => `${r.name}: ${r.open} abiertas · ${r.overdue} atrasadas · ${r.locked} con candado · hoy ${r.todayCount} · notas sin leer: ${r.unreadToArea} para el área, ${r.unreadToHub} para el centro${r.next ? `\n   próximo: ${r.next}` : ''}`);
  return text(`HOY ${t}\n${lines.join('\n')}`);
}));

server.registerTool('get_scheduler_settings', {
  description: 'Los ajustes del motor de planificación: perfil (sueño, comidas, energía, topes), eventos fijos con sus semanas rotativas, pila de áreas y pesos. Solo lectura.',
  inputSchema: {}
}, safe(async () => {
  const { plan } = await readPlan(cfg);
  const { inp } = propose(plan);
  const c = inp.cfg; const P = c.profile; const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const fixed = c.fixed.map((f) => `${f.name}: ${f.days.map((d) => days[d]).join('')} ${f.from}–${f.to}${f.place ? ` @${f.place}` : ''}${(f.cycle || 1) > 1 ? ` · ciclo ${f.cycle} semanas, activo en ${f.weeks.map((w) => w + 1).join(',')} (semana 1 desde ${f.anchor})` : ''}${f.skip && f.skip.length ? ` · sin: ${f.skip.join(', ')}` : ''}`);
  return text([
    `Despierto ${P.wake}–${P.bed}. Trabajo flexible ${P.window.from}–${P.window.to}, días abiertos: ${P.open.map((o, i) => (o ? days[i] : '')).join('')}.`,
    `Comidas: ${P.meals.filter((m) => m.on).map((m) => `${m.name} ${m.start} (${m.dur} min)`).join(', ')}.`,
    `Energía (1–5): mañana ${P.energy.am}, tarde ${P.energy.pm}, noche ${P.energy.ev}. Máx. ${P.deepCap} h profundas/día; colchón ${P.buffer} min (${P.bufferFixed} tras algo fijo).`,
    `Traslados: ${P.places.map((p) => `${p.name} ${p.min} min`).join(', ')}.`,
    `Pila de áreas (de más a menos prioritaria): ${c.areaOrder.map((id) => areaName(plan, id)).join(' > ')}.`,
    `Eventos fijos (${fixed.length}):${fixed.length ? `\n${fixed.join('\n')}` : ' ninguno'}`,
    `Reglas por área:${plan.areas.map((ar) => { const r = c.areaRules[ar.id] || {}; const t = areaWindow(c, ar.id, 'task'); const m = areaWindow(c, ar.id, 'meeting'); return `\n  ${ar.name}: tareas ${t ? windowLabel(t) : 'cualquier hora'}${r.taskMin ? `, ${r.taskMin} min cada una` : ''}; reuniones ${m ? windowLabel(m) : 'cualquier hora'}, ${r.meetMin || 60} min`; }).join('')}`,
    `Pesos: ${WEIGHTS.map((w) => `${w.label} ${c.weights[w.id]}`).join('; ')}.`
  ].join('\n'));
}));

await server.connect(new StdioServerTransport());
