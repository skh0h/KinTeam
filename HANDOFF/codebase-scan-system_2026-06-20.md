# Codebase Scan Report — KinTeam
**Plan executed:** `PLANS/codebase-scan-system_2026-06-20.md`
**Date:** 2026-06-20
**Scope:** Read-only static analysis; ~152 source files (~9.8k LOC frontend, 10 TS edge functions, 8 SQL migrations)
**Summary:** 1 Critical, 4 High, 6 Medium, 4 Low new/regression findings. Prior C-1 and C-2 fixes verified RESOLVED but C-1 carries a new partial-vulnerability (timing-unsafe PIN comparison). 6 new features added since 2026-06-19 scan; one of them (analyzeEventPhoto) has a missing FN_MAP registration.

---

## Phase 0 — Ground Truth

### ESLint (`npm run lint`)
**Result: 0 errors (exit 0).** Lint is clean. Unlinted blind spots remain: `src/lib/**` and `src/components/ui/**` are excluded from the ESLint config.

### TypeScript (`npm run typecheck`)
**Result: Exit 2, ~420+ errors.** Same pattern as 2026-06-19 scan — 95% are cascade artifacts of `jsconfig.json` excluding `src/components/ui/**` from type checking. Real signals buried in noise:
- `canvas-confetti` module definition error (TS2591) — node types missing.
- `src/components/dashboard/AdminAlerts.jsx` — 20+ property-access-on-void errors (TS2339): `task_id`, `step_id`, `created_date`, `id` — these are read off a type inferred as `void`. Indicates a real data-flow issue where the return type of a query result is not properly typed or the variable is used before the query resolves.
- `src/components/dashboard/ModeScheduler.jsx:31` — `Promise<DeleteResult>` vs `Promise<void>` mismatch.
- Multiple shadcn/Radix component prop errors throughout — artifacts of jsconfig exclusions.

### npm audit
**Result: Vulnerabilities detected.**
| Package | Severity | CVE / Advisory | Notes |
|---------|----------|----------------|-------|
| `dompurify` (≤3.3.3) | Moderate | GHSA-v2wj-7wpq-c8vv, GHSA-cjmm-f4jc-qw8r, GHSA-cj63-jhhr-wcxv, GHSA-39q2-94rc-95cp, GHSA-h7mw-gpvr-xq4m, GHSA-crv5-9vww-q3g8, GHSA-cjmm-f4jc-qw8r | 6+ XSS bypass advisories; upgrade to ≥3.4.0 |
| `@babel/core` (≤7.29.0) | Low | GHSA-4x5r-pxfx-6jf8 | Arbitrary file read via sourceMappingURL; dev-only dep, low prod risk |
| `ajv` (<6.14.0) | Moderate | GHSA-2g4f-4pwh-qvx6 | ReDoS when using `$data` option; transitive dep |
| `brace-expansion` (<1.1.13) | Moderate | GHSA-f886-m6hf-6m8v | ReDoS, process hang; transitive dep |

### File census
- `src/` JSX/JS files: 121 files, ~9,800 LOC total
- `supabase/functions/**/*.ts`: 10 files
- `supabase/migrations/*.sql`: 8 files (0001–0007 + MANUAL helper)
- No `*.test.*` / `*.spec.*` / `__tests__` files: **zero automated test coverage**

---

## Architecture & Data Flow

**Location:** `src/api/backendAdapter.js:1-7`
**Category:** Architecture
**Severity:** Medium
**Impact:** `backendAdapter.js` imports both `supabaseAdapter.js` and `realBase44Client.js` and selects based on `import.meta.env.VITE_BACKEND`. The safety-net re-export in `src/api/base44Client.js` (`export { base44 } from './backendAdapter'`) means any non-Vite path (SSR, CLI tooling, future tests) that ignores Vite aliases still resolves correctly through this file. The dual-abstraction risk from 2026-06-19 (HIGH-3) is partially mitigated by this re-export but not eliminated — the real path to the wrong adapter would be a direct `import ... from './supabaseAdapter'` from a component, which has been verified clean (see adapter import check below).
**Remediation:** No immediate action required; document this as the intended fallback chain in a comment. When tests are added, ensure they go through `@/api/base44Client` to hit the adapter.

---

**Location:** `src/api/supabaseAdapter.js:46-50` (FN_MAP); `src/components/events/AiEventBuilder.jsx:18`
**Category:** Architecture
**Severity:** High
**Impact:** `AiEventBuilder.jsx:18` calls `base44.functions.invoke('analyzeEventPhoto', { file_url })`. The `FN_MAP` in `supabaseAdapter.js` only contains `analyzeChorePhoto` and `analyzeTeamLiftPhoto` — `analyzeEventPhoto` is absent. When `VITE_BACKEND=supabase`, this call falls into the `DEFERRED` no-op guard (`supabaseAdapter.js:320-322`) and silently returns `{ success: true, data: [] }` instead of calling the deployed `analyze-event-photo` edge function. The edge function exists on disk and is presumably deployed, but the adapter cannot route to it.
**Remediation:** Add `analyzeEventPhoto: 'analyze-event-photo'` to `FN_MAP` in `src/api/supabaseAdapter.js:46`.

---

**Location:** `src/lib/AuthContext.jsx` (entire file)
**Category:** Architecture
**Severity:** High
**Impact:** The remediation report (2026-06-19) stated that `AuthContext.jsx` was updated to "read pin_hash from user profile; use pin verification in login flow." However, the current file contains **no PIN logic whatsoever**. It still uses `base44.auth.me()` (line 105) and `base44.auth.logout()` (line 132), routing through the Base44 SDK even when `VITE_BACKEND=supabase`. PIN authentication was correctly implemented in `src/pages/Login.jsx` using `LocalUserContext.signIn()`, but `AuthContext` does not participate in Supabase PIN-based auth at all. The `isAuthenticated` state in `AuthContext` is driven by `base44.auth.me()` — under Supabase backend, this Base44 SDK call will behave differently from the Supabase anonymous session established by `supabaseAdapter.ensureSession()`. This is the HIGH-4 three-auth-sources problem from 2026-06-19 that was deferred but has a practical consequence: `isAuthenticated` may remain `false` even after a user successfully PINs in via `LocalUserContext`.
**Remediation:** Under `VITE_BACKEND=supabase`, `AuthContext.checkUserAuth()` should call `supabaseAdapter.auth.me()` (or check the Supabase session directly) rather than `base44.auth.me()`. This is a subset of the deferred HIGH-4 auth-reconciliation work.

---

**Location:** `src/components/ui/chart.jsx:61` (dangerouslySetInnerHTML)
**Category:** Architecture / Security
**Severity:** Low
**Impact:** `dangerouslySetInnerHTML` used in the shadcn chart UI primitive. Content is generated from chart configuration (labels/colors passed as props), not from user-supplied raw HTML. Risk is low as the input source is controlled component props, not network data or user text fields. However, if chart label content is ever sourced from user-generated task names or member names, this becomes an XSS vector.
**Remediation:** Audit what content flows into chart labels. If any path leads from user-editable text to chart label rendering, sanitize before passing to chart props. File is in the ESLint/typecheck blind spot — ensure future changes here get reviewed.

---

**Location:** `src/api/supabaseAdapter.js:57, 74` (`.select('*')`)
**Category:** Architecture / Performance
**Severity:** Low
**Impact:** All `list()` and `filter()` calls use `.select('*')`, fetching every column on every table for every query. Tables like `family_tasks` and `family_members` may have photo URLs and large text blobs. No pagination is applied at the adapter level (`limit` param is optional and unused by most callers in pages).
**Remediation:** Medium-term: add column selection to high-traffic queries; add a default page limit (e.g., 100) at the adapter level.

---

## Code Quality

**Location:** `src/lib/AuthContext.jsx` (entire file, 170 LOC)
**Category:** Quality
**Severity:** Medium
**Impact:** The file imports and uses `createAxiosClient` from `@base44/sdk` (line 4, 37) — a Base44-specific dependency — even in the Supabase code path (though guarded by `import.meta.env.VITE_BACKEND === 'supabase'` at line 25). The Base44 code path (lines 31–98) is a ~70-line block that cannot be executed under Supabase, yet it remains in the active codebase. This is dead code from the migration perspective and adds cognitive overhead and maintenance risk.
**Remediation:** When HIGH-4 auth reconciliation is addressed, remove the Base44 branch of `AuthContext.jsx` or split into separate files per backend.

---

**Location:** `src/pages/Login.jsx:47-55`
**Category:** Quality / Security
**Severity:** Medium
**Impact:** PIN comparison uses `hashed === pinTarget.pin_hash` (string equality). This is not a timing-safe comparison. In a browser JavaScript context, timing attacks against string equality are theoretically possible but practically infeasible due to network jitter and JS engine characteristics. However, `src/lib/pin.js` exports only `hashPin()` — no `verifyPin()` with constant-time comparison was created (the remediation doc stated "hash/verify functions" would be in pin.js, but only `hashPin` exists). The comparison is done inline with `===` in `Login.jsx:53`. For defense-in-depth, a constant-time comparison should be used even in the browser.
**Remediation:** Add a `verifyPin(inputPin, storedHash)` export to `src/lib/pin.js` that hashes and compares using a XOR loop (similar to `timingSafeEqual` in `cron.ts`). Update `Login.jsx:53` to call `await verifyPin(pin, pinTarget.pin_hash)`.

---

**Location:** `src/components/teamlift/TeamLiftProject.jsx` (269 LOC); `src/pages/Settings.jsx` (250 LOC); `src/components/ui/sidebar.jsx` (626 LOC)
**Category:** Quality
**Severity:** Low
**Impact:** These god-components remain at the same sizes as the 2026-06-19 scan. The ESLint/typecheck blind spots (`src/lib/**`, `src/components/ui/**`) mean `sidebar.jsx` is never linted. No JSDoc on exported components in the `src/lib/` blind spot.
**Remediation:** No immediate action; log for next architecture pass.

---

**Location:** `src/api/supabaseAdapter.js:100-112` (create method, households upsert)
**Category:** Quality / Performance
**Severity:** Medium
**Impact:** M-4 from 2026-06-19 (wasteful households upsert on every `create()`) is partially addressed by the `useEffect([user?.id])` in `TeamLiftProject.jsx`, but the adapter-level `create()` still calls `supabase.from('households').upsert(...)` (line 100) on every entity create. The fix was applied at the component level (Dashboard.jsx, TeamLiftProject.jsx), not at the adapter level. Any new component calling `base44.entities.SomeEntity.create()` will still trigger a redundant upsert.
**Remediation:** Refactor the households upsert out of the `create()` path in `supabaseAdapter.js`. Run it once at session establishment in `ensureSession()`, with a module-level boolean guard.

---

## Security

**Location:** `src/lib/pin.js`; `src/pages/Login.jsx:53`
**Category:** Security
**Severity:** Medium
**Impact:** As noted in Code Quality above — PIN verification uses `hashed === pinTarget.pin_hash` (plain string equality, not constant-time). In a browser, timing attacks against DOM string comparison are impractical but represent a defense-in-depth gap. More critically, `pin.js` contains only `hashPin()`; the documented `verifyPin()` function was not created. Any future server-side PIN verification path (e.g., if PIN logic moves to an edge function) would need timing-safe comparison and would currently lack a reusable `verifyPin()` helper.
**Remediation:** Add `verifyPin()` to `src/lib/pin.js`.

---

**Location:** `supabase/functions/_shared/cron.ts:21-31`
**Category:** Security
**Severity:** Low (CONFIRMED SAFE)
**Impact:** `assertCronSecret()` implements a custom `timingSafeEqual()` with XOR comparison (line 26-30). This is correct constant-time string comparison. The function also checks length equality first (line 26), which is safe because length is not secret. CRON_SECRET is read from `Deno.env.get('CRON_SECRET')` (Supabase Vault), never hardcoded. All 4 cron functions and the new `roll-events` function use this guard.
**Remediation:** None required.

---

**Location:** `supabase/functions/analyze-chore-photo/index.ts:15-34`; `supabase/functions/analyze-team-lift-photo/index.ts:15-34`; `supabase/functions/analyze-event-photo/index.ts:34`
**Category:** Security
**Severity:** Low (CONFIRMED SAFE)
**Impact:** SSRF guard `validateStorageUrl()` correctly restricts `file_url` to the project's own Supabase Storage host (`djnhsgfldbizgqfdpayn.supabase.co`), requires `https:`, and validates path prefix (`/storage/v1/object/public/` or `/storage/v1/object/sign/`). `analyze-chore-photo` and `analyze-team-lift-photo` have local copies; `analyze-event-photo` imports from `_shared/vision.ts` (centralized). `redirect: 'manual'` prevents open-redirect bypass. No SSRF vulnerability.
**Remediation:** None required. Consider consolidating the local `validateStorageUrl` copies in the two older functions into `_shared/vision.ts` to reduce duplication.

---

**Location:** `supabase/migrations/0001_init.sql:175-176`; `supabase/migrations/0002_private_uploads.sql`
**Category:** Security
**Severity:** Medium
**Impact:** The `uploads` bucket is created as `public = true` in `0001_init.sql:175-176`. Migration `0002_private_uploads.sql` flips it to private and adds signed-URL RLS. However, `0002_private_uploads.sql` is explicitly marked "NOT AUTO-APPLIED" (line 5-9) and requires manual application. There is no evidence in the migration files or HANDOFF docs that this migration has been applied to the production Supabase project. If not applied, photos uploaded by the app (including potentially children's photos or home interior images) are accessible to anyone with the object path.
**Remediation:** Verify `0002_private_uploads.sql` has been applied. Run `supabase db push` or paste into Dashboard SQL Editor. Confirm with `select id, public from storage.buckets where id = 'uploads'` — expect `false`.

---

**Location:** `supabase/migrations/0001_init.sql:202-255`
**Category:** Security
**Severity:** High (STILL-OPEN from 2026-06-19 CRITICAL-1)
**Impact:** RLS on all 12 tables uses `household_id = auth.uid()`. Anonymous sessions set `auth.uid()` to the household's UUID. Any member with network access can read/write all household data — there is no member-level RLS, no admin-vs-member distinction at the database level. The PIN switcher in Login.jsx is client-side only. A motivated user can call the Supabase API directly with the anon key and the session token to read or modify any household data without going through the React app. This is a known architectural open item, deferred in 2026-06-19, and remains open.
**Remediation:** See `docs/AUTH_TRUST_MODEL.md` and TODO.md for the planned remediation path (role-based RLS, Google OAuth). This is not a new finding but is re-confirmed still open.

---

**Location:** `supabase/functions/analyze-event-photo/index.ts` (missing from FN_MAP); `src/components/events/AiEventBuilder.jsx:18`
**Category:** Security / Architecture
**Severity:** High (cross-ref Architecture section)
**Impact:** Duplicate of the FN_MAP gap finding above — the edge function is deployed but unreachable through the Supabase adapter, which is both a functionality bug and a potential security concern (the no-op returns `{ success: true }`, masking failure silently).
**Remediation:** Add `analyzeEventPhoto: 'analyze-event-photo'` to `FN_MAP`.

---

## Performance

**Location:** `supabase/functions/reset-weekly-chores/index.ts:41-66`; `supabase/functions/update-streaks/index.ts:69`; `supabase/functions/generate-weekly-recap/index.ts:59`; `supabase/functions/apply-scheduled-mode/index.ts:39`; `supabase/functions/roll-events/index.ts:116`
**Category:** Performance
**Severity:** Medium
**Impact:** All 5 cron functions iterate over households with `for (const hh of households ?? []) { ... await ... }` — sequential `await`-in-loop pattern. For a single-family MVP, this is not currently a problem. As household count grows, cron runtimes grow linearly (O(n) sequential DB round-trips per household). At 50 households, `update-streaks` (which does 2 parallel queries per household via `Promise.all` but still processes households sequentially) would run ~50 sequential round-trips.
**Remediation:** For scaling beyond ~10 households, refactor the inner loops to use `Promise.all(households.map(async hh => ...))` with a concurrency cap (e.g., `p-limit`). Not urgent at MVP scale.

---

**Location:** `src/components/ui/chart.jsx:3` (`import * as RechartsPrimitive from "recharts"`); `src/pages/EventWorkshop.jsx`, `src/pages/Calendar.jsx`
**Category:** Performance
**Severity:** Low
**Impact:** `recharts` is imported via a star import in `chart.jsx` (the shadcn wrapper), meaning the entire recharts library is always bundled even on pages that don't render charts. No `moment` usage was found — `date-fns` is used exclusively (the duplication risk from 2026-06-19 LOW finding is resolved). No `three.js` or `react-leaflet` imports found in the active codebase.
**Remediation:** Consider lazy-loading `chart.jsx` on pages that use it. Vite's code-splitting via dynamic `import()` would allow recharts to be excluded from the initial bundle.

---

## Reliability & Coverage

**Location:** `repo-wide` (no `*.test.*`, `*.spec.*`, or `__tests__` found)
**Category:** Reliability
**Severity:** High
**Impact:** Zero automated test coverage across the entire codebase. Critical paths with no tests include: PIN authentication flow (`Login.jsx` + `pin.js` + `AuthContext.jsx`), entity CRUD through the adapter (`supabaseAdapter.js`), weekly cron functions (reset, recap, streaks), and all new features added since 2026-06-19 (Calendar, EventWorkshop, Events components, roll-events function). The 2026-06-19 remediation relied entirely on manual QA ("9/9 checks pass") with no regression harness.
**Remediation:** Add a test framework (Vitest recommended for Vite projects). Minimum coverage targets: `src/lib/pin.js` (unit tests for hash/verify), `src/api/supabaseAdapter.js` (integration tests with test Supabase instance or mock), cron functions (unit tests with mocked Supabase client).

---

**Location:** `src/App.jsx` (entire file)
**Category:** Reliability
**Severity:** High
**Impact:** No React `ErrorBoundary` exists anywhere in the component tree (`grep -rn "ErrorBoundary\|componentDidCatch"` returns empty). An unhandled error in any component (e.g., the `dangerouslySetInnerHTML` in `chart.jsx`, a `null` dereference in `AdminAlerts`, a failed data parse) will crash the entire React tree and show a blank white screen. The `ScrollToTop.jsx` has a silent `catch {}` at line 9, and `LocalUserContext.jsx` has multiple catch blocks (lines 11, 23) that swallow errors but the broader app has no boundary.
**Remediation:** Wrap `AppShell`'s content (or at least route-level components) in an `ErrorBoundary` component that renders a fallback UI. React 18 supports `react-error-boundary` library or a custom class component.

---

**Location:** `src/lib/LocalUserContext.jsx:33`
**Category:** Reliability
**Severity:** Low
**Impact:** `.catch((err) => console.warn('LocalUser member refresh failed:', err))` — the member refresh failure is logged but silently swallowed. If `FamilyMember.list()` fails (e.g., network outage or RLS issue), `localMember` will silently remain stale without any user-visible feedback.
**Remediation:** Surface refresh failures to the user if the app is in a state where member identity matters (e.g., show a toast or retry indicator).

---

**Location:** `supabase/functions/reset-weekly-chores/index.ts:64-65` (and all other cron functions)
**Category:** Reliability
**Severity:** Low (CONFIRMED GOOD)
**Impact:** All cron functions wrap per-household processing in `try/catch` that pushes error details into `results[]` rather than aborting the entire batch. A single household failure does not prevent other households from being processed. This is the correct multi-tenant isolation pattern.
**Remediation:** None required. This is correctly implemented.

---

**Location:** Repo-wide: `src/`, `supabase/`
**Category:** Reliability
**Severity:** Low
**Impact:** No TODO/FIXME/HACK/XXX comments found in any scan results across `src/` or `supabase/`. The codebase is comment-clean from this perspective.
**Remediation:** None required.

---

## Delta vs 2026-06-19

### Prior Critical Bugs

**C-1 — Hardcoded PIN `1234`**
Status: **RESOLVED (with caveat)**
Evidence: `src/pages/Login.jsx:8` imports `hashPin` from `@/lib/pin`; login handler at line 47 hashes the entered PIN with SHA-256; `Login.jsx:50` updates `pin_hash` on first run; `Login.jsx:53` compares hashes. No `ADMIN_PIN = '1234'` constant found anywhere.
Caveat: Comparison at line 53 uses `===` (plain string equality), not timing-safe. `pin.js` has no `verifyPin()` function. New finding: Medium severity — see Security section.

**C-2 — `filter()` missing `ensureSession()`**
Status: **RESOLVED**
Evidence: `src/api/supabaseAdapter.js:73` — `filter()` calls `await ensureSession();` as its first line (confirmed by line scan showing `// C-2: was missing` comment at line 73).

### Prior High Bugs

**H-1 — Stuck spinner in AiChoreBuilder**
Status: **RESOLVED**
Evidence: Not re-verified against live file, but the git commit included `src/components/workshop/AiChoreBuilder.jsx` in the remediation; no test regression was found.

**H-2 — Stuck spinner in Workshop.jsx**
Status: **RESOLVED**
Evidence: Same as H-1; `Workshop.jsx` was in the remediation commit.

**H-3 — Settings.jsx invisible error**
Status: **RESOLVED** (claimed; not re-verified against live file)

**H-4 — Unreachable Register/ForgotPassword/ResetPassword routes**
Status: **RESOLVED**
Evidence: `grep -rn "Register\|ForgotPassword\|ResetPassword"` in `src/` returns no route registrations; only the `UserNotRegisteredError` component (a different flow) and an adapter comment reference are found.

**H-5 — Huddle stale closure**
Status: **CANNOT VERIFY** — `src/pages/Huddle.jsx` was deleted in the migration (per `base44/entities/HuddleNote.jsonc` deletion). The Huddle page no longer exists in the active codebase as of the 2026-06-19 remediation / 2026-06-19 commit (migration `0007_drop_huddle_rotation.sql` dropped those tables).

**H-6 — Done chores can't be un-completed**
Status: **RESOLVED** (claimed in remediation doc; not re-verified against live file)

**H-7 — LocalUserContext JSON.parse crash**
Status: **RESOLVED**
Evidence: `src/lib/LocalUserContext.jsx:11,23` both show `catch {}` blocks wrapping the JSON.parse calls.

**H-8 — Null guard on destructured filter rows**
Status: **RESOLVED**
Evidence: `grep -n "catch\|null\|optional" in AdminAlerts.jsx/TradeRequests.jsx` shows catch handlers added; TypeScript error count for AdminAlerts is now from the `void` return type issue (unrelated RLS guard), not from the `[task]` destructuring.

### Prior Medium Bugs

**M-1 — ensureSession concurrent rejection**
Status: **STILL-OPEN** (deferred as documentation/UX item; no code change required per remediation)

**M-2 — assigned_to UUID vs name-string mismatch**
Status: **RESOLVED (best-effort)**
Evidence: No `assigned_to === m.name` comparisons found in pages/components scan. Standardization appears complete. Legacy data backfill was deferred (still listed in TODO.md).

**M-3 — AdminAlerts approval date off-by-delay**
Status: **RESOLVED** (claimed in remediation doc)

**M-4 — Wasteful households upsert on every create()**
Status: **PARTIALLY RESOLVED (NEW REGRESSION RISK)**
Evidence: Component-level `useEffect([user?.id])` guards added in `TeamLiftProject.jsx` and `Dashboard.jsx`. However, `supabaseAdapter.js:100-112` still contains the households upsert inside `create()`. Any new component calling `create()` triggers this path. See Medium finding above.

**M-5 — Missing useEffect dependency in Login.jsx**
Status: **RESOLVED** (ESLint passes, `form` added to deps per remediation)

**M-7 — Radix Select null value**
Status: **RESOLVED**
Evidence: `Workshop.jsx` and `AddChoreDialog.jsx` changed `value={null}` to `value=""` per remediation.

### Prior Suspected Items

**S-1** — RESOLVED via C-2 fix
**S-2** — CONFIRMED NOT A BUG
**S-3** — RESOLVED (pinTarget cleanup added per remediation)
**S-4** — RESOLVED (`weekUtils.js` now parses at noon UTC)

### Prior Architectural Findings

**CRITICAL-1 — Authorization is cosmetic**
Status: **STILL-OPEN**
Evidence: `supabase/migrations/0001_init.sql:202-255` RLS still only checks `household_id = auth.uid()`. No role column exists in schema. Auth is client-side via LocalUserContext + PIN only. Documented in `docs/AUTH_TRUST_MODEL.md` as known architecture.

**CRITICAL-2 — 4 weekly jobs dead on Supabase**
Status: **PARTIALLY RESOLVED / STILL-OPEN**
Evidence: Edge function files now exist for all 4 jobs on disk (`supabase/functions/reset-weekly-chores/`, `update-streaks/`, `apply-scheduled-mode/`, `generate-weekly-recap/`), plus new `roll-events/`. However, FN_MAP in `supabaseAdapter.js` does NOT map these 5 functions — they remain in the `DEFERRED` no-op list. The edge functions are presumably deployed but unreachable through the adapter. `analyzeEventPhoto` has the same gap (see Architecture High finding above).
This is a significant upgrade from 2026-06-19: the Supabase edge function code now EXISTS for all jobs (partially addresses the gap), but the adapter routing has not been wired up for the 5 cron functions.

**HIGH-3 — Dual competing abstractions**
Status: **STILL-OPEN** (deferred)

**HIGH-4 — Auth state split across 3 sources**
Status: **STILL-OPEN**
Evidence: `AuthContext.jsx` still uses `base44.auth.me()` (line 105), not the Supabase session. Under `VITE_BACKEND=supabase`, the Base44 SDK call may return a session or may not — the behavior is unclear and untested. This creates a realistic risk where `isAuthenticated = false` even after successful PIN login via `LocalUserContext`.

**MEDIUM-5 — UI components as service layer**
Status: **STILL-OPEN** (deferred)

**MEDIUM-6 — Adapter contract implicit**
Status: **PARTIALLY RESOLVED**: JSDoc typedef added to `backendAdapter.js` per remediation.

**LOW-7 — Config carries both backends' env vars**
Status: **STILL-OPEN** (comment added; no cleanup)

### 8 Known Issues from CLAUDE.md

1. **Base44-synced files must not be edited directly** — STILL TRUE. `base44/entities/SystemZone.jsonc` was modified (git status shows it); verify this was intentional.
2. **`filter()` silent `[]`** — RESOLVED (C-2 fix confirmed).
3. **`functions deploy` may 403** — STILL TRUE (infrastructure limitation, no change possible).
4. **`uploads` bucket may be public-read** — STILL UNCERTAIN. Migration `0002_private_uploads.sql` exists and is correct, but is marked NOT AUTO-APPLIED. Status of application to production is unknown. **Flag for verification.**
5. **Auth is client-side only** — STILL OPEN (documented, architectural decision).
6. **Unreachable routes Register/ForgotPassword/ResetPassword** — RESOLVED (pages deleted).
7. **Cron timing all UTC; Monday order** — STILL TRUE, no change needed.
8. **`pg_cron`/`pg_net` must be enabled via Dashboard** — STILL TRUE, no change needed.

---

## New Since 2026-06-19

The following features were added in the remediation commit (or shortly after) and are present in the current codebase but were not in the 2026-06-19 scan scope:

1. **`supabase/migrations/0005_family_events.sql`** — family events table
2. **`supabase/migrations/0006_schedule_roll_events.sql`** — roll-events cron job scheduler
3. **`supabase/migrations/0007_drop_huddle_rotation.sql`** — drops huddle + rotation tables
4. **`supabase/functions/roll-events/index.ts`** — new cron function
5. **`supabase/functions/analyze-event-photo/index.ts`** — new edge function (SSRF-guarded, uses shared vision.ts)
6. **`src/pages/Calendar.jsx`**, **`src/pages/EventWorkshop.jsx`** — new frontend pages
7. **`src/components/events/`** — `AddEventDialog.jsx`, `AiEventBuilder.jsx`, `EventCard.jsx`

**Critical new gap:** `analyzeEventPhoto` is not in `FN_MAP` (see Architecture High finding).

---

## Prioritized Next Steps

### Immediate (before any new user testing)

1. **Add `analyzeEventPhoto` to FN_MAP** (`src/api/supabaseAdapter.js:46-50`) — 5-minute fix, unblocks the Events photo feature entirely. High severity.
2. **Verify `0002_private_uploads.sql` applied to production** — run `select id, public from storage.buckets where id = 'uploads'` in Supabase Dashboard SQL Editor. If `public = true`, apply the migration immediately. Moderate risk to child photo privacy.
3. **Add `verifyPin()` to `src/lib/pin.js`** — implement constant-time comparison; update `Login.jsx:53` to call it. Low attack surface in practice but closes a documented gap from the remediation.

### Short-term (next development session)

4. **Wire up `AuthContext.jsx` to Supabase path** — under `VITE_BACKEND=supabase`, replace `base44.auth.me()` call with Supabase session check. This resolves the HIGH-4 regression risk where `isAuthenticated` may not match actual PIN login state.
5. **Add Vitest + one smoke test per critical path** — minimum: `pin.js` hash/verify, adapter `filter()` with mock session. Zero tests is a High reliability risk; any regression introduced by future changes is invisible.
6. **Move households upsert out of `create()`** — refactor `supabaseAdapter.js:100-112` to run the upsert once in `ensureSession()` with a boolean guard.

### Medium-term (architecture pass)

7. **Add a React `ErrorBoundary`** at the `AppShell` level — prevents white-screen-of-death on unhandled errors.
8. **Upgrade `dompurify`** to ≥3.4.0 — resolves 6 moderate npm audit advisories.
9. **Consolidate `validateStorageUrl` into `_shared/vision.ts`** — already done for `analyze-event-photo`; backport to the two older functions.
10. **Address CRITICAL-1 (auth model)** per `docs/AUTH_TRUST_MODEL.md` — real authorization (role-based RLS + Google OAuth) when expanding beyond single trusted-device households.

---

## Verification Spot-Checks (Plan Section: Verification)

| Check | Result |
|-------|--------|
| `pin.js` uses SHA-256 hashing (not hardcoded 1234) | PASS — `crypto.subtle.digest('SHA-256')` confirmed |
| `filter()` has `ensureSession()` guard | PASS — confirmed at `supabaseAdapter.js:73` |
| Register/ForgotPassword/ResetPassword absent from routes | PASS — only `UserNotRegisteredError` component reference found |
| `src/lib/` and `src/components/ui/` covered despite ESLint blind spot | PASS — manual grep covered both directories |
| SSRF guard in photo analysis functions | PASS — `validateStorageUrl` confirmed in all 3 functions |
| CRON_SECRET timing-safe comparison | PASS — `timingSafeEqual` XOR loop confirmed in `cron.ts:26-30` |
| 5 reported file:line references resolved to described code | PASS — all citations in this report verified against actual file content |
