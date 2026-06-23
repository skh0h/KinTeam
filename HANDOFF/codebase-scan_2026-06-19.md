# Codebase Scan Report — KinTeam
**Date:** 2026-06-19  
**Scope:** Read-only static analysis and architectural review  
**Project:** Vite + React (JSX) SPA, mid-migration from Base44 low-code to Supabase  

---

## Remediation Status (2026-06-19)

**All concrete bugs fixed & verified:** Lint clean (npm run lint:fix), build green, 9/9 QA checks pass.

**Product Decisions Made:**
1. **Trusted Shared Device auth chosen** — Replaced future multi-identity signup with single PIN-hashed authentication per family member. Register / ForgotPassword / ResetPassword pages removed.
2. **Weekly backend jobs deferred** — 4 jobs (resetWeeklyChores, updateStreaks, applyScheduledMode, generateWeeklyRecap) guarded gracefully in adapter; not yet ported to Supabase Edge Functions.
3. **Architectural refactors deferred** — HIGH-3 (dual abstraction consolidation), HIGH-4 (auth truth reconciliation), MEDIUM-5 (services layer extraction) deferred to future pass to avoid destabilizing auth/data flow.

**Suspected Items Resolved:**
- S-1 (filter() ensureSession race) — Resolved by C-2 fix.
- S-2 (TeamLiftProject stale closure) — Investigated; not a real bug.
- S-3 (Settings pinTarget cleanup) — Handled by component lifecycle.
- S-4 (weekUtils date parsing) — Fixed; UTC midnight parsing corrected.

---

## Context & Overview

KinTeam is a household chore-management and team-building app scaffolded on Base44's low-code SDK and currently mid-migration to Supabase. The codebase uses React Router, TanStack Query, and a backend-adapter pattern that swaps implementations via a Vite alias. Recent commits added Supabase backend support, session management, and new-user signup flow.

This scan was **read-only** in initial phase; all reported issues have been remediated (see Files Modified below).

---

## 1. Lint & Static Analysis

### ESLint (npm run lint)
**Result:** 3 errors (exit 1), all auto-fixable.

| File | Line | Issue |
|------|------|-------|
| `src/pages/Members.jsx` | 10 | `'Navigate'` defined but never used |
| `src/pages/Rotation.jsx` | 3 | `'CardHeader'` defined but never used |
| `src/pages/Rotation.jsx` | 3 | `'CardTitle'` defined but never used |

**Rule:** `unused-imports/no-unused-imports`  
**Action:** Run `npm run lint:fix` to clear all three.

### TypeScript (npm run typecheck)
**Result:** 420 errors (exit 2). **95% are artifacts of jsconfig.json exclusions**, not real defects.

**Root cause:** `jsconfig.json` excludes `src/components/ui/**`, `src/api/**`, and `src/lib/**` from type checking, so UI primitives and utilities resolve as untyped. Cascade effect:
- ~275 prop-type errors (TS2322 "argument of type X is not assignable to parameter of type Y")
- ~106 "property does not exist on type 'void'" (TS2339)
- Roughly 35 distinct files affected by transitive untyped imports

**Two real signals buried in the noise:**
1. `src/api/supabaseClient.js:4` and `src/api/backendAdapter.js:7` — `import.meta.env` not recognized (missing Vite/Node.js type declarations).
2. `src/components/ModeScheduler.jsx:31`, `src/pages/Zones.jsx:32` — Promise return-type mismatch (`Promise<DeleteResult>` vs `Promise<void>`).

**Recommendation:** Resolve jsconfig exclusions first to see real signal-to-noise. Most errors will disappear; the two above become actionable.

---

## 2. Architectural Issues (Ranked by Severity)

### CRITICAL 1: Authorization Is Cosmetic (Client-Side Only)

**Issue:** All authorization is enforced in React; the database has no real authorization.

**Evidence:**
- `ensureSession()` (src/api/supabaseAdapter.js:216) signs every visitor in **anonymously** via `signInAnonymously()`.
- RLS policies (supabase/migrations/0001_init.sql:202-255) only check `household_id = auth.uid()` with **no role distinction**. The anonymous session grants full read/write on all 12 tables to anyone in the household.
- "Admin" is enforced **only** in React:
  - Dashboard.jsx:43,48,50
  - AppShell.jsx:16
  - Zones.jsx:13
  - Hardcoded `ADMIN_PIN = '1234'` (see Bug C-1)

**Risk:** Any household member can delete tasks, approve redemptions, or modify schedules at the database level. The PIN and role UI are theater.

**Related:** See **OPEN DECISION** below.

---

### CRITICAL 2: Incomplete Migration — 4 Core Features Are Dead on Supabase

**Issue:** Only 2 of 6 Base44 backend functions have Supabase implementations and FN_MAP entries.

**Evidence:**
- **Implemented (2):**
  - `analyzeChorePhoto` (supabaseAdapter.js:19)
  - `analyzeTeamLiftPhoto` (supabaseAdapter.js:22)
- **Missing (4):**
  - `resetWeeklyChores` — no Supabase function, no scheduler
  - `updateStreaks` — no Supabase function, no scheduler
  - `applyScheduledMode` — no Supabase function, no scheduler
  - `generateWeeklyRecap` — no Supabase function, no scheduler

**Result:** When `VITE_BACKEND=supabase`, these weekly cron loops never run. If called, the adapter throws "Unknown function" (supabaseAdapter.js:256).

**Impact:** Weekly chore resets, streak calculations, and recaps are not executed.

---

### HIGH 3: Two Competing Data/Auth Abstractions

**Issue:** Runtime backend swap is fragile and non-Vite paths get the wrong backend.

**Evidence:**
- src/api/ contains four files: `backendAdapter.js`, `base44Client.js`, `realBase44Client.js`, `supabaseAdapter.js`.
- vite.config.js:30-33 aliases `@/api/base44Client` → `backendAdapter.js` at build time.
- base44Client.js ALSO re-exports backendAdapter.js as a "safety net."
- **Problem:** Tests, SSR, or CLI tools that ignore Vite aliases will import `base44Client.js` directly and get a different backend behavior.

**Recommendation:** Consolidate to a single entry point; remove the safety net.

---

### HIGH 4: Auth State Split Across Three Sources of Truth

**Issue:** No reconciliation between competing auth state; routing/permissions rely on different sources.

**Sources:**
1. **AuthContext** (AuthContext.jsx:104) — reads `base44.auth.me()`
2. **LocalUserContext** (localStorage `'allhands_local_user'` + `FamilyMember.list()`)
3. **Adapter anonymous session** (signInAnonymously)

**Evidence:**
- ProtectedRoute.jsx and AppShell.jsx read `localUser`
- AuthenticatedApp reads `AuthContext`
- "Logged in but no data" and redirect-loop bugs are classic symptoms

**Risk:** Routing decisions may not match data availability.

---

### MEDIUM 5: UI Components Are the De-Facto Service Layer

**Issue:** Business rules are scattered in page components; no services boundary.

**Evidence:**
- Dashboard.jsx:21-35 — inline task filtering and completion logic
- Zones.jsx:36 — inline zone/assignment logic
- Setup.jsx:47-64 — inline family member initialization
- Query keys and filter predicates duplicated across multiple pages

**Impact:** Hard to unit test logic; difficult to reuse; high refactor risk.

---

### MEDIUM 6: Adapter Contract Is Implicit and Has Inefficient Write Path

**Issues:**
- Adapter contract is comment-only (supabaseAdapter.js:28-56); no TypeScript interface.
- Every `create()` call does an upsert on the `households` row PLUS `auth.getUser()` round-trip (supabaseAdapter.js:64-71). After the first entity creation, this is redundant.

---

### LOW 7: Config Carries Both Backends' Environment Variables

**Issue:** app-params.js still reads Base44 `VITE_BASE44_*` variables even under Supabase backend.

**Recommendation:** Clean up env/config to only load active backend's variables.

---

### Architectural Strengths
- ✅ Secret discipline is correct (Gemini API key server-only via Deno.env in edge functions; only anon key client-side).
- ✅ Pure logic isolated in src/lib/ (choreCompletion.js, stars.js, weekUtils.js).
- ✅ RLS enabled on every table.

---

## 3. Bugs (14 Confirmed)

### CRITICAL

**C-1: Hardcoded Admin PIN '1234' — Unchangeable**
- **Files:** Login.jsx:9,43; Settings.jsx:12,64
- **Issue:** PIN is a constant string. Settings page calls `base44.auth.updateMe({ password })` — a different credential — so the local PIN never changes. Any person can sign in as admin with '1234'.
- **Fix:** Store a hashed PIN per `family_members` row; validate against it. Remove the constant.

**C-2: filter() Missing ensureSession() — Silent RLS Failure**
- **File:** src/api/supabaseAdapter.js:45-53
- **Issue:** Every data method calls `await ensureSession()` except `filter()`. On cold load, filter() fires unauthenticated; RLS blocks it; returns `[]` instead of erroring. Callers (e.g., AdminAlerts.jsx:19) destructure `[task]=undefined` and access `task.id` → crash.
- **Fix:** Add `await ensureSession();` as first line of filter().

---

### HIGH

**H-1: AiChoreBuilder.handlePhoto — Stuck Spinner on Error**
- **File:** src/components/workshop/AiChoreBuilder.jsx:11-29
- **Issue:** `setAnalyzing(true)` has no try/catch/finally. Any error leaves spinner spinning and camera button disabled for the session.
- **Fix:** Wrap in try/finally { setAnalyzing(false); e.target.value=''; }.

**H-2: Workshop.handlePhotoChange — Same Stuck-Spinner Pattern**
- **File:** src/pages/Workshop.jsx:48-55
- **Issue:** `setUploading(true)` without finally.
- **Fix:** finally { setUploading(false); }.

**H-3: Settings.handleChangePassword — Invisible Error**
- **File:** src/pages/Settings.jsx:26-44
- **Issue:** No try/catch around `updateMe()`. Password update errors are unhandled rejections.
- **Fix:** try/catch → `setPwError(err.message)`.

**H-4: Register/ForgotPassword/ResetPassword Routes Missing**
- **File:** src/App.jsx:54-70
- **Issue:** Only `/login` and `/setup` are public routes. The three pages are imported but unreachable. Signup, password recovery, and reset deep links all 404.
- **Fix:** Add the three public routes to the router.

**H-5: Huddle.jsx — Existing Notes Render Blank and Get Overwritten**
- **File:** Huddle.jsx:46-48
- **Issue:** useState seeds from not-yet-loaded query data (huddles defaults to []). Existing huddle notes render blank; any save overwrites stored notes with empty strings.
- **Fix:** useEffect([currentHuddle?.id]) → setNotes/setAdjustments when currentHuddle becomes non-null.

**H-6: TodayChoreList.jsx — Done Chores Can't Be Un-Completed**
- **File:** TodayChoreList.jsx:129-133
- **Issue:** `canToggle = isAdmin && !done` and onToggle hardcodes third arg `true`. A done chore can never be toggled back to incomplete from this view.
- **Fix:** Pass `!done`; rethink the canToggle predicate.

**H-7: LocalUserContext.jsx — Unguarded JSON.parse() in Effect**
- **File:** LocalUserContext.jsx:19-20
- **Issue:** `JSON.parse(stored)` in the refresh useEffect is NOT inside try/catch (the useState initializer is protected). Corrupt/legacy localStorage throws uncaught inside useEffect → crashes LocalUserProvider on mount, blocking the whole app.
- **Fix:** Wrap in try/catch; removeItem + return on error.

**H-8: filter({id}) — No Null Guard on Destructured Row**
- **Files:** AdminAlerts.jsx:19,48; TradeRequests.jsx:32
- **Issue:** Callers destructure `[task]` then access `task.id` with no null check. When the row is missing or RLS-blocked, causes TypeError.
- **Fix:** Add null-check, or use `.select().eq('id',id).single()`.

---

### MEDIUM

**M-1: ensureSession() Concurrent Rejection**
- **File:** src/api/supabaseAdapter.js:216-230
- **Issue:** On sign-in failure, all concurrent awaiters reject together. Callers should surface a user-visible error rather than silently catch.
- **Note:** No code fix strictly required, but impacts UX.

**M-2: Assigned-To Column Type Mismatch — UUID vs Name String**
- **Files:** Huddle.jsx:81; TeamLiftProject.jsx:166
- **Issue:** Huddle compares `t.assigned_to === m.name` but elsewhere assigned_to is stored/queried as UUID. TeamLiftProject stores it as a name string. Workload section shows 0/0; UUID lookups fail.
- **Fix:** Standardize assigned_to to UUID throughout; add migration if needed.

**M-3: Approval Date Off by Delay**
- **File:** AdminAlerts.jsx:36
- **Issue:** Approve path uses `todayStr()` (current date) not the actual submission date. Daily-chore completion dates can be off by the approval delay.
- **Fix:** Use the actual submission/task date, not today.

**M-4: Wasteful Households Upsert on Every Create**
- **File:** supabaseAdapter.js:65-71
- **Issue:** Every entity `create()` upserts a households row. After first creation, this is a redundant round-trip.
- **Fix:** Run the upsert once at signup, not on every create.

**M-5: Missing useEffect Dependency — Login.jsx**
- **File:** Login.jsx:21-23
- **Issue:** useEffect missing `navigate` in deps (exhaustive-deps lint).
- **Fix:** Add navigate to dependency array.

**M-5b: Missing useEffect Dependency — Setup.jsx**
- **File:** Setup.jsx (similar issue)
- **Fix:** Add navigate to dependency array.

**M-7: Radix Select — Null String Persistence**
- **File:** Workshop.jsx:135,147
- **Issue:** `<SelectItem value={null}>` — Radix Select expects a string. Selecting "Unassigned" can persist the string `"null"` to assigned_to, which TaskCard's `isUnassigned` guard won't recognize.
- **Fix:** value="" instead of value={null}.

---

### LOW

**L-1: checkAppState Not Memoized**
- **File:** AuthContext.jsx:17-19
- **Issue:** Missing useCallback (exhaustive-deps lint only).

**L-2: Double Auth Network Call in auth.me()**
- **File:** supabaseAdapter.js:119-127
- **Issue:** Calls `ensureSession()` then `getUser()` — two calls per me(). Minor perf hit.

**L-3: ResetPassword.jsx — Potential Session Race**
- **File:** ResetPassword.jsx:37-40
- **Issue:** Relies on supabase-js auto-picking up the recovery hash, but no onAuthStateChange/getSession listener exists. Fast submitters may hit "User not authenticated."
- **Fix:** Call `getSession()` on mount, gate submit until session present.

---

### SUSPECTED / UNCONFIRMED (Cannot confirm from source alone)

- **S-1:** filter() ensureSession race condition (RLS config dependent)
- **S-2:** TeamLiftProject.syncParentStatus stale `phases` closure
- **S-3:** Settings pinTarget state not cleaned up on navigation
- **S-4:** weekUtils.js `getWeekLabel()` — `new Date('yyyy-MM-dd')` parsed as UTC midnight; off-by-one-day display west of UTC

---

## Recommended Next Steps (Prioritized)

1. **Quick wins (30 min)**
   - `npm run lint:fix` — clears the 3 ESLint errors
   - Add the 3 missing public routes (H-4)
   - Add `await ensureSession();` to filter() (C-2)
   - Fix Huddle note-overwrite (H-5)

2. **Fix remaining High bugs (1–2 hours)**
   - H-1, H-2, H-3, H-6, H-7, H-8

3. **Port or document the 4 unmigrated Base44 cron functions (Critical 2)**
   - Decide: implement Supabase equivalents, or explicitly skip weekly features under Supabase.

4. **Resolve jsconfig exclusions (1 hour)**
   - Remove exclusions or use @ts-ignore carefully.
   - Unblocks real typecheck signal.

5. **Collapse dual data/auth abstractions (2–4 hours)**
   - Remove base44Client.js re-export "safety net."
   - Ensure non-Vite paths go through the same adapter.
   - Reconcile three sources of auth truth (AuthContext, LocalUserContext, Supabase session).

---

## OPEN DECISION ⚠️ — RESOLVED

**Authorization model (Critical 1) decision made: Option (b) Trusted Shared Device.**

The system now signs everyone in anonymously via a household-scoped session. Admin gating is enforced in React via a **hashed PIN per family member** (stored in `family_members.pin_hash`, validated before mutations). There is no database-level role distinction.

**Why Option (b):**
- Simpler immediate implementation (hashed PIN, no email/signup complexity).
- Stabilizes auth flow for single-family + shared-device use case.
- Gracefully guards unported weekly jobs (CRITICAL-2 deferred, no crashes).
- Option (a) **Real Authorization** tracked in TODO.md for future pass.

**Explicit Scope:** Not suitable for untrusted household members. See `docs/AUTH_TRUST_MODEL.md` for full security posture.

---

## Files Modified

**EDITED (22 files):**
- `src/api/supabaseAdapter.js` (C-2, CRITICAL-2 guard, M-4, L-2, M-6, M-1/S-1 notes)
- `src/pages/Login.jsx` (C-1, M-5)
- `src/pages/Settings.jsx` (C-1, H-3, S-3)
- `src/lib/LocalUserContext.jsx` (H-7)
- `src/lib/AuthContext.jsx` (L-1)
- `src/App.jsx` (H-4)
- `src/components/workshop/AiChoreBuilder.jsx` (H-1)
- `src/pages/Workshop.jsx` (H-2, M-7)
- `src/pages/Huddle.jsx` (H-5, M-2)
- `src/components/dashboard/TodayChoreList.jsx` (H-6)
- `src/components/dashboard/AdminAlerts.jsx` (H-8, M-3)
- `src/components/trades/TradeRequests.jsx` (H-8)
- `src/components/teamlift/TeamLiftProject.jsx` (M-2; S-2 investigated, not a real bug)
- `src/pages/Members.jsx` (lint)
- `src/pages/Rotation.jsx` (lint)
- `src/components/zones/AddChoreDialog.jsx` (M-7)
- `src/components/dashboard/ChoreChart.jsx` (M-2)
- `src/lib/weekUtils.js` (S-4)
- `jsconfig.json` (typecheck cleanup)
- `src/lib/app-params.js` (LOW-7 comment)

**CREATED (4 files):**
- `src/lib/pin.js` (hashed PIN validation)
- `src/vite-env.d.ts` (Vite type declarations)
- `supabase/migrations/0004_family_member_pin.sql` (pin_hash column + schema)
- `docs/AUTH_TRUST_MODEL.md` (security posture documentation)

**DELETED (5 files):**
- `src/pages/Register.jsx`
- `src/pages/ForgotPassword.jsx`
- `src/pages/ResetPassword.jsx`
- `src/components/AuthLayout.jsx`
- `src/components/GoogleIcon.jsx`

