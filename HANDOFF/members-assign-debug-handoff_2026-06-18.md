# Handoff — "New user cannot assign members" debugging session

**Date:** 2026-06-18
**App:** KinTeam (a.k.a. "All-Hands") — Vite + React, migrated from Base44 SDK → Supabase backend
**Related:** see `supabase-migration-handoff_2026-06-17_2145.md` (the migration that introduced this)
**Status:** ~90% resolved. Auth/session root causes fixed. ONE structural issue remains (likely a bootstrap deadlock) — needs a 1-line confirmation then a small fix.

---

## 1. Original symptom

A brand-new user cannot assign/add a family member. The "Add Member" action **fails silently** — no member saved, no error shown. Reported as happening from "the first page."

---

## 2. What we found (the bug was layered — peeled one at a time)

The silent failure had **multiple stacked causes**, fixed in order:

1. **Silent UX** — the add-member mutation had no `onError`, so any failure was swallowed with zero feedback.
2. **Base44 leftovers** — after the Supabase migration, the Base44 SDK was still being instantiated and firing analytics/auth calls to `apps/null` (404s), because `VITE_BASE44_APP_ID` is intentionally unset. Pure noise, but cluttered the console and obscured the real error.
3. **No Supabase auth session (the real blocker)** — the app has **two decoupled identity layers**:
   - **Supabase auth** (`supabase.auth.*`) — required by the database's RLS (`with check (household_id = auth.uid())`). It was **never established** for a normal user.
   - **LocalUserContext** (`localStorage 'allhands_local_user'`) — a family-member/PIN switcher, which is the **only** thing guarding the `/members` route.
   A user passed the route guard via the local profile but had **no Supabase session**, so `auth.uid()` was null and every write was rejected by RLS — silently (`list()` returns `[]` under RLS instead of erroring; a `.catch(()=>{})` in LocalUserContext swallowed errors).
4. **Supabase dashboard toggle** — the chosen fix (anonymous sign-in) requires "Allow anonymous sign-ins" to be ENABLED on the Supabase project. It was disabled (confirmed via direct curl → `422 anonymous_provider_disabled`). User has since enabled + saved it.

---

## 3. Changes made (all in working tree — verify with `git diff`)

| File | Change |
|---|---|
| `src/pages/Members.jsx` | Added `import { toast } from '@/components/ui/use-toast'` and an `onError` handler on the `addMember` mutation → failures now show a destructive toast instead of being silent. |
| `src/api/supabaseAdapter.js` | (a) `create()` now upserts a `households` row `{id: user.id}` (onConflict id) before inserting, as an FK safety net. (b) `ensureSession()` (was a no-op) now: `getSession()`; if none, `signInAnonymously()`; throws on error so it surfaces. Has a module-level `_ensureSessionPromise` concurrency guard. (c) `ensureSession()` is now called at the top of `list()`, `create()`, `update()`, `delete()`, and `auth.me()`. |
| `src/api/realBase44Client.js` | Converted from a top-level `createClient()` call to a lazy `getRealBase44()` factory → Base44 SDK no longer auto-instantiates (kills the analytics 404 stragglers). |
| `src/api/backendAdapter.js` | Calls `getRealBase44()` only in the non-supabase branch. `export const base44` still resolves synchronously to the Supabase adapter when `VITE_BACKEND=supabase`. |
| `vite.config.js` | `@base44/vite-plugin` `analyticsTracker: true` → `false` (stops the HTML-injected tracker hitting `apps/null`). |
| `src/lib/LocalUserContext.jsx` | Replaced `.catch(() => {})` (~line 27) with `.catch(err => console.warn(...))` so failures are visible. |

`npm run build` passes after all changes.

---

## 4. Current state (verified from a live screenshot + network tab)

- ✅ Anonymous Supabase session is created on load. `GET .../rest/v1/family_members?select=*` returns **200** (empty list for the new anonymous household).
- ✅ No more `401 Not authenticated`, no more `apps/null` 404s, no more `signInAnonymously 422`.
- ⚠️ User is parked on **`http://localhost:5180/login`** — the "Who are you? / No family members set up yet" screen — with an orange **"Add Members →"** button. Clicking it / trying to add a member **still appears to do nothing**.

---

## 5. REMAINING OPEN ISSUE — likely bootstrap deadlock

**Hypothesis (high confidence, not yet 100% confirmed):**
`/members` is gated by `ProtectedRoute` which requires a selected local family member (`LocalUserContext` / `localStorage 'allhands_local_user'`). A brand-new user has **zero** members → no local user → clicking "Add Members →" navigates to `/members`, the guard immediately redirects back to `/login`. Net effect: the click looks like it does nothing ("silent fail").

**Chicken-and-egg:** you can't add the first member because the add-member page requires you to have already picked a member.

### To CONFIRM (free — no agent/LLM cost):
Manually click "Add Members →" and read the **address bar URL** afterward. Or run this `repro.mjs` (`node repro.mjs`, uses the global `playwright` already present):

```js
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false });
const p = await b.newPage();
const msgs = []; const nets = [];
p.on('console', m => msgs.push(m.text()));
p.on('response', r => { if (r.url().includes('family_members')) nets.push(`${r.status()} ${r.url()}`); });
await p.goto('http://localhost:5180/login', { waitUntil: 'networkidle' });
console.log('URL after /login load:', p.url());
await p.click('text=Add Members');
await p.waitForTimeout(1000);
console.log('URL after click:', p.url());
console.log('Page text:', await p.evaluate(() => document.body.innerText.slice(0, 400)));
console.log('Console:', msgs);
console.log('family_members network:', nets);
await b.close();
```

- **`URL after click:` = `/login`** → deadlock CONFIRMED.
- **`URL after click:` = `/members` with a form** → different bug; capture the `family_members network:` POST status/body.

### Proposed fix (once confirmed):
Allow the **first-ever** member to be added without requiring an existing `localUser`. Options for the Engineer to evaluate:
- Make the "Add Members →" path route to an **unguarded** add-first-member flow (or a `/members` variant that bypasses the local-user gate when zero members exist).
- Or relax `ProtectedRoute` to permit the add-member screen when `FamilyMember.list()` is empty (bootstrap state).
Keep the guard for all other routes. This should be the final piece.

---

## 6. Required external config (do not lose this)

**Supabase project `djnhsgfldbizgqfdpayn`** must keep **"Allow anonymous sign-ins" ENABLED**
(Authentication → Sign In / Providers → Anonymous). If it gets turned off, the app hard-fails to a spinner on every load (every page tries and fails the anonymous sign-in). Confirmed-working state requires this toggle ON + saved.

> Design note: anonymous auth was chosen to match the "shared family device, one Supabase identity per household + local PIN switching" model. Anonymous sessions are upgradeable to real email identities later via the existing `Register.jsx` → `signUp` → `verifyOtp` flow (Supabase preserves `auth.uid()` on upgrade). If anonymous auth is undesirable, the alternative is to enforce real login (require a Supabase session in `ProtectedRoute` and wire the login form) — a larger UX change.

---

## 7. Key architecture reference (file:line)

- First page / routes: `src/App.jsx:57` (`/` → `Dashboard`); members at `/members` → `src/pages/Members.jsx`.
- Route guard: `src/components/ProtectedRoute.jsx` — gates on `localUser` from `LocalUserContext`, **not** on the Supabase session.
- Backend selection: `src/api/backendAdapter.js` — `VITE_BACKEND === 'supabase' ? supabaseBase44 : getRealBase44()`. Vite aliases `@/api/base44Client` → `backendAdapter.js` (`vite.config.js`).
- Supabase client: `src/api/supabaseClient.js` (`persistSession: true`, `autoRefreshToken: true` — correct).
- DB schema/RLS: `supabase/migrations/0001_init.sql` — `family_members.household_id` defaults to `auth.uid()`, FKs `households(id)`; RLS `with check (household_id = auth.uid())`; `handle_new_user` trigger creates a `households` row on auth signup.
- Env: `.env.local` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND=supabase`. `VITE_BASE44_APP_ID` is intentionally unset.

---

## 8. Next-session checklist

1. Confirm the deadlock (§5) — get the post-click URL.
2. If confirmed: implement the bootstrap add-first-member path (§5 fix).
3. Verify end-to-end: from a cleared `localStorage`, add a member → it persists → it appears in the list → a new anonymous user shows under Supabase Auth → Users.
4. Re-test the real `Register.jsx` OTP flow still works (anonymous → registered upgrade).
5. Cosmetic cleanups (optional, low priority): malformed `public/manifest.json` ("Line: 1 Syntax error"); React Router v7 future-flag warnings.

---

## 9. Session note

This session ran up significant LLM cost (~$113) because the bug surfaced in layers — each fix revealed the next cause underneath. The remaining step (§5) is a free manual confirmation followed by a small, well-scoped code change. Start there.
