-- Calendar schedules are private to the same owners who share the meal plan.
begin;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  start_date date not null default current_date,
  recurrence text not null default 'weekly' check (recurrence in ('none', 'weekly')),
  end_date date check (end_date is null or end_date >= start_date),
  start_time time,
  end_time time,
  notes text check (notes is null or length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_times check (
    (start_time is null and end_time is null) or
    (start_time is not null and end_time is not null and end_time > start_time)
  )
);

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant all on public.calendar_events to service_role;
create policy "owners manage calendar" on public.calendar_events
  for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create trigger calendar_events_touch before update on public.calendar_events
  for each row execute function public.touch_updated_at();

commit;
