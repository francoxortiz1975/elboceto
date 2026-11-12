// Reads and writes the plan through the two functions of supabase/mcp_access.sql, using a personal
// token. The settings come from env vars or from ~/.config/boceto-mcp/config.json.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'boceto-mcp', 'config.json'), 'utf8'));
  } catch { /* no file: env vars only */ }
  const cfg = {
    url: process.env.BOCETO_SUPABASE_URL || file.url,
    key: process.env.BOCETO_SUPABASE_KEY || file.key,
    token: process.env.BOCETO_TOKEN || file.token
  };
  if (!cfg.url || !cfg.key || !cfg.token) {
    throw new Error('Falta la configuración de El Boceto: ~/.config/boceto-mcp/config.json con url, key y token.');
  }
  return cfg;
}

async function rpc(cfg, name, body) {
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || text || res.statusText;
    const err = new Error(msg);
    err.conflict = /conflict/i.test(msg);
    throw err;
  }
  return data;
}

export async function readPlan(cfg) {
  const rows = await rpc(cfg, 'mcp_plan_get', { p_token: cfg.token });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.plan) throw new Error('No hay plan en la nube para este token (¿token revocado, o el plan aún no se ha guardado desde la app?).');
  return { plan: row.plan, stamp: row.updated_at };
}

export async function writePlan(cfg, plan, expected) {
  return rpc(cfg, 'mcp_plan_set', { p_token: cfg.token, p_plan: plan, p_expected: expected });
}

// Read -> change -> write, retrying once if the app saved in between.
export async function mutatePlan(cfg, fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { plan, stamp } = await readPlan(cfg);
    const { plan: next, result } = fn(plan);
    if (next === plan) return result;
    try {
      await writePlan(cfg, next, stamp);
      return result;
    } catch (e) {
      if (!e.conflict || attempt === 2) throw e;
    }
  }
  return null;
}
