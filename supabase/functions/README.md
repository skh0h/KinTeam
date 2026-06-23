# KinTeam Supabase Edge Functions

All functions live under `supabase/functions/<name>/index.ts`.

---

## Functions Overview

| Name | Trigger | verify_jwt | Purpose |
|---|---|---|---|
| `analyze-chore-photo` | User (HTTP POST) | true | Gemini vision: generate chore card from photo |
| `analyze-team-lift-photo` | User (HTTP POST) | true | Gemini vision: generate team-lift task from photo |
| `apply-scheduled-mode` | Cron (daily 05:05 UTC) | false | Apply/revert scheduled household modes |
| `update-streaks` | Cron (daily 05:10 UTC) | false | Increment/reset per-member streak counts |
| `reset-weekly-chores` | Cron (Monday 05:15 UTC) | false | Reset routine tasks for the new week |
| `generate-weekly-recap` | Cron (Monday 05:20 UTC) | false | Compute weekly stats and MVP; insert weekly_recaps row |

---

## Deploying Functions

CLI owner access is required for deployment. Each function is deployed individually:

```bash
supabase functions deploy analyze-chore-photo
supabase functions deploy analyze-team-lift-photo
supabase functions deploy apply-scheduled-mode
supabase functions deploy update-streaks
supabase functions deploy reset-weekly-chores
supabase functions deploy generate-weekly-recap
```

---

## Cron Function Security (CRON_SECRET)

The four cron functions run with `verify_jwt = false` (the scheduler has no user JWT). They are protected instead by a shared secret sent in the `x-cron-secret` HTTP header.

### Setup (one-time, required before applying migration 0003)

**Step 1 — Generate a secret:**
```bash
openssl rand -hex 32
# example output: a3f8c2...  (keep this value)
```

**Step 2 — Set it as a Supabase Function secret:**
```bash
supabase secrets set CRON_SECRET=<your-generated-value>
```

**Step 3 — Store the same value in Supabase Vault** (so pg_cron SQL can read it):

Run in the Dashboard SQL editor:
```sql
select vault.create_secret('<same-value>', 'cron_secret');
```

The name must be exactly `cron_secret` (lowercase). The value must match `CRON_SECRET` exactly.

**Step 4 — Enable pg_cron and pg_net extensions:**

Dashboard -> Database -> Extensions -> search "cron" -> Enable
Dashboard -> Database -> Extensions -> search "net" -> Enable

These cannot be enabled via DDL on hosted Supabase; the Dashboard toggle is required.

---

## Applying the Cron Migration

`supabase/migrations/0003_schedule_cron.sql` schedules the four cron jobs via `pg_cron`. It must be applied after the steps above.

```bash
supabase db push
```

Or paste the file contents into Dashboard -> SQL Editor and run it manually.

The migration is idempotent: it unschedules existing jobs before re-creating them, so re-running is safe.

---

## Cron Schedule

All times are UTC. America/New_York is UTC-5 (EST) or UTC-4 (EDT); 05:xx UTC is approximately midnight–1am ET.

| Job name | Cron (UTC) | ET intent |
|---|---|---|
| `kinteam-apply-scheduled-mode` | `5 5 * * *` | Daily, ~midnight ET |
| `kinteam-update-streaks` | `10 5 * * *` | Daily, ~midnight ET (after apply-mode) |
| `kinteam-reset-weekly-chores` | `15 5 * * 1` | Monday only, ~midnight ET |
| `kinteam-generate-weekly-recap` | `20 5 * * 1` | Monday only, after reset |

The Monday ordering matters: reset clears task `status`/`week_of`, then recap reads `completed_dates` (a persistent JSONB array not cleared by reset) to compute the previous week's stats.

---

## Multi-Tenant Behavior

Each cron function:
1. Loads all rows from `public.households` using the service-role client (bypasses RLS).
2. Loops over every household and runs the per-household logic, filtering all queries by `household_id`.
3. Collects per-household results; a failure in one household does not abort the others.
4. Returns `{ ok: true, processed: N, results: [...] }`.

This replaces the Base44 single-family model (where one auth user = one household and the function ran in that user's context). The service-role client is used solely for this cross-tenant iteration; no user data crosses household boundaries.

---

## Shared Helpers (`_shared/cron.ts`)

`supabase/functions/_shared/cron.ts` provides:

- `assertCronSecret(req)` — validates `x-cron-secret` header; throws a 401 Response on failure
- `serviceClient()` — Supabase client with service-role key, no session persistence
- `nyNow()` / `nyToday()` / `nyYesterday()` — current date/time helpers in America/New_York
- `mondayOf(date)` / `weekOfMonday()` / `weekDatesFrom(monday)` — week computation helpers
- `DAY_NAMES` — `['sunday', 'monday', ...]` array for day-name lookups
- `jsonResponse(body, status)` / `CORS_HEADERS` — consistent response helpers

---

## Environment Variables

| Variable | Where set | Used by |
|---|---|---|
| `SUPABASE_URL` | Auto-injected by runtime | All functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by runtime | Cron functions (service client) |
| `CRON_SECRET` | `supabase secrets set` | Cron functions (auth header check) |
| `GEMINI_API_KEY` | `supabase secrets set` | analyze-chore-photo, analyze-team-lift-photo |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase Edge Runtime and do not need to be set manually.
