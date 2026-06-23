-- 0005_family_events.sql — recurring family events with cadence-based recurrence engine
--
-- NOTE: Migration version 0005 is used here. On-disk files go up to 0004.
-- VERIFY against applied migrations (supabase migration list) before pushing —
-- if any migration between 0004 and 0005 has been applied remotely but not tracked
-- locally, renumber this file accordingly before running supabase db push.

create table if not exists family_events (
  id               uuid        primary key default gen_random_uuid(),
  household_id     uuid        not null default auth.uid() references public.households(id) on delete cascade,
  title            text        not null,
  notes            text,
  cadence          text        not null check (cadence in ('nightly', 'weekly', 'semiweekly', 'fortnightly')),
  days             jsonb       not null default '[]',
  start_date       date,
  status           text        not null default 'pending' check (status in ('pending', 'done')),
  completed_dates  jsonb       not null default '[]',
  photo_url        text,
  archived         boolean     not null default false,
  created_date     timestamptz not null default now()
);

alter table family_events enable row level security;

create policy "family own rows" on family_events
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));
