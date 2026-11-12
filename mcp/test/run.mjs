// End-to-end check: the built server talks to a fake Supabase (the two RPCs, in memory) over stdio.
import http from 'node:http';
import fs from 'node:fs';
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
await client.close(); srv.close();
