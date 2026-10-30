begin;
create table public.plan_day_notes (
  plan_date date primary key,
  body text not null default '' check (length(body) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.plan_day_notes enable row level security;
revoke all on public.plan_day_notes from anon;
grant select, insert, update, delete on public.plan_day_notes to authenticated;
grant all on public.plan_day_notes to service_role;
create policy "owners manage day notes" on public.plan_day_notes
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create trigger plan_day_notes_touch before update on public.plan_day_notes
  for each row execute function public.touch_updated_at();
commit;
