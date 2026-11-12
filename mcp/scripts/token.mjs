// Makes a personal token for the El Boceto MCP server.
//  - saves it (with the project url and public key from ../.env) in ~/.config/boceto-mcp/config.json
//  - prints the SQL to paste in the Supabase SQL editor: it contains only the token's hash.
// Usage: node mcp/scripts/token.mjs you@example.com [--force]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const email = process.argv[2];
if (!email || !email.includes('@')) { console.error('Uso: node mcp/scripts/token.mjs tu-correo@ejemplo.com [--force]'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const url = env.VITE_SUPABASE_URL; const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error('No encuentro VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en .env'); process.exit(1); }

const dir = path.join(os.homedir(), '.config', 'boceto-mcp');
const file = path.join(dir, 'config.json');
if (fs.existsSync(file) && !process.argv.includes('--force')) { console.error(`Ya hay un token en ${file}. Usa --force para crear otro (el anterior seguirá activo hasta que lo revoques).`); process.exit(1); }
const token = crypto.randomBytes(32).toString('hex');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.writeFileSync(file, JSON.stringify({ url, key, token }, null, 2), { mode: 0o600 });
const hash = crypto.createHash('sha256').update(token).digest('hex');
console.log(`Token guardado en ${file} (no se muestra aquí).\n\nPega esto en el SQL editor de Supabase (proyecto de El Boceto) y ejecútalo:\n`);
console.log(`insert into public.mcp_tokens (token_hash, user_id, label)\nselect '${hash}', id, 'claude-code' from auth.users where email = '${email.replace(/'/g, "''")}';`);
