-- ═══════════════════════════════════════════════════════════════════════════
-- 0006_schedule_roll_events.sql  —  pg_cron schedule for the roll-events cron
-- ═══════════════════════════════════════════════════════════════════════════
--
-- REQUIRED SETUP BEFORE APPLYING THIS MIGRATION
-- ──────────────────────────────────────────────
-- 1. DEPLOY the Edge Function first:
--      supabase functions deploy roll-events
--
-- 2. Ensure CRON_SECRET is already set (done in 0003_schedule_cron.sql setup).
--    If not, follow the setup instructions in 0003_schedule_cron.sql.
--
-- 3. APPLY THIS MIGRATION:
--      supabase db push
--    OR paste into Dashboard → SQL Editor and run manually.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedule if already registered (makes re-runs safe)
do $$
begin
  perform cron.unschedule('kinteam-roll-events')
    where exists (select 1 from cron.job where jobname = 'kinteam-roll-events');
end $$;

-- daily at 05:00 UTC ≈ midnight–1am ET (runs before the other 05:0x jobs)
select cron.schedule(
  'kinteam-roll-events',
  '0 5 * * *',
  $$
    select net.http_post(
      url     := 'https://djnhsgfldbizgqfdpayn.supabase.co/functions/v1/roll-events',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);
