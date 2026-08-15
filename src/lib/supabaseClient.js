import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// If the env vars aren't configured (e.g. a deploy target missing them),
// don't crash the whole app on load — the board/planner must keep working
// with no login either way. Auth-related calls just no-op instead.
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase && typeof window !== 'undefined') {
  console.warn('Supabase env vars missing — running in local-only mode (no login/sync).');
}
