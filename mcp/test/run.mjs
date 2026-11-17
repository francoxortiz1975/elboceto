// End-to-end check: the built server talks to a fake Supabase (the two RPCs, in memory) over stdio.
import http from 'node:http';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const today = new Date(); const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yday = new Date(today.getTime() - 864e5);
let db = {
  stamp: '2026-01-01T00:00:00.000001+00:00', n: 1,
  plan: {
    areas: [{ id: 'life', name: 'Life', c: 0 }, { id: 'loginet', name: 'Loginet', c: 5 }],
    items: [
      { id: 'a1', area: 'life', text: 'Pagar luz', done: false, day: iso(yday), at: 'any' },
      { id: 'a2', area: 'loginet', text: 'Reunión', done: false, day: iso(today), at: 600, dur: 30 },
      { id: 'a3', area: 'life', text: 'Cambiar número', done: false, day: 'later', at: 'any' }
    ]
  }
};
let conflictOnce = false;
const srv = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (j.p_token !== 'secret') return send(400, { message: 'invalid token' });
    if (req.url.endsWith('mcp_plan_get')) return send(200, [{ plan: db.plan, updated_at: db.stamp }]);
    if (req.url.endsWith('mcp_plan_set')) {
      if (conflictOnce) { conflictOnce = false; db.n++; db.stamp = `2026-01-01T00:00:0${db.n}.000001+00:00`; return send(400, { message: 'conflict' }); }
      if (j.p_expected !== db.stamp) return send(400, { message: 'conflict' });
      db.plan = j.p_plan; db.n++; db.stamp = `2026-01-01T00:00:0${db.n}.000001+00:00`; return send(200, db.stamp);
    }
    send(404, {});
  });
});
await new Promise((r) => srv.listen(0, r));
const url = `http://127.0.0.1:${srv.address().port}`;

const client = new Client({ name: 'test', version: '1' });
await client.connect(new StdioClientTransport({
  command: 'node', args: ['dist/server.mjs'],
  env: { ...process.env, BOCETO_SUPABASE_URL: url, BOCETO_SUPABASE_KEY: 'anon', BOCETO_TOKEN: 'secret', HOME: '/nonexistent' }
}));
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return (r.isError ? 'ERROR: ' : '') + r.content[0].text; };
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
let t = await call('get_today'); ok(t.includes('Reunión') && t.includes('Pagar luz'), 'get_today shows today and overdue');
t = await call('list_backlog'); ok(t.includes('Cambiar número'), 'list_backlog');
t = await call('add_item', { text: 'Preparar demo', area: 'loginet', day: 'tomorrow', time: '15:30', duration_minutes: 90, source: 'chat test' });
ok(t.includes('15:30–17:00'), 'add_item with time'); ok(db.plan.items.at(-1).src === 'chat test', 'source saved');
const newId = db.plan.items.at(-1).id;
t = await call('add_item', { text: 'Sin área', area: 'nope' }); ok(t.startsWith('ERROR') && t.includes('Life'), 'unknown area lists areas');
t = await call('add_item', { text: 'Idea', area: 'LIFE' }); ok(db.plan.items.at(-1).day === 'later', 'no day -> backlog, area case-insensitive');
conflictOnce = true;
t = await call('complete_item', { id: 'a1' }); ok(!t.startsWith('ERROR') && db.plan.items.find((i) => i.id === 'a1').done, 'conflict is retried');
t = await call('move_item', { id: newId, day: 'today', band: 'pm' }); ok(t.includes('tarde') && !('dur' in db.plan.items.find((i) => i.id === newId)), 'move_item to band drops duration');
t = await call('edit_item', { id: 'a2', note: 'sala 3' }); ok(db.plan.items.find((i) => i.id === 'a2').note === 'sala 3', 'edit_item');
t = await call('delete_item', { id: 'a3' }); ok(!db.plan.items.some((i) => i.id === 'a3'), 'delete_item');
const content = JSON.parse(fs.readFileSync(new URL('../../docs/sumay-instagram.plan.json', import.meta.url)));
t = await call('import_content_plan', { plan: content }); ok(/39 bloques nuevos/.test(t) && db.plan.stacks['sumay-instagram-stories'], 'import_content_plan');
t = await call('get_range', { from: iso(today), to: '2030-01-01', area: 'Sumay' }); ok(t.includes('Reel ·'), 'get_range by area');
t = await call('get_overdue'); ok(t.includes('ATRASADO (0)'), 'overdue empty after completing');
// ---- scheduler tools ----
db.plan.items.push({ id: 'od1', area: 'loginet', text: 'Factura atrasada', done: false, day: iso(yday), at: 'any' });
db.plan.items.push({ id: 'od2', area: 'life', text: 'Llamar al banco', done: false, day: iso(new Date(today.getTime() - 3 * 864e5)), at: 600, dur: 30 });
db.plan.items.push({ id: 'od3', area: 'life', text: 'Revisar correo', done: false, day: iso(yday), at: 'any' });
db.plan.items.push({ id: 'od4', area: 'life', text: 'Idea vieja', done: false, day: iso(yday), at: 'any' });
t = await call('get_overdue_proposals'); ok(t.includes('Factura atrasada') && t.includes('propuesta:') && t.includes('alternativas:'), 'get_overdue_proposals lists proposal + alternatives');
t = await call('get_scheduler_settings'); ok(t.includes('Pila de áreas') && t.includes('Pesos:'), 'get_scheduler_settings');
t = await call('resolve_overdue', { id: 'od1', action: 'accept' });
let od1 = db.plan.items.find((i) => i.id === 'od1'); ok(!t.startsWith('ERROR') && od1.day >= iso(today) && typeof od1.at === 'number', 'resolve accept moves to a future slot');
ok(db.plan.scheduler.history.at(-1).kind === 'accept' && db.plan.scheduler.history.at(-1).by === 'claude', 'history records accept by claude');
t = await call('resolve_overdue', { id: 'od2', action: 'move', day: 'tomorrow', time: '16:00' });
let od2 = db.plan.items.find((i) => i.id === 'od2'); ok(od2.at === 960 && od2.dur === 30, 'resolve move to a given day/time keeps duration');
t = await call('resolve_overdue', { id: 'od3', action: 'done' }); ok(db.plan.items.find((i) => i.id === 'od3').done === true, 'resolve done');
t = await call('resolve_overdue', { id: 'od4', action: 'later' }); ok(db.plan.items.find((i) => i.id === 'od4').day === 'later', 'resolve later');
t = await call('resolve_overdue', { id: 'od4', action: 'move' }); ok(t.startsWith('ERROR'), 'move without day is an error');
t = await call('resolve_overdue', { id: 'nope', action: 'done' }); ok(t.startsWith('ERROR'), 'unknown id is an error');
t = await call('get_overdue_proposals'); ok(!t.includes('Factura atrasada'), 'resolved items leave the overdue list');
// ---- locks ----
t = await call('lock_item', { id: 'a2' }); ok(!t.startsWith('ERROR') && db.plan.items.find((i) => i.id === 'a2').lock === true && t.includes('[candado]'), 'lock_item sets the lock');
t = await call('move_item', { id: 'a2', day: 'tomorrow', time: '11:00' }); const a2 = db.plan.items.find((i) => i.id === 'a2');
ok(t.startsWith('ERROR') && t.includes('candado') && a2.day === iso(today) && a2.at === 600, 'move_item refuses a locked item and leaves it untouched');
t = await call('lock_item', { id: 'od3', locked: true }); db.plan.items.find((i) => i.id === 'od3').done = false;
db.plan.items.push({ id: 'lk1', area: 'loginet', text: 'Demo con candado', done: false, day: iso(yday), at: 600, dur: 60, lock: true });
t = await call('get_overdue_proposals'); ok(t.includes('Demo con candado') && t.includes('CON CANDADO') && !/Demo con candado[^\n]*\n\s+propuesta/.test(t), 'overdue locked item gets no proposal');
t = await call('resolve_overdue', { id: 'lk1', action: 'accept' }); ok(t.startsWith('ERROR') && t.includes('candado'), 'resolve accept refuses a locked item');
t = await call('resolve_overdue', { id: 'lk1', action: 'move', day: 'tomorrow', time: '10:00' }); ok(t.startsWith('ERROR'), 'resolve move refuses a locked item');
t = await call('resolve_overdue', { id: 'lk1', action: 'done' }); ok(!t.startsWith('ERROR'), 'a locked item can still be marked done');
t = await call('lock_item', { id: 'a2', locked: false }); ok(!('lock' in db.plan.items.find((i) => i.id === 'a2')), 'lock_item locked=false removes the key');
t = await call('lock_item', { id: 'od4' }); ok(t.startsWith('ERROR'), 'cannot lock something in Más adelante');
t = await call('move_item', { id: 'a2', day: 'tomorrow', time: '11:00' }); ok(!t.startsWith('ERROR'), 'unlocked item moves again');
// ---- area rules: windows, default durations, meetings ----
db.plan.scheduler = { ...(db.plan.scheduler || {}), areaRules: { loginet: { from: '21:00', to: '21:30', taskMin: 30, meetFrom: '21:00', meetTo: '22:00', meetMin: 60 } } };
t = await call('add_item', { text: 'Tarea loginet', area: 'loginet', day: 'tomorrow', time: '21:00' }); ok(t.includes('21:00–21:30'), 'add_item takes the area task length (Loginet 30 min)');
t = await call('add_item', { text: 'Reunión loginet', area: 'loginet', day: 'tomorrow', time: '21:00', kind: 'meeting' }); ok(t.includes('21:00–22:00') && t.includes('[reunión]') && db.plan.items.at(-1).kind === 'meeting', 'meeting reserves 60 min');
t = await call('add_item', { text: 'Con duración', area: 'loginet', day: 'tomorrow', time: '18:00', duration_minutes: 45 }); ok(t.includes('18:00–18:45'), 'explicit duration wins');
t = await call('get_scheduler_settings'); ok(/Loginet: tareas 21:00–21:30, 30 min cada una; reuniones 21:00–22:00, 60 min/.test(t) && /Life: tareas cualquier hora/.test(t), 'get_scheduler_settings lists area rules');
// ---- IRIS: inbox between the hub and one conversation per area ----
const hook = (mode, area = 'Loginet') => new Promise((resolve) => execFile('node', ['dist/iris-hook.mjs', mode], { env: { ...process.env, IRIS_AREA: area, BOCETO_SUPABASE_URL: url, BOCETO_SUPABASE_KEY: 'anon', BOCETO_TOKEN: 'secret', HOME: '/nonexistent' }, timeout: 15000 }, (err, stdout) => resolve({ code: err ? err.code : 0, out: stdout })));
const notes = () => (db.plan.iris && db.plan.iris.notes) || [];
db.plan.iris = { notes: [] }; // start the IRIS checks with an empty inbox (earlier tests already moved things and left notes)
t = await call('assign_order', { area: 'Loginet', text: 'Entregar informe', brief: 'Preparar el informe mensual con las cifras de octubre y dejarlo en /docs.', day: 'tomorrow', time: '21:00', duration_minutes: 30, lock: true });
const ord = db.plan.items.find((i) => i.text === 'Entregar informe');
ok(!t.startsWith('ERROR') && ord && ord.lock === true && ord.src === 'iris', 'assign_order creates a locked block');
ok(notes().some((n) => n.kind === 'order' && n.dir === 'to_area' && n.item === ord.id && /informe mensual/.test(n.text) && !n.read), 'assign_order leaves the full brief in the area inbox, linked to the block');
t = await call('areas_summary'); ok(/Loginet: \d+ abiertas/.test(t) && /1 para el área/.test(t), 'areas_summary shows unread notes per area');
const h1 = await hook('session');
ok(h1.code === 0 && /\[IRIS · Loginet\] 1 nota nueva/.test(h1.out) && /informe mensual/.test(h1.out) && /Protocolo IRIS/.test(h1.out) && /report_progress/.test(h1.out), 'hook (session start) prints the note and the protocol by itself');
ok(notes().filter((n) => n.area === 'loginet' && n.dir === 'to_area').every((n) => n.read), 'the hook marks what it showed as read');
const h2 = await hook('prompt'); ok(h2.code === 0 && h2.out.trim() === '', 'hook (each prompt) is silent when there is nothing new');
t = await call('leave_note', { area: 'Loginet', text: 'El cliente cambió la fecha: ahora es el viernes.', kind: 'change' });
const h3 = await hook('prompt'); ok(/cliente cambió la fecha/.test(h3.out) && !/Protocolo/.test(h3.out), 'hook (prompt) shows only the new note, without repeating the protocol');
const h4 = await hook('prompt'); ok(h4.out.trim() === '', 'and does not show it twice');
const hx = await hook('session', 'Inventada'); ok(/no existe en El Boceto/.test(hx.out) && hx.code === 0, 'unknown area: a clear line, never a failure');
t = await call('leave_note', { area: 'Life', text: 'Nota para Life' }); t = await call('read_notes', { area: 'Loginet' }); ok(/sin notas nuevas/.test(t) && !/Life/.test(t), 'read_notes is per area');
t = await call('read_notes', { area: 'Life' }); ok(/Nota para Life/.test(t), 'read_notes returns the area notes');
t = await call('read_notes', { area: 'Life' }); ok(/sin notas nuevas/.test(t), 'and marks them read');
t = await call('report_progress', { area: 'Loginet', text: 'Informe listo en /docs/informe-octubre.md; falta que lo revises.', item_id: ord.id, done: true });
ok(!t.startsWith('ERROR') && db.plan.items.find((i) => i.id === ord.id).done === true, 'report_progress with done marks the block as done');
t = await call('read_notes', { for: 'hub' }); ok(/Informe listo/.test(t) && /avance/.test(t), 'the hub reads the report the area left');
t = await call('areas_summary'); ok(/0 para el área, 0 para el centro/.test(t.split('\n').find((l) => l.startsWith('Loginet')) || ''), 'summary counts are back to zero after reading');
t = await call('report_progress', { area: 'Loginet', text: 'x', item_id: 'nope' }); ok(t.startsWith('ERROR'), 'report_progress with an unknown block is an error');
db.plan.items.push({ id: 'mv1', area: 'life', text: 'Cosa movible', done: false, day: iso(today), at: 'any' });
t = await call('move_item', { id: 'mv1', day: 'tomorrow', band: 'pm' });
ok(notes().some((n) => n.item === 'mv1' && n.kind === 'change' && n.area === 'life' && /se movió de/.test(n.text)), 'move_item tells the area what changed');
t = await call('lock_item', { id: 'mv1' }); ok(notes().some((n) => n.item === 'mv1' && /candado/.test(n.text)), 'lock_item tells the area');
t = await call('delete_item', { id: 'mv1' }); ok(notes().some((n) => /se borró del plan/.test(n.text)), 'delete_item tells the area');
await client.close(); srv.close();
