-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0002: Make the uploads bucket private + tighten storage RLS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- IMPORTANT — NOT AUTO-APPLIED
--   Apply this migration manually via ONE of:
--     a) supabase db push          (requires Supabase CLI + Owner access)
--     b) Paste into Supabase Dashboard → SQL Editor and click "Run"
--
-- BREAKING CHANGE for pre-existing PUBLIC photo URLs
--   Any photo URLs already stored in entity rows (family_tasks.photo_url, etc.)
--   that are plain public URLs (https://...supabase.co/storage/v1/object/public/...)
--   will STOP WORKING after this migration is applied.
--   Remediation: re-upload affected photos through the app, or manually call
--   createSignedUrl for each path and update the stored URL.
--   New uploads (which now store 1-year signed URLs) are NOT affected.
--
-- EDGE FUNCTIONS are unaffected
--   Edge functions (analyze-chore-photo, analyze-team-lift-photo) receive the
--   signed URL as their payload and fetch it via the token — no auth context
--   needed. They continue to work correctly.
-- ═══════════════════════════════════════════════════════════════════════════

-- (a) Flip the uploads bucket from public to private.
--     Idempotent: updates the row regardless of current state.
update storage.buckets
set public = false
where id = 'uploads';

-- (b) Drop the blanket public SELECT policy that allowed anyone to read any
--     object in the uploads bucket.  Signed URLs carry their own access token
--     and bypass RLS entirely, so this policy is no longer needed.
--     Idempotent via "if exists".
drop policy if exists "public select" on storage.objects;

-- (c) Add an authenticated SELECT policy scoped to the owner's folder so the
--     owning family can still list and fetch their own objects via an
--     authenticated Supabase client (e.g. for admin tooling or future path-
--     based re-signing).  Other families cannot see each other's objects.
--     Idempotent: drop before re-creating.
drop policy if exists "family select own folder" on storage.objects;
create policy "family select own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
