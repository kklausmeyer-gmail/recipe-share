begin;
create table public.plan_use_up (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  ingredient text not null check (length(trim(ingredient)) between 1 and 100),
  unique (week_start, ingredient)
);
alter table public.plan_use_up enable row level security;
revoke all on public.plan_use_up from anon;
grant select, insert, update, delete on public.plan_use_up to authenticated;
grant all on public.plan_use_up to service_role;
create policy "owners manage use up ingredients" on public.plan_use_up
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
commit;
