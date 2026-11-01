import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { applyResults, chunkOps, planSyncOps } from './gcalSync';

// Keeps one Google Calendar ("El Boceto") in step with the plan, one way: app -> Google.
// The switch lives in the plan itself (`plan.gcal.on`), so every device you are
// signed in on keeps syncing, not just the one where you turned it on.

const DEBOUNCE_MS = 3000;

async function callApi(body) {
  if (!supabase) throw new Error('Falta configurar Supabase en este entorno.');
  const { data } = await supabase.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) throw new Error('Inicia sesión para sincronizar con Google Calendar.');
  const res = await fetch('/api/gcal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  if (!json) throw new Error('El servicio de Google Calendar solo está disponible en la app publicada.');
  if (!res.ok || json.ok === false) throw new Error(json.message || 'No se pudo sincronizar con Google Calendar.');
  return json;
}

export function useGcalSync(user, plan, setPlan) {
  const [state, setState] = useState({ phase: 'idle', message: '', lastSync: null });
  const planRef = useRef(plan);
  const busy = useRef(false);
  const timer = useRef(null);
  planRef.current = plan;
  const on = !!(plan.gcal && plan.gcal.on);
  const count = Object.keys((plan.gcal && plan.gcal.map) || {}).length;

  const runSync = useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, phase: 'syncing', message: '' }));
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const ops = planSyncOps(planRef.current, tz);
      const hashes = Object.fromEntries(ops.upserts.map((u) => [u.key, u.hash]));
      const failures = [];
      for (const batch of chunkOps(ops)) {
        const data = await callApi({ action: 'sync', ...batch });
        setPlan((p) => applyResults(p, { results: data.results, deleted: data.deleted, hashes }));
        failures.push(...(data.errors || []));
      }
      setState({
        phase: failures.length ? 'error' : 'ok',
        message: failures.length ? `${failures.length} evento(s) no se pudieron sincronizar: ${failures[0].message}` : '',
        lastSync: new Date()
      });
    } catch (e) {
      setState((s) => ({ ...s, phase: 'error', message: e.message }));
    } finally {
      busy.current = false;
    }
  }, [user, setPlan]);

  // Whenever the plan's items change while sync is on, catch Google up shortly after.
  useEffect(() => {
    if (!on || !user) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(runSync, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [on, user, plan.items, plan.areas, runSync]);

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'syncing', message: 'Comprobando la conexión con Google…' }));
    try {
      const status = await callApi({ action: 'status' });
      setPlan((p) => ({ ...p, gcal: { ...(p.gcal || {}), on: true, map: (p.gcal && p.gcal.map) || {} } }));
      setState((s) => ({ ...s, phase: 'syncing', message: `Conectado con «${status.calendar}». Subiendo eventos…` }));
    } catch (e) {
      setState((s) => ({ ...s, phase: 'error', message: e.message }));
    }
  }, [setPlan]);

  const disable = useCallback(() => {
    setPlan((p) => ({ ...p, gcal: { ...(p.gcal || {}), on: false } }));
    setState({ phase: 'idle', message: 'Sincronización desactivada. Lo que ya está en Google se queda ahí.', lastSync: null });
  }, [setPlan]);

  const syncNow = useCallback(() => {
    clearTimeout(timer.current);
    runSync();
  }, [runSync]);

  return { on, count, canUse: !!user, ...state, enable, disable, syncNow };
}
