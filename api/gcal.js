// Vercel function: pushes El Boceto's plan to one Google Calendar.
//
// It talks to Google as a *service account* (a robot account that has been
// given edit access to the calendar), so there is no OAuth consent screen and
// no token that expires. Only the owner may call it: the caller must be signed
// in to Supabase with the e-mail in GOOGLE_SYNC_USER_EMAIL.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_JSON  contents of the service account's JSON key
//   GOOGLE_CALENDAR_ID           the shared calendar's ID (…@group.calendar.google.com)
//   GOOGLE_SYNC_USER_EMAIL       the e-mail you sign in with
//   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY  (already set for the app)
//
// POST /api/gcal  { action: 'status' }
// POST /api/gcal  { action: 'sync', upserts: [{ key, gcalId?, event }], deletes: [{ key, gcalId }] }

import { createSign } from 'node:crypto';

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const MAX_OPS = 25;
const CONCURRENCY = 5;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let cachedToken = null;

function readServiceAccount() {
  let raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('{')) {
    try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch { return null; }
  }
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) return null;
    return { ...sa, private_key: String(sa.private_key).replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now && cachedToken.email === sa.client_email) return cachedToken.value;
  const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key).toString('base64url');
  } catch {
    throw new HttpError(500, 'bad_key', 'La clave de la cuenta de servicio no es válida. Revisa GOOGLE_SERVICE_ACCOUNT_JSON.');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${signature}`
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, 'google_auth', `Google rechazó la cuenta de servicio (${data.error_description || data.error || res.status}).`);
  }
  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600), email: sa.client_email };
  return cachedToken.value;
}

async function authenticate(req) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new HttpError(500, 'no_supabase', 'Faltan las variables de Supabase en el servidor.');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'no_session', 'Inicia sesión para sincronizar con Google Calendar.');
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(401, 'bad_session', 'Tu sesión venció. Vuelve a iniciar sesión.');
  const user = await res.json();
  const allowed = (process.env.GOOGLE_SYNC_USER_EMAIL || '').trim().toLowerCase();
  if (!allowed) throw new HttpError(500, 'not_configured', 'Falta la variable GOOGLE_SYNC_USER_EMAIL en Vercel.');
  if (String(user.email || '').toLowerCase() !== allowed) {
    throw new HttpError(403, 'not_allowed', 'Esta cuenta no tiene permiso para usar la sincronización.');
  }
  return user;
}

function googleConfig() {
  const missing = [];
  const sa = readServiceAccount();
  if (!sa) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON');
  const calendarId = (process.env.GOOGLE_CALENDAR_ID || '').trim();
  if (!calendarId) missing.push('GOOGLE_CALENDAR_ID');
  if (missing.length) {
    throw new HttpError(500, 'not_configured', `Falta configurar en Vercel: ${missing.join(', ')}.`);
  }
  return { sa, calendarId };
}

async function gcal(token, calendarId, method, path, { query, body } = {}) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(calendarId)}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { status: 204, ok: true, data: {} };
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function explain(r) {
  if (r.status === 404) return 'Google no encuentra el calendario. Revisa GOOGLE_CALENDAR_ID y que lo hayas compartido con la cuenta de servicio.';
  if (r.status === 403) return 'La cuenta de servicio no puede editar ese calendario. Compártelo con ella con el permiso "Hacer cambios en eventos" y comprueba que la Google Calendar API esté activada.';
  if (r.status === 401) return 'Google rechazó las credenciales de la cuenta de servicio.';
  if (r.status === 429) return 'Google pide ir más despacio (límite de uso). Se reintentará.';
  return (r.data && r.data.error && r.data.error.message) || `Google respondió ${r.status}.`;
}

// PATCH merges nested objects, so an event that used to be all-day (start.date) and is now timed (start.dateTime)
// would end up with both fields and Google answers "Invalid start time" (and the other way round). Explicit nulls
// clear the field that no longer applies.
function patchBody(body) {
  const timed = !!(body.start && body.start.dateTime);
  const swap = (t) => (timed ? { ...t, date: null } : { ...t, dateTime: null, timeZone: null });
  return { ...body, start: swap(body.start), end: swap(body.end) };
}

async function upsertEvent(token, calendarId, { key, gcalId, event }) {
  const body = {
    ...event,
    extendedProperties: { private: { bocetoId: String(key) } },
    reminders: { useDefault: true }
  };

  if (gcalId) {
    const r = await gcal(token, calendarId, 'PATCH', `/events/${encodeURIComponent(gcalId)}`, { query: { sendUpdates: 'none' }, body: patchBody(body) });
    if (r.ok && r.data.status !== 'cancelled') return { key, gcalId: r.data.id, updated: r.data.updated };
    if (![404, 410].includes(r.status) && !(r.ok && r.data.status === 'cancelled')) throw new HttpError(502, 'google', explain(r));
  }

  // Make the operation idempotent: another device may have created it already.
  const found = await gcal(token, calendarId, 'GET', '/events', {
    query: { privateExtendedProperty: `bocetoId=${key}`, showDeleted: 'false', maxResults: '1' }
  });
  if (!found.ok) throw new HttpError(502, 'google', explain(found));
  const existing = (found.data.items || [])[0];
  if (existing) {
    const r = await gcal(token, calendarId, 'PATCH', `/events/${encodeURIComponent(existing.id)}`, { query: { sendUpdates: 'none' }, body: patchBody(body) });
    if (!r.ok) throw new HttpError(502, 'google', explain(r));
    return { key, gcalId: r.data.id, updated: r.data.updated };
  }

  const r = await gcal(token, calendarId, 'POST', '/events', { query: { sendUpdates: 'none' }, body });
  if (!r.ok) throw new HttpError(502, 'google', explain(r));
  return { key, gcalId: r.data.id, updated: r.data.updated };
}

async function removeEvent(token, calendarId, { key, gcalId }) {
  const r = await gcal(token, calendarId, 'DELETE', `/events/${encodeURIComponent(gcalId)}`, { query: { sendUpdates: 'none' } });
  if (r.ok || r.status === 404 || r.status === 410) return { key, gcalId };
  throw new HttpError(502, 'google', explain(r));
}

// Runs `worker` over `items` with a small concurrency cap; one failure never stops the rest.
async function pool(items, worker) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { ok: true, value: await worker(items[i]) };
      } catch (e) {
        out[i] = { ok: false, error: e.message || 'Error desconocido', key: items[i].key };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => res.status(status).json(payload);
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'Usa POST.');
    await authenticate(req);
    const { sa, calendarId } = googleConfig();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const token = await googleToken(sa);

    if (body.action === 'status') {
      const r = await gcal(token, calendarId, 'GET', '/events', { query: { maxResults: '1', showDeleted: 'false' } });
      if (!r.ok) throw new HttpError(502, 'google', explain(r));
      return send(200, { ok: true, calendar: r.data.summary || 'Calendario' });
    }

    if (body.action === 'sync') {
      const upserts = Array.isArray(body.upserts) ? body.upserts : [];
      const deletes = Array.isArray(body.deletes) ? body.deletes : [];
      if (upserts.length + deletes.length > MAX_OPS) {
        throw new HttpError(413, 'too_many', `Máximo ${MAX_OPS} cambios por petición.`);
      }
      const upserted = await pool(upserts, (op) => upsertEvent(token, calendarId, op));
      const removed = await pool(deletes.filter((d) => d.gcalId), (op) => removeEvent(token, calendarId, op));
      return send(200, {
        ok: true,
        results: upserted.filter((r) => r.ok).map((r) => r.value),
        deleted: removed.filter((r) => r.ok).map((r) => r.value.key),
        errors: [...upserted, ...removed].filter((r) => !r.ok).map((r) => ({ key: r.key, message: r.error }))
      });
    }

    throw new HttpError(400, 'bad_action', 'Acción desconocida.');
  } catch (e) {
    if (e instanceof HttpError) return send(e.status, { ok: false, code: e.code, message: e.message });
    return send(500, { ok: false, code: 'server', message: 'Error inesperado en el servidor.' });
  }
}
