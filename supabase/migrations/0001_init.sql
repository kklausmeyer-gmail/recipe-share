-- Recipe Share schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table is locked down with row-level security: only emails listed in
-- `members` can read or write anything, and meal planning is limited to owners.

-- ---------------------------------------------------------------------------
-- Members and access helpers
-- ---------------------------------------------------------------------------

create table public.members (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  role         text not null default 'editor' check (role in ('owner', 'editor')),
  user_id      uuid unique,
  created_at   timestamptz not null default now()
);

create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = public.current_email())
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members where email = public.current_email() and role = 'owner'
  )
$$;

-- Links the signed-in auth user to their members row (called by the app after sign-in).
create or replace function public.claim_membership() returns void
language sql volatile security definer set search_path = public as $$
  update public.members set user_id = auth.uid()
  where email = public.current_email() and user_id is distinct from auth.uid()
$$;

-- Block sign-ups from anyone who has not been invited.
create or replace function public.enforce_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where email = lower(new.email)) then
    raise exception 'not_invited: % has not been invited', new.email;
  end if;
  update public.members set user_id = new.id where email = lower(new.email);
  return new;
end
$$;

create trigger enforce_invite
  before insert on auth.users
  for each row execute function public.enforce_invite();

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  servings      text,
  prep_minutes  int,
  cook_minutes  int,
  total_minutes int,
  -- Ingredient and step lines as plain text. A line starting with "# " is a section header.
  ingredients   jsonb not null default '[]'::jsonb,
  steps         jsonb not null default '[]'::jsonb,
  tags          text[] not null default '{}',
  source_type   text not null default 'manual' check (source_type in ('photo', 'link', 'manual')),
  source_url    text,
  source_book   text,
  source_page   text,
  status        text not null default 'ready' check (status in ('ready', 'needs_transcription')),
  hero_photo_id uuid,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.cook_log (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes on delete cascade,
  cooked_on  date not null default current_date,
  meal       text not null default 'dinner',
  cooked_by  uuid default auth.uid(),
  notes      text,
  created_at timestamptz not null default now()
);
create index cook_log_recipe_idx on public.cook_log (recipe_id);
create index cook_log_date_idx on public.cook_log (cooked_on desc);

-- kind: 'page'   = photo of the original recipe (cookbook page, card, screenshot)
--       'source' = the cookbook's or website's photo of the finished dish
--       'ours'   = our own photo of what we made
create table public.recipe_photos (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes on delete cascade,
  cook_log_id uuid references public.cook_log on delete set null,
  kind        text not null check (kind in ('page', 'source', 'ours')),
  path_lg     text not null,
  path_sm     text not null,
  width       int,
  height      int,
  sort        int not null default 0,
  uploaded_by uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index recipe_photos_recipe_idx on public.recipe_photos (recipe_id);

alter table public.recipes
  add constraint recipes_hero_fk foreign key (hero_photo_id)
  references public.recipe_photos (id) on delete set null;

-- One rating per person per recipe.
create table public.ratings (
  recipe_id  uuid not null references public.recipes on delete cascade,
  user_id    uuid not null default auth.uid(),
  stars      int not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

-- Running notes: substitutions, measurement tweaks, "use half the salt".
create table public.recipe_notes (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes on delete cascade,
  author     uuid default auth.uid(),
  body       text not null,
  created_at timestamptz not null default now()
);
create index recipe_notes_recipe_idx on public.recipe_notes (recipe_id);

create table public.tags (
  name text primary key check (name = lower(name)),
  grp  text not null default 'other',
  sort int not null default 100
);

-- Meal plan (owners only). status 'suggested' rows are replaced when re-rolling.
create table public.meal_plan (
  id         uuid primary key default gen_random_uuid(),
  plan_date  date not null,
  meal       text not null default 'dinner',
  recipe_id  uuid references public.recipes on delete cascade,
  label      text,
  status     text not null default 'planned' check (status in ('suggested', 'planned', 'cooked', 'skipped')),
  created_at timestamptz not null default now()
);
create index meal_plan_date_idx on public.meal_plan (plan_date);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.members       enable row level security;
alter table public.recipes       enable row level security;
alter table public.cook_log      enable row level security;
alter table public.recipe_photos enable row level security;
alter table public.ratings       enable row level security;
alter table public.recipe_notes  enable row level security;
alter table public.tags          enable row level security;
alter table public.meal_plan     enable row level security;

create policy "members read"  on public.members for select using ((select public.is_member()));
create policy "owners manage members" on public.members for all
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "members all" on public.recipes for all
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.cook_log for all
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.recipe_photos for all
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.recipe_notes for all
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "members all" on public.tags for all
  using ((select public.is_member())) with check ((select public.is_member()));

create policy "members read" on public.ratings for select using ((select public.is_member()));
create policy "own rating insert" on public.ratings for insert
  with check ((select public.is_member()) and user_id = (select auth.uid()));
create policy "own rating update" on public.ratings for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rating delete" on public.ratings for delete
  using (user_id = (select auth.uid()));

create policy "owners all" on public.meal_plan for all
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Photo storage: a private bucket readable only by members (via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "members read photos" on storage.objects for select
  using (bucket_id = 'photos' and (select public.is_member()));
create policy "members add photos" on storage.objects for insert
  with check (bucket_id = 'photos' and (select public.is_member()));
create policy "members update photos" on storage.objects for update
  using (bucket_id = 'photos' and (select public.is_member()));
create policy "members delete photos" on storage.objects for delete
  using (bucket_id = 'photos' and (select public.is_member()));

-- ---------------------------------------------------------------------------
-- Starter tags
-- ---------------------------------------------------------------------------

insert into public.tags (name, grp, sort) values
  ('breakfast', 'meal', 1), ('lunch', 'meal', 2), ('dinner', 'meal', 3),
  ('side', 'meal', 4), ('dessert', 'meal', 5), ('snack', 'meal', 6),
  ('drink', 'meal', 7), ('sauce', 'meal', 8),
  ('gluten free', 'diet', 10), ('dairy free', 'diet', 11), ('paleo', 'diet', 12),
  ('vegetarian', 'diet', 13), ('vegan', 'diet', 14),
  ('chicken', 'protein', 20), ('beef', 'protein', 21), ('pork', 'protein', 22),
  ('fish', 'protein', 23), ('shrimp', 'protein', 24), ('turkey', 'protein', 25),
  ('lamb', 'protein', 26), ('beans', 'protein', 27), ('tofu', 'protein', 28), ('eggs', 'protein', 29),
  ('italian', 'cuisine', 40), ('mexican', 'cuisine', 41), ('asian', 'cuisine', 42),
  ('indian', 'cuisine', 43), ('mediterranean', 'cuisine', 44), ('american', 'cuisine', 45),
  ('quick', 'other', 60), ('slow cooker', 'other', 61), ('instant pot', 'other', 62),
  ('grill', 'other', 63), ('soup', 'other', 64), ('salad', 'other', 65),
  ('make ahead', 'other', 66), ('company-worthy', 'other', 67)
on conflict (name) do nothing;
