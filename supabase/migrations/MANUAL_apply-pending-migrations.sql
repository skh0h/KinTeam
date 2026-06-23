-- ═══════════════════════════════════════════════════════════════════════════════
-- MANUAL CONSOLIDATED MIGRATION HELPER — KinTeam Schema Updates
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- **CRITICAL NOTE**: This file is a MANUAL consolidated apply-via-dashboard helper,
-- NOT a CLI migration. The individual numbered migrations (0002-0006) remain the
-- source of truth for `supabase db push`. This file is named MANUAL_* to be
-- ignored by the Supabase CLI — do not rename with a numeric prefix.
--
-- PURPOSE:
--   Apply all safe, unapplied migrations to bring the remote Supabase DB schema
--   current. This file is IDEMPOTENT — it is safe to re-run against a DB that
--   already has 0001_init.sql applied.
--
-- CRITICAL UNBLOCK:
--   Section 1 adds the missing pin_hash column to family_members table, which
--   fixes the PGRST204 error blocking admin PIN login.
--
-- EXCLUDED:
--   - 0003_schedule_cron.sql (pg_cron scheduling)
--   - 0006_schedule_roll_events.sql (pg_cron scheduling)
--   Both require extensions (pg_cron, pg_net) to be enabled via Supabase Dashboard
--   and vault secrets to be set up via CLI. See comments below for manual steps.
--
-- RECOMMENDED WORKFLOW:
--   1. Run this file in Supabase Dashboard → SQL Editor
--   2. Verify no errors
--   3. Once Extensions & Secrets are set up (0003 & 0006 prerequisites), use
--      the separate cron scheduling file or run the cron migration SQL manually
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 (CRITICAL): family_member_pin.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds per-member admin PIN hash column. Fixes PGRST204 error and enables
-- trusted-device PIN login flow replacing hardcoded ADMIN_PIN constant.

alter table family_members add column if not exists pin_hash text;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: family_events.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates family_events table for recurring calendar events with cadence-based
-- recurrence engine (nightly, weekly, semiweekly, fortnightly). Supports the
-- Calendar/EventWorkshop feature currently in development.

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

drop policy if exists "family own rows" on family_events;
create policy "family own rows" on family_events
  for all to authenticated
  using (household_id = (select auth.uid()))
  with check (household_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: private_uploads.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Makes uploads bucket private and tightens storage RLS. All new photo URLs
-- are now 1-year signed URLs (stored in DB) instead of plain public URLs.
--
-- BREAKING CHANGE: Pre-existing plain public URLs in photo_url columns will
-- stop working after this migration. Remediation:
--   - New uploads through the app are NOT affected (use signed URLs)
--   - For pre-existing photos, either:
--     a) Re-upload affected photos through the app
--     b) Manually call createSignedUrl for each stored path and update the URL
--   - Edge functions (analyze-chore-photo, analyze-team-lift-photo) are unaffected
--     because they receive signed URLs in their payload

-- (a) Flip the uploads bucket from public to private.
update storage.buckets
set public = false
where id = 'uploads';

-- (b) Drop the blanket public SELECT policy.
drop policy if exists "public select" on storage.objects;

-- (c) Add authenticated SELECT policy scoped to owner's folder.
drop policy if exists "family select own folder" on storage.objects;
create policy "family select own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTED OUT: CRON SCHEDULING MIGRATIONS (Manual Setup Required)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Two migrations require pg_cron/pg_net extensions and vault secrets setup:
--
-- FILE: 0003_schedule_cron.sql
--   Schedules 4 daily cron jobs (apply-scheduled-mode, update-streaks,
--   generate-weekly-recap, reset-weekly-chores)
--
-- FILE: 0006_schedule_roll_events.sql
--   Schedules daily roll-events cron job
--
-- WHY COMMENTED OUT:
--   1. pg_cron and pg_net extensions CANNOT be enabled via SQL on Supabase
--      free/pro tiers. They must be enabled via Dashboard toggle:
--        Dashboard → Database → Extensions → search "cron" and "net" → Enable
--
--   2. Vault secret CRON_SECRET must be set up via CLI:
--        supabase secrets set CRON_SECRET=<long-random-value>
--      AND stored in Supabase Vault (Dashboard SQL editor):
--        select vault.create_secret('<same-value>', 'cron_secret');
--
--   3. All 5 Edge Functions must be deployed first:
--        supabase functions deploy apply-scheduled-mode
--        supabase functions deploy update-streaks
--        supabase functions deploy reset-weekly-chores
--        supabase functions deploy generate-weekly-recap
--        supabase functions deploy roll-events
--
-- MANUAL APPLY STEPS (when ready):
--   1. Enable extensions via Supabase Dashboard
--   2. Set CRON_SECRET via: supabase secrets set CRON_SECRET=<value>
--   3. Store secret in vault via Dashboard SQL Editor:
--        select vault.create_secret('<same-value>', 'cron_secret');
--   4. Deploy all 5 Edge Functions via CLI
--   5. Paste and run 0003_schedule_cron.sql in Dashboard SQL Editor
--   6. Paste and run 0006_schedule_roll_events.sql in Dashboard SQL Editor
--
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DO NOT UNCOMMENT BELOW UNLESS YOU HAVE COMPLETED ALL PREREQUISITES ABOVE
--
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- -- 0003_schedule_cron.sql — 4 daily cron schedules
-- --
-- -- create extension if not exists pg_cron;
-- -- create extension if not exists pg_net;
-- --
-- -- do $$
-- -- begin
-- --   perform cron.unschedule('kinteam-apply-scheduled-mode')
-- --     where exists (select 1 from cron.job where jobname = 'kinteam-apply-scheduled-mode');
-- --   perform cron.unschedule('kinteam-update-streaks')
-- --     where exists (select 1 from cron.job where jobname = 'kinteam-update-streaks');
-- --   perform cron.unschedule('kinteam-reset-weekly-chores')
-- --     where exists (select 1 from cron.job where jobname = 'kinteam-reset-weekly-chores');
-- --   perform cron.unschedule('kinteam-generate-weekly-recap')
-- --     where exists (select 1 from cron.job where jobname = 'kinteam-generate-weekly-recap');
-- -- end $$;
-- --
-- -- select cron.schedule('kinteam-apply-scheduled-mode', '5 5 * * *',
-- --   'select net.http_post(url := ''https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/apply-scheduled-mode'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')), body := ''{}''::jsonb)');
-- --
-- -- select cron.schedule('kinteam-update-streaks', '10 5 * * *',
-- --   'select net.http_post(url := ''https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/update-streaks'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')), body := ''{}''::jsonb)');
-- --
-- -- select cron.schedule('kinteam-generate-weekly-recap', '15 5 * * 1',
-- --   'select net.http_post(url := ''https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/generate-weekly-recap'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')), body := ''{}''::jsonb)');
-- --
-- -- select cron.schedule('kinteam-reset-weekly-chores', '20 5 * * 1',
-- --   'select net.http_post(url := ''https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/reset-weekly-chores'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')), body := ''{}''::jsonb)');
-- --
-- -- 0006_schedule_roll_events.sql — roll-events daily cron
-- --
-- -- create extension if not exists pg_cron;
-- -- create extension if not exists pg_net;
-- --
-- -- do $$
-- -- begin
-- --   perform cron.unschedule('kinteam-roll-events')
-- --     where exists (select 1 from cron.job where jobname = 'kinteam-roll-events');
-- -- end $$;
-- --
-- -- select cron.schedule('kinteam-roll-events', '0 5 * * *',
-- --   'select net.http_post(url := ''https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/roll-events'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (select decrypted_secret from vault.decrypted_secrets where name = ''cron_secret'')), body := ''{}''::jsonb)');
-- --
-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF FILE
-- ═══════════════════════════════════════════════════════════════════════════════
