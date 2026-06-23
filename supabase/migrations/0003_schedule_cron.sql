-- ═══════════════════════════════════════════════════════════════════════════
-- 0003_schedule_cron.sql  —  pg_cron schedules for the 4 KinTeam cron functions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- REQUIRED SETUP BEFORE APPLYING THIS MIGRATION
-- ──────────────────────────────────────────────
-- 1. DEPLOY the 4 Edge Functions first (CLI owner action):
--      supabase functions deploy apply-scheduled-mode
--      supabase functions deploy update-streaks
--      supabase functions deploy reset-weekly-chores
--      supabase functions deploy generate-weekly-recap
--
-- 2. SET the CRON_SECRET function secret (CLI owner action):
--      supabase secrets set CRON_SECRET=<a-long-random-value>
--    Generate one with:  openssl rand -hex 32
--
-- 3. STORE THE SAME VALUE in Supabase Vault so pg_cron can read it:
--    Run in the Dashboard SQL editor (or psql):
--      select vault.create_secret('<same-value-as-above>', 'cron_secret');
--    The value must match CRON_SECRET exactly.
--
-- 4. ENABLE pg_cron and pg_net extensions in the Dashboard:
--      Dashboard → Database → Extensions → search "cron" and "net" → Enable
--    (They cannot be enabled via DDL on the free/pro tier; Dashboard toggle only.)
--
-- 5. APPLY THIS MIGRATION:
--      supabase db push          (if CLI owner access is available)
--    OR paste into Dashboard → SQL Editor and run manually.
--
-- NOTE: This migration is NOT auto-applied. It requires the steps above first.
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions (may already be enabled via Dashboard; `if not exists` is safe to re-run)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Helper: unschedule if a job with this name already exists ───────────────
-- Makes re-runs of this migration safe (no duplicate jobs).

do $$
begin
  perform cron.unschedule('kinteam-apply-scheduled-mode')
    where exists (select 1 from cron.job where jobname = 'kinteam-apply-scheduled-mode');
  perform cron.unschedule('kinteam-update-streaks')
    where exists (select 1 from cron.job where jobname = 'kinteam-update-streaks');
  perform cron.unschedule('kinteam-reset-weekly-chores')
    where exists (select 1 from cron.job where jobname = 'kinteam-reset-weekly-chores');
  perform cron.unschedule('kinteam-generate-weekly-recap')
    where exists (select 1 from cron.job where jobname = 'kinteam-generate-weekly-recap');
end $$;

-- ─── 1. apply-scheduled-mode  (daily, 05:05 UTC ≈ midnight–1am ET) ──────────
-- Intent: run just after midnight ET to apply or revert any scheduled modes.

select cron.schedule(
  'kinteam-apply-scheduled-mode',
  '5 5 * * *',
  $$
    select net.http_post(
      url     := 'https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/apply-scheduled-mode',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── 2. update-streaks  (daily, 05:10 UTC ≈ midnight–1am ET) ────────────────
-- Intent: run after apply-scheduled-mode so vacation-mode detection is current.

select cron.schedule(
  'kinteam-update-streaks',
  '10 5 * * *',
  $$
    select net.http_post(
      url     := 'https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/update-streaks',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── 3. generate-weekly-recap  (Monday only, 05:15 UTC) ─────────────────────
-- Intent: run BEFORE reset-weekly-chores so non-daily task status ('done')
-- is still intact when the recap reads it. Daily chores use completed_dates
-- (not cleared by reset), but non-daily chores use status which IS cleared.
-- Running recap first ensures all completion data is available.

select cron.schedule(
  'kinteam-generate-weekly-recap',
  '15 5 * * 1',
  $$
    select net.http_post(
      url     := 'https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/generate-weekly-recap',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── 4. reset-weekly-chores  (Monday only, 05:20 UTC ≈ midnight ET Mon) ─────
-- Intent: reset routine tasks at the start of each new week (ET Monday).
-- Runs AFTER generate-weekly-recap so recap can read the completed status first.

select cron.schedule(
  'kinteam-reset-weekly-chores',
  '20 5 * * 1',
  $$
    select net.http_post(
      url     := 'https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/reset-weekly-chores',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);
