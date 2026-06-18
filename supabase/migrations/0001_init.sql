-- KinTeam initial schema — multi-tenant (one Supabase account per family)
-- Each family's auth.uid() is the household/tenant identifier.
-- RLS isolates every family's data: household_id = auth.uid().

-- ─── Households (one row per family, auto-created on signup) ─────────────────

create table if not exists households (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text,
  created_date timestamptz not null default now()
);

-- Auto-create a households row when a new family signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.households (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists family_members (
  id                 uuid primary key default gen_random_uuid(),
  created_date       timestamptz not null default now(),
  household_id       uuid not null default auth.uid() references public.households(id) on delete cascade,
  name               text not null,
  display_name       text,
  avatar_emoji       text,
  role               text not null default 'user' check (role in ('user', 'admin')),
  availability       text not null default 'full' check (availability in ('full', 'partial', 'unavailable')),
  availability_note  text,
  streak_count       numeric not null default 0,
  bonus_stars        numeric not null default 0,
  last_streak_date   text
);

create table if not exists family_tasks (
  id                    uuid primary key default gen_random_uuid(),
  created_date          timestamptz not null default now(),
  household_id          uuid not null default auth.uid() references public.households(id) on delete cascade,
  title                 text not null,
  occurrence            text not null default 'weekly' check (occurrence in ('daily', 'weekly', 'fortnightly', 'monthly', 'as_needed')),
  task_type             text not null default 'routine' check (task_type in ('routine', 'team_lift')),
  phase                 text not null default 'none' check (phase in ('prep', 'execution', 'verification', 'none')),
  parent_task_id        uuid references family_tasks(id),
  assigned_to           text,
  permanent_assigned_to text,
  due_day               text not null default 'any' check (due_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'any')),
  status                text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  priority              text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  stars                 numeric not null default 1,
  stars_penalty         numeric not null default 0,
  due_date              text,
  notes                 text,
  photo_url             text,
  week_of               text,
  archived              boolean not null default false,
  completed_dates       jsonb not null default '[]',
  steps                 jsonb not null default '[]'
);

create table if not exists admin_alerts (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  message       text not null,
  from_member   text not null,
  task_title    text,
  task_id       text not null,
  step_id       text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_notified boolean not null default false
);

create table if not exists scheduled_modes (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  start_date    text not null,
  end_date      text not null,
  mode          text not null default 'vacation' check (mode in ('normal', 'workhorse', 'vacation'))
);

create table if not exists household_settings (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  mode          text not null default 'normal' check (mode in ('normal', 'workhorse', 'vacation')),
  auto_set      boolean not null default false
);

create table if not exists star_rewards (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  title         text not null,
  emoji         text,
  cost          numeric not null default 5,
  description   text
);

create table if not exists reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  reward_id     text not null,
  reward_title  text,
  reward_emoji  text,
  cost          numeric not null,
  member_id     text not null,
  member_name   text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists chore_trades (
  id               uuid primary key default gen_random_uuid(),
  created_date     timestamptz not null default now(),
  household_id     uuid not null default auth.uid() references public.households(id) on delete cascade,
  task_id          text not null,
  task_title       text,
  from_member_id   text not null,
  from_member_name text,
  to_member_id     text not null,
  to_member_name   text,
  status           text not null default 'pending_sibling' check (status in ('pending_sibling', 'pending_admin', 'approved', 'rejected', 'declined'))
);

create table if not exists system_zones (
  id                 uuid primary key default gen_random_uuid(),
  created_date       timestamptz not null default now(),
  household_id       uuid not null default auth.uid() references public.households(id) on delete cascade,
  name               text not null,
  icon               text,
  color              text,
  description        text,
  current_lead_name  text,
  rotation_order     jsonb not null default '[]',
  rotation_index     numeric not null default 0
);

create table if not exists huddle_notes (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  week_of       text not null,
  notes         text,
  adjustments   text,
  completed     boolean not null default false
);

create table if not exists weekly_recaps (
  id            uuid primary key default gen_random_uuid(),
  created_date  timestamptz not null default now(),
  household_id  uuid not null default auth.uid() references public.households(id) on delete cascade,
  week_of       text not null,
  mvp_name      text,
  stats         jsonb not null default '[]'
);

-- ─── Storage bucket ───────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Per-family isolation: every family sees only its own rows (household_id = auth.uid()).

alter table households          enable row level security;
alter table family_members      enable row level security;
alter table family_tasks        enable row level security;
alter table admin_alerts        enable row level security;
alter table scheduled_modes     enable row level security;
alter table household_settings  enable row level security;
alter table star_rewards        enable row level security;
alter table reward_redemptions  enable row level security;
alter table chore_trades        enable row level security;
alter table system_zones        enable row level security;
alter table huddle_notes        enable row level security;
alter table weekly_recaps       enable row level security;

-- households: a family can only see and update its own household row
create policy "family own household" on households
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Per-family policy macro applied to all data tables
create policy "family own rows" on family_members
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on family_tasks
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on admin_alerts
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on scheduled_modes
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on household_settings
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on star_rewards
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on reward_redemptions
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on chore_trades
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on system_zones
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on huddle_notes
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

create policy "family own rows" on weekly_recaps
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

-- Storage policies for the uploads bucket
-- Files live under <household_id>/... — path check uses the first folder segment.
-- INSERT/UPDATE/DELETE: authenticated, own folder only.
-- SELECT: public (Edge Functions fetch the URL server-side without auth context).
create policy "family upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "family update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "family delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "public select" on storage.objects
  for select to public
  using (bucket_id = 'uploads');
