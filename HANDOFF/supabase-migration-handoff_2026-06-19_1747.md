# KinTeam — Supabase Migration Handoff (takeover)

_Last updated: 2026-06-19 17:47_

## TL;DR
Supabase is now the **working runtime backend**. The prior blocker (Edge Function deploy 403) is **resolved** — both AI edge functions are deployed and the full stack is verified end-to-end. No code blockers remain. Everything left is deferred enhancement + hardening, tracked in `TODO.md` and below.

## What the last session did
- **Diagnosed the deploy 403**: it is a **Supabase permission** problem, NOT a code or API-key problem. The account used for `supabase login` is **not Owner/Admin** on the project, so the Management API rejects `functions deploy` and `functions list` (the same token CAN read `projects list` and set secrets).
- **Deployed both functions via the Dashboard UI** (Path A — bypasses the broken CLI permission), Verify JWT ON:
  - `analyze-chore-photo`
  - `analyze-team-lift-photo`
  - Gotcha: pasting into the editor's default boilerplate caused `Expression expected` at line 92. Fix = Cmd+A → delete everything → paste clean code → deploy.
- **Verified end-to-end** with `npm run dev` (`VITE_BACKEND=supabase`) at http://localhost:5180:
  - Login ✅ · create chore (data + RLS tenant scoping) ✅ · photo upload (per-family storage path) ✅ · AI photo analysis (edge fn + Gemini secret, end-to-end) ✅
  - `households` signup trigger confirmed **indirectly**: a chore insert succeeds under `household_id uuid not null references households(id)`, which is only possible if the family's `households` row already exists.
- Updated `TODO.md` with the auth roadmap + deferred items.

## Current state
| Layer | Status |
|-------|--------|
| Edge functions (AI) deployed | ✅ via Dashboard UI |
| Auth (email/password login) | ✅ verified |
| Data + RLS tenant scoping | ✅ verified |
| Storage (per-family upload) | ✅ verified |
| AI photo analysis (edge fn + Gemini) | ✅ verified end-to-end |
| `households` signup trigger | ✅ confirmed (FK on chore insert) |

## How to run / where things live
- **Local env:** `.env.local` (gitignored) already set: `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable/anon key — browser-safe).
- **Dev server:** `npm run dev` → http://localhost:5180 (strict port).
- **Backend selection:** `src/api/backendAdapter.js` → `VITE_BACKEND === 'supabase'` picks `supabaseAdapter`, else `realBase44Client`. Vite alias in `vite.config.js`: `@/api/base44Client` → `src/api/backendAdapter.js` (reroutes all ~33 component imports — no component edits needed).
- **Supabase client:** `src/api/supabaseClient.js` = `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.
- **Adapter behavior:** `src/api/supabaseAdapter.js` — register→`signUp`, login→`signInWithPassword`; `create()`/`update()` strip `household_id` so the DB default stamps the tenant; `UploadFile()` writes to `<auth.uid()>/<uuid>.<ext>` for storage RLS.

## Project coordinates
- Supabase project ref: `djnhsgfldbizgqfdpayn`
- URL: `https://djnhsgfldbizgqfdpayn.supabase.co`
- Functions dashboard: https://supabase.com/dashboard/project/djnhsgfldbizgqfdpayn/functions
- supabase CLI v2.107.0; `@supabase/supabase-js` v2.108.2

## Recommendations for the next agent (prioritized)
1. **Fix CLI Owner access** so future deploys work from the repo instead of dashboard copy-paste. The `supabase login` account isn't Owner/Admin → `functions deploy` 403s. This matters because **4 cron functions still need porting** and dashboard-pasting each is painful/error-prone (see the line-92 gotcha). Resolve org roles once, then `supabase functions deploy --project-ref djnhsgfldbizgqfdpayn` works.
2. **Harden storage BEFORE real families onboard (privacy, not optional).** The `uploads` bucket is **public-read** and this app stores photos of children/the home. Move to a private bucket + signed URLs.
3. **Add a committed `.env.example` (currently MISSING).** The reversibility-by-default requirement isn't actually met on disk — there is no committed example env. Add one defaulting `VITE_BACKEND=base44`, placeholders only, NO secrets.
4. **Prove the Base44 fallback still boots.** Flip `VITE_BACKEND=base44` and confirm the app runs — "reversible via one flag" is currently untested.
5. **Secrets hygiene:** delete the unused Personal Access Token at https://supabase.com/dashboard/account/tokens; **rotate the Gemini key** (it was pasted into a prior chat transcript) at https://aistudio.google.com/apikey.
6. **Edge-function SSRF surface (minor):** both functions do `fetch(file_url)` on a URL from the request body. Verify JWT is ON so only authed families can call it, but constrain `file_url` to the Supabase storage domain when next touched.

## Open / deferred (also in TODO.md)
- **Family self-serve sign-up** — logged-out registration screen; wire to the existing `register → signUp` path; `handle_new_user()` trigger auto-creates the `households` row. Must go through the **Base44 builder**, not direct component edits.
- **Google OAuth sign-in** — Supabase dashboard: enable Google provider + client ID/secret + redirect URL; UI entry point via Base44.
- **Email templates** — signup OTP + recovery → `/reset-password`.
- **Port the 4 cron functions** to Supabase Edge Functions.
- **Migrate existing Base44 data** into Supabase.
- **Storage hardening** (see recommendation #2).

## Hard constraints (do not violate)
- **Never** request/paste/store the `service_role`/secret key or the DB password. Only the publishable/anon key is browser-safe.
- **Do NOT edit** the ~33 Base44-synced `src/` components, `base44/entities/*.jsonc`, or `base44/functions/*` originals (two-way sync into the Base44 builder).
- `GEMINI_API_KEY` lives **only** as a Supabase secret — never in committed files or the browser.
- Committed example env files must default `VITE_BACKEND=base44`.
- Migration must stay reversible: flip `VITE_BACKEND`; zero component edits.

## Loose ends to close
- Delete the unused PAT (`sbp_…`) at the account tokens page.
- (Recommended) rotate the Gemini API key.

## Cost note
This session ~$81 (prior sessions ~$128, ~$167). Remaining work is mostly user dashboard/account actions plus a few cheap code tasks — keep sessions lean.
