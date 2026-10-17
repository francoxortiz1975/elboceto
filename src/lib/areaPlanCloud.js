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

export async function pushAreaPlan(userId, plan) {
  if (!supabase) throw new Error('Supabase no está configurado');
  const { data, error } = await supabase
    .from('area_plans')
    .upsert({ user_id: userId, plan }, { onConflict: 'user_id' })
    .select('updated_at')
    .single();
  if (error) throw error;
  return data.updated_at;
}
