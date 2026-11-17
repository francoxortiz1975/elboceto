import { supabase } from './supabaseClient';

// The whole plan lives in one row per user (see supabase/area_plans.sql).
// updated_at is stamped by the server, so devices never compare their clocks.

export async function pullAreaPlan(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('area_plans')
    .select('plan, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !Array.isArray(data.plan?.areas) || !Array.isArray(data.plan?.items)) return null;
  return { plan: data.plan, updatedAt: data.updated_at };
}

// Saves the plan. With `expected` (the cloud version this device last saw) it only writes if the cloud still has that version:
// if something else wrote in between (the MCP, the nightly job, another device) it returns { ok: false, conflict: true } and writes nothing.
// Without `expected` (first save of a device, or the row does not exist yet) it creates / replaces the row.
export async function pushAreaPlan(userId, plan, expected) {
  if (!supabase) throw new Error('Supabase no está configurado');
  if (expected) {
    const { data, error } = await supabase
      .from('area_plans')
      .update({ plan })
      .eq('user_id', userId)
      .eq('updated_at', expected)
      .select('updated_at');
    if (error) throw error;
    if (data && data.length) return { ok: true, updatedAt: data[0].updated_at };
    return { ok: false, conflict: true };
  }
  const { data, error } = await supabase
    .from('area_plans')
    .upsert({ user_id: userId, plan }, { onConflict: 'user_id' })
    .select('updated_at')
    .single();
  if (error) throw error;
  return { ok: true, updatedAt: data.updated_at };
}
