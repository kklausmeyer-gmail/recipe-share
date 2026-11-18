begin;
alter table public.plan_use_up
  add column added_on date,
  add column completed boolean not null default false;
-- Preserve existing items' week-wide matching; new items use the client's local date.
update public.plan_use_up set added_on = week_start;
alter table public.plan_use_up alter column added_on set not null;
commit;
