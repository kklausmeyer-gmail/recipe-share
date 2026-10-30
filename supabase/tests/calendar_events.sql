-- Run in the SQL editor after 0002. All fixtures are rolled back.
begin;
insert into public.members (email, display_name, role) values
  ('calendar-owner-test@example.invalid', 'Calendar owner test', 'owner'),
  ('calendar-editor-test@example.invalid', 'Calendar editor test', 'editor');

set local role authenticated;
select set_config('request.jwt.claims', '{"email":"calendar-owner-test@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
insert into public.calendar_events (id, title, start_date)
values ('00000000-0000-0000-0000-000000000002', 'Calendar access test', '2026-10-30');
do $$ begin
  if not exists (select 1 from public.calendar_events where id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'Owner cannot read calendar event';
  end if;
end $$;
update public.calendar_events set notes = 'Owner can edit' where id = '00000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"email":"calendar-editor-test@example.invalid","sub":"00000000-0000-0000-0000-000000000003"}', true);
do $$ begin
  if exists (select 1 from public.calendar_events) then raise exception 'Editor can read private calendar'; end if;
  begin
    insert into public.calendar_events (title) values ('Editor must not create this');
    raise exception 'Editor can create calendar event';
  exception when insufficient_privilege then null;
  end;
  update public.calendar_events set title = 'Editor must not edit this';
  if found then raise exception 'Editor can edit private calendar'; end if;
  delete from public.calendar_events;
  if found then raise exception 'Editor can delete private calendar'; end if;
end $$;

reset role;
do $$ begin
  if has_table_privilege('anon', 'public.calendar_events', 'SELECT') then
    raise exception 'Anonymous role has calendar read access';
  end if;
end $$;
rollback;
select 'Calendar owner/editor/anonymous access checks passed; fixtures rolled back' as result;
