
## Deferred from 2026-06-19 remediation

### Auth / Identity (future)

- [ ] **Real authorization** — Make household members real Supabase identities (email or Google OAuth family sign-in). Replaces the trusted-device PIN model when implemented.

- [ ] **Add role enforcement** — Add a role claim and enforce admin-only writes via RLS policies + security-definer RPCs (currently RLS is household-scoped with no role distinction).

- [ ] **Rebuild self-serve signup + password recovery** — Register / ForgotPassword / ResetPassword pages were removed as part of the trusted-device PIN simplification. Reimplement when moving to per-member identities and Google auth.

### Backend jobs (CRITICAL-2, deferred — graceful guard in place)

- [ ] **Port 4 weekly jobs to Supabase Edge Functions** — resetWeeklyChores, updateStreaks, applyScheduledMode, generateWeeklyRecap (and rollEvents). Edge-function directories already exist on disk under supabase/functions/ (untracked) but are NOT in FN_MAP; the adapter currently no-ops these gracefully. Weekly resets/streaks/recaps do NOT run until this is done.

### Architecture refactors (deferred — high risk, do deliberately)

- [ ] **HIGH-3: Consolidate dual data/auth abstractions** — Remove the base44Client.js re-export "safety net" once non-Vite paths are confirmed unused. Unify to a single entry point.

- [ ] **HIGH-4: Reconcile three auth-truth sources** — Merge AuthContext, LocalUserContext, and Supabase anonymous session into one source of truth.

- [ ] **MEDIUM-5: Extract services layer** — Move Dashboard/Zones/Setup inline query logic and filter predicates into a shared services module (dedupe, improve testability).

### Data / cleanup (lower priority)

- [ ] **M-2 data backfill** — If any existing family_tasks rows have assigned_to stored as a display name (from old TeamLift flow), run a one-time migration to convert to member UUIDs. New writes are UUID-only.

- [ ] **LOW-7: Finish app-params.js env cleanup** — Only load the active backend's vars; currently loads both Base44 and Supabase (clarifying comment added, not yet refactored).

- [ ] **L-2 / M-1: Adapter perf & UX** — Double auth call in me() (minor perf) and ensureSession concurrent-rejection UX. Documented in code, deferred as non-critical.

---

## Authentication roadmap (post-migration)

Context: current setup uses the **shared-account-per-family** model on Supabase — one auth login per family, members share it. Single-family works today. The items below add multi-family onboarding + Google sign-in.

- [ ] **Family self-serve sign-up** — logged-out registration screen so a brand-new family can create its own account. Wire it to the Supabase `register → signUp` path already in `src/api/supabaseAdapter.js`. On signup, the `handle_new_user()` trigger auto-creates the family's `households` row (already verified working).
  - Constraint: the ~33 Base44-synced `src/` components must NOT be edited directly (two-way sync). A new/edited signup screen likely needs to go through the Base44 builder, not direct edits.
- [ ] **Google OAuth sign-in** — let families sign in with Google.
  - Supabase dashboard: enable the Google provider, add the OAuth client ID/secret, set the redirect URL.
  - Wire the UI "Sign in with Google" entry point (respect the no-edit constraint on synced components — route changes through Base44 if needed).

## Deferred from Supabase migration (see HANDOFF/supabase-migration-handoff_2026-06-17_2145.md)

- [ ] Email templates in Supabase dashboard: signup OTP + recovery → `/reset-password`.
- [ ] Port the 4 cron functions to Supabase Edge Functions.
- [ ] Migrate existing Base44 data into Supabase.
- [ ] (Optional hardening) Move the `uploads` storage bucket from public-read to a private bucket + signed URLs.
