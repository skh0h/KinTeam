# Scan Remediation — Deferred Items (2026-06-20)

Items from the 2026-06-19 codebase scan that were NOT fixed in this code session, with rationale.

---

## Deferred Items

### Item #2 — Storage bucket is public-read

**Status:** Deferred to operator.  
**Why:** Flipping the `uploads` bucket from `public = true` to `public = false` requires a Dashboard action (SQL Editor: apply `0002_private_uploads.sql`), not a code change. It also requires confirming signed URLs work for Edge Function photo uploads before the flip, to avoid breaking the photo-analysis flow. Cannot be done safely in an automated code session.  
**See:** Runbook Phase 1 in `HANDOFF/auth-overhaul-runbook_2026-06-20.md`.

---

### Item #10 — RLS cutover and OAuth enablement

**Status:** Deferred; multi-phase, operator-gated.  
**Why:** The RLS cutover is a breaking identity inversion (`households.id` stops equalling `auth.uid()`). It requires: a DB backup, a data migration, a frontend deploy, and a coordinated sequence of Dashboard toggles before the policy DDL can be applied safely. No part of this can be applied automatically. Applying Phase 5 (RLS DDL) before Phase 4 (data migration) is complete will lock all households out of their data.  
**See:** All phases in `HANDOFF/auth-overhaul-runbook_2026-06-20.md`.

---

### Cron Edge Functions — Intentionally Deferred

**Status:** Deferred; architectural constraint, not a scan finding gap.  
**Why:** The five cron functions (`apply-scheduled-mode`, `update-streaks`, `reset-weekly-chores`, `generate-weekly-recap`, `roll-events`) are invoked directly by `pg_cron` via the Supabase internal scheduler hitting the Edge Function HTTP endpoints. They do not go through the frontend adapter and are not affected by the auth identity inversion. Changing their household-iteration logic before the data migration is complete would be premature and risky. They remain DEFERRED until Phase 4 and Phase 5 are verified complete.

---

## Items Fixed in This Session

- Migration 0009: additive schema additions (`owner_uid`, `auth_uid`, index, `current_member_context()` helper) — safe to apply now.
- Runbook and phase ordering documented to prevent the data-loss scenario (Phase 5 before Phase 4).
