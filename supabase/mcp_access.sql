-- Lets the El Boceto MCP server (mcp/) read and write the plan with a personal token, no login.
-- Run once in the Supabase SQL editor of the El Boceto project (after area_plans.sql).
--
-- Only a hash of the token is stored. The two functions below are the only way in: the table has
-- row-level security and no policies, so nobody can list or read the tokens.

create table if not exists public.mcp_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'claude-code',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.mcp_tokens enable row level security;

-- The plan of the token's owner, with the version (updated_at) needed to write it back.
create or replace function public.mcp_plan_get(p_token text)
returns table (plan jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.plan, a.updated_at
  from public.mcp_tokens t
  join public.area_plans a on a.user_id = t.user_id
  where t.token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex')
    and t.revoked_at is null;
$$;

-- Writes the plan only if nobody changed it since it was read (p_expected = the version read).
create or replace function public.mcp_plan_set(p_token text, p_plan jsonb, p_expected timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_stamp timestamptz;
begin
  select user_id into v_user from public.mcp_tokens
  where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex') and revoked_at is null;
  if v_user is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  if jsonb_typeof(p_plan -> 'areas') is distinct from 'array' or jsonb_typeof(p_plan -> 'items') is distinct from 'array' then
    raise exception 'not a plan' using errcode = '22023';
  end if;
  update public.area_plans set plan = p_plan
  where user_id = v_user and updated_at = p_expected
  returning updated_at into v_stamp;
  if v_stamp is null then
    raise exception 'conflict' using errcode = '40001';
  end if;
  return v_stamp;
end;
$$;

revoke all on function public.mcp_plan_get(text) from public;
revoke all on function public.mcp_plan_set(text, jsonb, timestamptz) from public;
grant execute on function public.mcp_plan_get(text) to anon, authenticated;
grant execute on function public.mcp_plan_set(text, jsonb, timestamptz) to anon, authenticated;

-- To create a token: run `npm run mcp:token` in the repo; it prints one insert statement to paste here.
-- To revoke one:  update public.mcp_tokens set revoked_at = now() where label = 'claude-code';
