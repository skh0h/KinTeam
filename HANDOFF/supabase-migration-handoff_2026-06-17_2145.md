# KinTeam — Supabase Migration Handoff

_Last updated: 2026-06-17_

## Goal

Make **Supabase the main runtime backend** for KinTeam (a family-chores app): data + auth +
storage + Gemini AI functions. Keep **Base44 usable as a visual builder ("standby")**. The
migration must stay **reversible via one env flag (`VITE_BACKEND`)** and must NOT edit the
~33 Base44-synced component files.

## Architecture (already built)

- A backend adapter sits behind a Vite `resolve.alias` in `vite.config.js`:
  `@/api/base44Client` → `src/api/backendAdapter.js`.
- `backendAdapter.js` picks the backend by env flag:
  - `VITE_BACKEND=supabase` → `src/api/supabaseAdapter.js`
  - otherwise → `src/api/realBase44Client.js` (Base44).
- Committed example env files must **default `VITE_BACKEND` to `base44`** (Supabase is opt-in).
- The ~33 `src/` components, `base44/entities/*.jsonc`, and `base44/functions/*` originals are
  **two-way-synced into the Base44 builder — do NOT edit them.**

## Multi-tenant model ("family accounts")

Chosen model: **shared account per family.** One Supabase auth account per family; members share
that login. The family's `auth.uid()` is the tenant key. RLS isolates each family's data.

- `households` table is keyed to `auth.users(id)`, auto-created on signup via a
  `handle_new_user()` trigger (security definer).
- Every data table has `household_id uuid not null default auth.uid() references households(id)`.
- RLS on every table: `using (household_id = (select auth.uid())) with check (...)`.
- Storage: per-family folders, scoped by `(storage.foldername(name))[1] = (select auth.uid())::text`.

## Project coordinates

- Supabase project ref: `djnhsgfldbizgqfdpayn`
- Supabase URL: `https://djnhsgfldbizgqfdpayn.supabase.co`
- supabase CLI v2.107.0; `@supabase/supabase-js` v2.108.2

---

## ✅ DONE

1. **Schema applied** — `supabase/migrations/0001_init.sql` ran successfully in the Supabase SQL
   Editor. Creates `households` + auto-create trigger, 11 data tables, the `uploads` storage
   bucket, and per-family RLS on all 12 tables + storage. (Syntax-fixed: storage policies use
   `(storage.foldername(name))[1]` with outer parens.)
2. **Adapter code** — `src/api/supabaseAdapter.js`: register→`signUp`, login→`signInWithPassword`;
   `create()`/`update()` strip `household_id` so the DB default stamps the tenant; `UploadFile()`
   writes to a per-family path `<auth.uid()>/<uuid>.<ext>` to satisfy storage RLS.
3. **Gemini secret** — `GEMINI_API_KEY` is **set as a Supabase secret** (value lives only in
   Supabase, not in this repo). The CLI was able to set secrets successfully.
4. **CLI auth** — `supabase projects list` shows the project; the token can read the project and
   write secrets.

---

## ⛔ BLOCKED — Edge Function deploy (the one remaining Gemini step)

Both functions still need deploying:
- `supabase/functions/analyze-chore-photo/index.ts`
- `supabase/functions/analyze-team-lift-photo/index.ts`

(Both files exist, are non-empty, Deno runtime: `Deno.serve` + `Deno.env.get('GEMINI_API_KEY')`.)

**Error:** `supabase functions deploy ...` → `403 "Your account does not have the necessary
privileges to access this endpoint."`

**Diagnosis:** This is a **Supabase deploy-permission** problem, **NOT** an API-key problem.
The same CLI token *can set secrets* but *cannot deploy functions* — different Supabase Management
API endpoints with different permission checks. The Gemini key is valid and unrelated to this 403.

### Fix — pick one path

**Path A — Dashboard UI (most reliable; bypasses the broken CLI token):**
1. Open `https://supabase.com/dashboard/project/djnhsgfldbizgqfdpayn/functions`
2. Create a new function named exactly `analyze-chore-photo`; paste the contents of
   `supabase/functions/analyze-chore-photo/index.ts`; deploy.
3. Repeat for `analyze-team-lift-photo` with that file's contents.
4. Confirm `GEMINI_API_KEY` is present under Edge Functions → Secrets (it already is).

**Path B — Re-login as Owner + CLI:**
1. Create a Personal Access Token at `https://supabase.com/dashboard/account/tokens`
   **using the account that OWNS the project** (Owner/Administrator role).
2. `supabase login` and paste that token.
3. Verify: `supabase projects list` shows `djnhsgfldbizgqfdpayn`.
4. Deploy (keep JWT verification ON — the app calls these as an authenticated family account):
   ```
   supabase functions deploy analyze-chore-photo     --project-ref djnhsgfldbizgqfdpayn
   supabase functions deploy analyze-team-lift-photo --project-ref djnhsgfldbizgqfdpayn
   supabase functions list --project-ref djnhsgfldbizgqfdpayn
   ```
   If it **still** 403s, the logged-in account is not Owner/Admin on the project → use Path A.

---

## 🔜 AFTER FUNCTIONS DEPLOY

1. **Dashboard config (user does):**
   - Google OAuth provider + redirect URL.
   - Email templates: signup OTP, recovery → `/reset-password`.
2. **Verify end-to-end** with `npm run dev` and `VITE_BACKEND=supabase`:
   - Set client env: `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=https://djnhsgfldbizgqfdpayn.supabase.co`,
     `VITE_SUPABASE_ANON_KEY=<publishable/anon key>` (browser-safe).
   - Register a family → confirm a `households` row is auto-created (trigger).
   - Log in; create a task; confirm it's scoped to the family (RLS).
   - Upload a photo → confirms per-family storage path + policy.
   - Run an AI photo analysis → confirms the edge function + Gemini secret work end-to-end.
3. **Deferred follow-ups:** port the 4 cron functions; migrate existing Base44 data;
   (optional) harden storage to a private bucket + signed URLs (currently `uploads` is public-read).

---

## 🔒 Hard constraints (do not violate)

- The anon/publishable key is browser-safe. **NEVER request, paste, or store the `service_role`
  key or the database password.**
- **Do NOT edit** the ~33 `src/` components, `base44/entities/*.jsonc`, or `base44/functions/*`
  originals (they two-way-sync into Base44).
- `GEMINI_API_KEY` lives **only** as a Supabase secret — never in committed files or the browser.
- Committed example env files default `VITE_BACKEND=base44`.
- Migration must stay reversible: flip `VITE_BACKEND` to switch backends; zero component edits.

## ⚠️ Notes

- **Security:** the Gemini API key was pasted into the chat transcript during this session. It is
  only used server-side (Supabase secret), but if this transcript is ever shared, rotate the key
  at `https://aistudio.google.com/apikey`.
- **Cost:** this session reached ~$167 (prior session ~$128). Keep future sessions lean — the
  remaining work is mostly user dashboard/CLI actions, not agent spend.
