-- Plan por áreas: one row per user holding the whole plan as JSON.
-- Run once in the Supabase SQL editor of the El Boceto project.

create table if not exists public.area_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.area_plans enable row level security;

create policy "area_plans_select_own" on public.area_plans
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "area_plans_insert_own" on public.area_plans
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "area_plans_update_own" on public.area_plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "area_plans_delete_own" on public.area_plans
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The server stamps every write, so devices never compare their own clocks.
create or replace function public.area_plans_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger area_plans_touch
  before insert or update on public.area_plans
  for each row execute function public.area_plans_touch();
