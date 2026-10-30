-- Owner access and private notes; every fixture is rolled back.
begin;
insert into public.members (email, display_name, role) values
  ('plan-owner-test@example.invalid', 'Plan owner test', 'owner'),
  ('plan-editor-test@example.invalid', 'Plan editor test', 'editor');
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"plan-owner-test@example.invalid","sub":"00000000-0000-0000-0000-000000000001"}', true);
insert into public.plan_day_notes (plan_date, body) values ('1900-01-01', 'Private test note');
update public.plan_day_notes set body = 'Edited private test note' where plan_date = '1900-01-01';
insert into public.meal_plan (plan_date, recipe_id, status)
select '1900-01-01', id, 'planned' from public.recipes order by id limit 2;
do $$ begin
  if (select count(*) from public.meal_plan where plan_date = '1900-01-01') < 2 then raise exception 'Multiple dishes were not retained'; end if;
  if not exists (select 1 from public.plan_day_notes where plan_date = '1900-01-01' and body = 'Edited private test note') then raise exception 'Owner note save/read/edit failed'; end if;
end $$;
select set_config('request.jwt.claims', '{"email":"plan-editor-test@example.invalid","sub":"00000000-0000-0000-0000-000000000003"}', true);
do $$ begin
  if exists (select 1 from public.plan_day_notes) then raise exception 'Editor can read private day notes'; end if;
  begin
    insert into public.plan_day_notes (plan_date, body) values ('1900-01-02', 'Must be denied');
    raise exception 'Editor can create private day notes';
  exception when insufficient_privilege then null;
  end;
  update public.plan_day_notes set body = 'Must be denied' where plan_date = '1900-01-01';
  if found then raise exception 'Editor can update private day notes'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('anon', 'public.plan_day_notes', 'SELECT') then raise exception 'Anonymous role can read day notes'; end if;
end $$;
rollback;
select 'Private day notes and multiple dishes checks passed; fixtures rolled back' as result;
