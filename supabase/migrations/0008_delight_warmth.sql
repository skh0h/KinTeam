-- 0008_delight_warmth.sql — family pet, kudos, and shout-outs tables
--
-- family_pet : one virtual pet per household; grows as chores are completed
-- kudos      : member-to-member appreciation tied to optional task
-- shout_outs : household-wide message-board posts authored by a member

-- ─── family_pet ──────────────────────────────────────────────────────────────

create table if not exists family_pet (
  id              uuid        primary key default gen_random_uuid(),
  created_date    timestamptz not null default now(),
  household_id    uuid        not null default auth.uid() references public.households(id) on delete cascade,
  name            text,
  species         text        not null default 'plant',
  growth_points   int         not null default 0,
  stage           int         not null default 0,
  constraint family_pet_household_unique unique (household_id)
);

alter table family_pet enable row level security;

drop policy if exists "family own rows" on family_pet;
create policy "family own rows" on family_pet
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

-- ─── kudos ───────────────────────────────────────────────────────────────────

create table if not exists kudos (
  id              uuid        primary key default gen_random_uuid(),
  created_date    timestamptz not null default now(),
  household_id    uuid        not null default auth.uid() references public.households(id) on delete cascade,
  from_member_id  uuid,
  to_member_id    uuid,
  task_id         uuid,
  emoji           text
);

alter table kudos enable row level security;

drop policy if exists "family own rows" on kudos;
create policy "family own rows" on kudos
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

-- ─── shout_outs ──────────────────────────────────────────────────────────────

create table if not exists shout_outs (
  id                uuid        primary key default gen_random_uuid(),
  created_date      timestamptz not null default now(),
  household_id      uuid        not null default auth.uid() references public.households(id) on delete cascade,
  author_member_id  uuid,
  message           text        not null
);

alter table shout_outs enable row level security;

drop policy if exists "family own rows" on shout_outs;
create policy "family own rows" on shout_outs
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));
