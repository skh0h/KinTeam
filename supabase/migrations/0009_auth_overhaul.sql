-- ============================================================================
-- 0009_auth_overhaul.sql — ADDITIVE ONLY
-- Safe to apply now while the anonymous-session model is still live.
--
-- WHAT IS IN THIS FILE:
--   • households.owner_uid column (nullable, no FK constraint violation)
--   • Index on households.owner_uid for lookup performance
--   • family_members.auth_uid column (nullable, no FK constraint violation)
--   • UNIQUE constraint on family_members.auth_uid (idempotent guard)
--   • Index on family_members.auth_uid for lookup performance
--   • current_member_context() security-definer helper (returns nothing until
--     auth_uid is populated — safe no-op under the anonymous model)
--   • Narrowed EXECUTE grant on current_member_context() (revoke PUBLIC,
--     grant authenticated + anon only)
--
-- WHAT IS NOT IN THIS FILE (BREAKING WORK — SEE RUNBOOK BELOW):
--   • The RLS policy cutover (drop "household_id = auth.uid()" policies,
--     replace with role-aware policies using current_member_context())
--   • The handle_new_user() trigger rewrite
--   • Removing the anonymous sign-in fallback from ensureSession()
--   • Any data migration that repoints household_id foreign keys
--
-- THE BREAKING RLS CUTOVER, handle_new_user REWRITE, AND ANONYMOUS-REMOVAL
-- LIVE IN HANDOFF/auth-overhaul-runbook_2026-06-20.md AND MUST NOT BE APPLIED
-- UNTIL THE DATA MIGRATION IS COMPLETE AND VERIFIED.
--
-- NOT AUTO-APPLIED TO PROD BY THIS SESSION.
-- Apply manually via: supabase db push  (or paste into Dashboard SQL Editor)
-- ============================================================================

-- ─── 1. Add owner_uid to households ─────────────────────────────────────────
-- Nullable. Will be populated during the data migration (runbook Phase 4).
-- Until then, anonymous sessions continue to use households.id = auth.uid().

alter table public.households
  add column if not exists owner_uid uuid
    references auth.users(id) on delete set null;

create index if not exists idx_households_owner_uid
  on public.households (owner_uid);

-- ─── 2. Add auth_uid to family_members ──────────────────────────────────────
-- Nullable. Links a real (non-anonymous) auth.users identity to a member row.
-- Populated during data migration + during Google OAuth onboarding (runbook Phase 6).

alter table public.family_members
  add column if not exists auth_uid uuid
    references auth.users(id) on delete set null;

-- Unique constraint: one auth identity maps to at most one member row.
-- Postgres allows multiple NULLs under a unique constraint, so existing
-- anonymous rows (auth_uid IS NULL) are unaffected.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_members_auth_uid_unique'
  ) then
    alter table public.family_members
      add constraint family_members_auth_uid_unique unique (auth_uid);
  end if;
end $$;

-- ─── 3. Index for auth_uid lookups ──────────────────────────────────────────
-- Used by current_member_context() to resolve household + role for every request.

create index if not exists idx_family_members_auth_uid
  on public.family_members (auth_uid);

-- ─── 4. current_member_context() — role-resolution helper ───────────────────
-- Returns the (household_id, role) pair for the currently authenticated user.
-- Under the anonymous model, auth_uid is always null, so this returns zero rows
-- (harmless — the existing anonymous RLS policies are untouched and still fire).
-- After the RLS cutover (runbook Phase 5), all policies will call this function.
--
-- SECURITY DEFINER so the function can read family_members without triggering
-- the per-member RLS policies (which would cause infinite recursion).
-- search_path = public prevents search_path injection.

create or replace function public.current_member_context()
  returns table(household_id uuid, role text)
  language sql
  security definer
  stable
  set search_path = public
as $$
  select m.household_id, m.role
  from public.family_members m
  where m.auth_uid = auth.uid()
  limit 1;
$$;

-- Restrict execute to authenticated and anon roles only.
-- The default PUBLIC grant is too broad for a security-definer function.
revoke execute on function public.current_member_context() from public;
grant execute on function public.current_member_context() to authenticated, anon;
