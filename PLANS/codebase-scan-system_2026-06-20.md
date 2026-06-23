/Users/andrewkhoh/Documents/KinTeam/PLANS/codebase-scan-system_2026-06-20.md/Users/andrewkhoh/Documents/KinTeam/PLANS/codebase-scan-system_2026-06-20.md# Systematic Codebase Scanning System — KinTeam

## Context

The user wants a **comprehensive technical audit** of the KinTeam codebase, output to `codebase-scan_2026-06-20.md`, following a precise per-finding template across five audit categories (Architecture, Code Quality, Security, Performance, Reliability). Rather than a one-off pass, the user asked for a **systematic, repeatable scanning *system*** — and for that system's plan to be saved to `PLANS/`.

A prior scan (`HANDOFF/codebase-scan_2026-06-19.md`) exists from one day earlier; its 11 confirmed bugs were remediated (`HANDOFF/remediation_2026-06-19.md`). The new scan must therefore not just rediscover known issues but **verify which prior findings held vs. regressed, and surface what's new** — captured in a "Delta vs 2026-06-19" section.

This codebase is mid-migration from the Base44 low-code SDK to self-hosted Supabase (runtime-selectable via `VITE_BACKEND`), which creates the dominant architectural risk surface (dual abstractions, swap-layer integrity, client-side-only auth).

### Decisions locked with the user
- **Report format:** per-finding template grouped under the 5 categories, **plus** a "Delta vs 2026-06-19" section.
- **Output locations:** scan report → repo root `./codebase-scan_2026-06-20.md`; this planning doc → `PLANS/codebase-scan-system.md`.
- **Scan depth:** adaptive — run all necessary tools and spawn additional agents as the situation demands (not a fixed lightweight pass).

---

## Ground Truth (from reconnaissance)

- **Scope:** ~159 source files (~12k LOC). Frontend 121 (`.jsx`/`.js`), backend 18 (`.ts` edge functions + `.sql` migrations), Base44 layer 20 (`.jsonc`/`.ts`).
- **Entry chain:** `src/main.jsx` → `src/App.jsx` (provider stack + router) → `ProtectedRoute` → `src/components/layout/AppShell.jsx` → `src/pages/*`.
- **Swap layer (load-bearing):** `src/api/backendAdapter.js` selects `supabaseAdapter.js` (340 LOC) vs `realBase44Client.js` on `VITE_BACKEND`. Components must import via `@/api/base44Client` (Vite alias), never the concrete adapters.
- **Complexity hotspots:** `ui/sidebar.jsx` (626), `supabaseAdapter.js` (340), `ui/chart.jsx` (309), `0001_init.sql` (288), `teamlift/TeamLiftProject.jsx` (269), `pages/Settings.jsx` (250).
- **Backend:** 8 edge functions (4 cron, `verify_jwt=false`, guarded by `CRON_SECRET`); 8 migrations (max applied `0007`); RLS = `household_id = auth.uid()`.
- **Tooling available:** `npm run lint` (ESLint 9 flat — **ignores `src/lib/**` and `src/components/ui/**`, no complexity/max-lines rules**), `npm run typecheck` (`tsc`, `checkJs:true`, excludes `ui` + `lib`), `package-lock.json` present → `npm audit` possible.
- **Critical gap:** **zero automated tests** — no framework, no `test` script, no `*.test.*`/`*.spec.*`/`__tests__`.
- **Exclude from scan:** `node_modules/`, `dist/`, `.git/`, `.claude/`, `.claude-mpm/`, `supabase/.temp/`.

---

## The Scanning System (reusable methodology)

A four-phase pipeline. Phases 0→2 are sequential; agents within Phase 1 run in parallel.

### Phase 0 — Ground-Truth Harvest (tools first, delegated to Local Ops)
Run and capture raw output so agent findings are evidence-backed, not speculative:
1. `npm run lint` — current lint state (note: `src/lib` + `src/components/ui` are unlinted blind spots).
2. `npm run typecheck` — `tsc` errors/warnings under `checkJs`.
3. `npm audit --json` — dependency CVEs. **Fallback if no network:** Security agent manually reviews `package.json` versions against known-CVE/outdated-major patterns and labels findings "unverified — npm audit unavailable."
4. `git status` / line-count census — confirm the file inventory above is current.
These outputs are handed to the Phase 1 agents as shared context.

### Phase 1 — Five Category Specialists (parallel, single dispatch)
Each agent scans the **entire** in-scope tree for its category, consumes Phase 0 output, and returns findings in the exact template. Agent type chosen to fit the category:

| # | Category | Agent type | Primary focus |
|---|----------|-----------|---------------|
| 1 | Architecture & Data Flow | `ecc:architect` | Dependency graph; circular deps; **direct-adapter-import violations** (grep `supabaseAdapter`/`supabaseClient`/`realBase44Client` in components); layering violations; dual-abstraction risk; swap-layer integrity. |
| 2 | Code Quality | `ecc:typescript-reviewer` | Functions >30 LOC; cyclomatic complexity >10; missing JSDoc; naming inconsistency (camel vs snake); dead/commented code; god-components (sidebar, Settings, TeamLiftProject). Explicitly probe lint/typecheck blind spots (`src/lib`, `src/components/ui`). |
| 3 | Security | `ecc:security-reviewer` | Hardcoded secrets/creds (regex sweep incl. `.env.example`, source); CVE cross-ref (Phase 0); SQL injection in edge fns/migrations/adapter; XSS/`dangerouslySetInnerHTML`; SSRF in Gemini `file_url` photo analysis; CORS `*`; `CRON_SECRET` timing-safety; client-side-only auth; uploads-bucket privacy; RLS gaps. |
| 4 | Performance | `ecc:performance-optimizer` | N+1 in cron loops over households/members; `await`-in-loop vs `Promise.all`; over-fetching / missing pagination; React re-render/memoization gaps; eager heavy imports (three.js, recharts, leaflet); `moment`+`date-fns` duplication. |
| 5 | Reliability & Coverage | `QA` | Swallowed errors / empty catches; missing error boundaries; per-household failure isolation in cron; **zero-test-coverage** (high-severity finding); TODO/FIXME/HACK sweep; unreachable routes (`Register`/`ForgotPassword`/`ResetPassword`). |

**Shared agent contract:** every finding uses —
```
**Location:** `path/to/file.ext:L10-L20`   (or `repo-wide` when not a single site)
**Category:** Architecture | Quality | Security | Performance | Reliability
**Severity:** Critical | High | Medium | Low
**Impact:** <concise technical risk/inefficiency>
**Remediation:** <specific code or architectural change>
```
Findings ordered by severity, separated by `---`. Empty category → literal "No significant issues found." Paths/line numbers must be real (best-effort static analysis; never ask for clarification — per original spec).

### Phase 1.5 — Adaptive Deep-Dives (on demand)
If a specialist flags something needing confirmation (e.g., a suspected SQL-injection path, a real circular dep, an exploitable SSRF), spawn a **targeted follow-up agent** (e.g., `ecc:database-reviewer` for SQL/RLS, `ecc:silent-failure-hunter` for error-swallowing) to verify before it's marked Critical/High. This is the "tools and agents depending on the situation" the user asked for — depth scales to what's found, not fixed upfront.

### Phase 2 — Synthesis & Authoring (delegated to Documentation Agent)
One agent merges all category outputs and writes `./codebase-scan_2026-06-20.md`:
1. Header (date, scope, methodology, tool versions/results from Phase 0).
2. Executive summary: finding counts by severity × category.
3. Five category sections, each with its template-formatted findings (or "No significant issues found").
4. **Delta vs 2026-06-19** section: each prior confirmed bug (C-1, C-2, H-1…H-8, M-1…M-7) and the 8 CLAUDE.md known-issues marked **RESOLVED / STILL-OPEN / REGRESSED**, with evidence.
5. Cross-cutting recommendations / prioritized next steps.
6. Dedupe overlaps (e.g., client-side auth surfaces in both Architecture and Security — state once, cross-reference).

It validates the file is well-formed Markdown before finishing.

---

## Deliverables

| File | Content |
|------|---------|
| `./codebase-scan_2026-06-20.md` | The comprehensive audit report (repo root). |
| `PLANS/codebase-scan-system.md` | This scanning-system methodology (so it's reusable for future scans). |

---

## Execution Order (this run)

1. **PM** creates `PLANS/` and writes `PLANS/codebase-scan-system.md` (this plan). *(delegated — file write)*
2. **Local Ops** runs Phase 0 tools, returns raw output.
3. **5 specialists** dispatched in parallel (Phase 1) with Phase 0 context.
4. **Adaptive** Phase 1.5 follow-ups as findings warrant.
5. **Documentation Agent** synthesizes → writes `codebase-scan_2026-06-20.md` (Phase 2).
6. **PM** reports summary: counts by severity/category, top Criticals, delta highlights, file locations.

---

## Verification

- **Tool grounding:** the report's Phase-0 section quotes actual `lint`/`typecheck`/`audit` output (or notes audit fallback).
- **Format compliance:** every finding matches the 5-field template; categories present; empty categories explicitly stated; valid Markdown (renders without broken headings/code fences).
- **Delta accuracy:** spot-check 3–4 prior bugs against current code (e.g., confirm `pin.js` SHA-256 hashing replaced the hardcoded `1234`; confirm `ensureSession()` guards `filter()` in `supabaseAdapter.js`).
- **Reality check:** spot-check ~5 reported `file:line` references resolve to the described code (guards against hallucinated locations).
- **No-scope-gaps:** confirm `src/lib/**` and `src/components/ui/**` (lint/typecheck blind spots) were covered by the agents despite tooling ignoring them.

---

## Appendix A — Severity Rubric (applies to all categories)

Use these definitions so severity is consistent across agents. When a finding straddles two levels, pick the higher and justify in *Impact*.

| Severity | Definition | Examples |
|----------|-----------|----------|
| **Critical** | Exploitable now, or causes data loss / auth bypass / multi-tenant data leak / production-down. No preconditions, or preconditions trivially met. | Hardcoded secret in shipped source; RLS gap exposing another household's data; SQL injection in an edge function; auth fully bypassable. |
| **High** | Serious weakness requiring a precondition, OR a broken core feature, OR systemic reliability gap. | SSRF reachable only by authed user; cron loop aborts all households on one failure; core flow throws on cold load; **zero test coverage on critical paths**. |
| **Medium** | Localized bug, maintainability/architecture risk, or perf issue that bites under load. | Function >30 LOC / cyclomatic >10; N+1 query on a small table; swallowed error on a non-critical path; dual-abstraction confusion. |
| **Low** | Style, docs, naming, dead code, micro-perf. | Missing JSDoc; `moment`+`date-fns` duplication; commented-out blocks; inconsistent camel/snake naming. |

---

## Appendix B — Environment, Prerequisites & Cost

**Assumed environment**
- `VITE_BACKEND=supabase` is the migration target; scan the Supabase path as primary, Base44 path as legacy/secondary.
- Node + npm available; `package-lock.json` present.
- **Read-only against Supabase** project `djnhsgfldbizgqfdpayn` — the scan never runs `db push`, `functions deploy`, or any mutation. Static analysis of `supabase/**` only.
- `npm audit` needs network. If unavailable, use the documented fallback (manual `package.json` CVE review, findings labelled "unverified — npm audit unavailable").
- Executor: either the MPM agent runtime (5 parallel specialists + synthesizer) **or** a human running Phase-0 tools manually then doing the category passes by hand. Same template either way.

**Out of scope (do not edit/flag as fixable):** `base44/entities/*.jsonc`, `base44/functions/*` (two-way synced); `node_modules/`, `dist/`, `.git/`, `.claude/`, `.claude-mpm/`, `supabase/.temp/`.

**Cost estimate:** a full 5-specialist + adaptive deep-dive + synthesis run is token-heavy (the parallel agents each read large slices of ~12k LOC). Budget accordingly and watch the session cost meter; consider running categories serially if cost-constrained.

---

## Appendix C — Delta Checklist (verify each; mark RESOLVED / STILL-OPEN / REGRESSED)

Authoritative sources: `HANDOFF/codebase-scan_2026-06-19.md` (findings) and `HANDOFF/remediation_2026-06-19.md` (claimed fixes). Open both and reconcile every ID — the count of H-/M- items differs between summaries, so **enumerate from the source docs, do not trust this list's ranges blindly.**

**Prior confirmed bugs** (verify against current code, don't assume the remediation held):
- `C-1` PIN hardcoding (`1234`) → expect SHA-256 per-member hashing in `src/lib/pin.js` + `AuthContext.jsx`.
- `C-2` `filter()` silent `[]` on cold load → expect `ensureSession()` guard in `src/api/supabaseAdapter.js`.
- `H-*` (spinner stickiness, swallowed errors, null guards, etc.) — enumerate from source doc.
- `M-*` (perf, type mismatches, date logic) — enumerate from source doc.
- `S-1`…`S-4` suspected items — confirm final disposition.
- Architectural `CRITICAL-1`…`LOW-7` (7 items: client-side auth, incomplete migration / dead weekly jobs, dual abstractions, 3-source auth split, UI-as-service-layer, …) — re-check each.

**8 known issues from CLAUDE.md** (mark each still-true or not):
1. Base44-synced files must not be edited directly.
2. `filter()` silent `[]` (claimed FIXED — verify).
3. `functions deploy` may 403 (workaround: Dashboard).
4. `uploads` bucket may be public-read → is `0002_private_uploads.sql` applied?
5. Auth is client-side only; DB enforces no roles (architectural open item).
6. Unreachable routes `Register`/`ForgotPassword`/`ResetPassword` (claimed deleted — verify they're gone).
7. Cron timing all UTC; Monday order reset(05:15) → recap(05:20).
8. `pg_cron`/`pg_net` must be enabled via Dashboard, not DDL.

Also flag **regressions or new issues** introduced by the 2026-06-19 remediation (23 files changed).

---

## Appendix D — Ready-to-Run Agent Prompts

Phase-0 output (lint/typecheck/audit raw results) must be pasted into each specialist prompt where it says `[PHASE-0 OUTPUT]`. All specialists share the **finding contract** from the "Phase 1" section above (5-field template, severity per Appendix A, ordered by severity, `---` separated, "No significant issues found" when empty, real `file:line`, never ask for clarification).

**Phase 0 — Local Ops:** "In /Users/andrewkhoh/Documents/KinTeam run, capturing full raw output: `npm run lint`; `npm run typecheck`; `npm audit --json` (if it fails on network, say so and skip); and a line-count census of `src/` + `supabase/`. Return each command's raw output verbatim. Do not fix anything."

**Agent 1 — Architecture (`ecc:architect`):** "Audit ARCHITECTURE & DATA FLOW only. Map the dependency graph from `src/main.jsx` → `App.jsx` → router → `AppShell` → pages. Find: circular deps; **components importing `supabaseAdapter`/`supabaseClient`/`realBase44Client` directly instead of via `@/api/base44Client`** (grep all of `src/`); layering violations (pages importing pages, ui importing business logic); the dual-abstraction risk (`backendAdapter.js` + `base44Client.js` + `supabaseAdapter.js`); swap-layer integrity. Phase-0: [PHASE-0 OUTPUT]. Return template-formatted findings only."

**Agent 2 — Code Quality (`ecc:typescript-reviewer`):** "Audit CODE QUALITY only across `src/**` and `supabase/functions/**`. Flag functions >30 LOC; cyclomatic complexity >10; missing JSDoc on exports; camel/snake naming inconsistency; dead/commented code; god-components (esp. `ui/sidebar.jsx` 626, `pages/Settings.jsx` 250, `teamlift/TeamLiftProject.jsx` 269). **Explicitly cover `src/lib/**` and `src/components/ui/**` — ESLint ignores them, so they're blind spots.** Cap ~25 highest-severity findings. Phase-0: [PHASE-0 OUTPUT]. Template-formatted findings only."

**Agent 3 — Security (`ecc:security-reviewer`):** "Audit SECURITY only, whole repo (skip excludes in Appendix B). Exhaustively: hardcoded secrets/creds via regex (incl. `.env.example`, source, configs) — `eyJ`, `sk-`, `AIza`, `service_role`, `password`, `secret`, default PINs; CVE cross-ref from Phase-0; SQL injection in `supabase/functions/**`, `supabase/migrations/**`, adapter; XSS / `dangerouslySetInnerHTML`; SSRF via Gemini `file_url` in analyze-*-photo functions; CORS `*`; `CRON_SECRET` timing-safe comparison in `_shared/cron.ts`; client-side-only auth; `uploads` bucket privacy; RLS (`household_id = auth.uid()`) gaps. Phase-0: [PHASE-0 OUTPUT]. Template-formatted findings only."

**Agent 4 — Performance (`ecc:performance-optimizer`):** "Audit PERFORMANCE only across `src/**` and `supabase/functions/**`. Find: N+1 in cron loops over households/members; `await`-in-loop that should be `Promise.all`; over-fetching / missing pagination in the adapter & pages; React re-render / missing memoization; eager heavy imports (three.js, recharts, react-leaflet) that should be code-split; `moment`+`date-fns` duplication. Phase-0: [PHASE-0 OUTPUT]. Template-formatted findings only."

**Agent 5 — Reliability & Coverage (`QA`):** "Audit RELIABILITY & COVERAGE only, whole repo. Find: swallowed errors / empty catches; missing React error boundaries; per-household failure isolation in cron functions (one throw must not abort the batch); **zero automated tests = High finding (use `repo-wide`)**; TODO/FIXME/HACK/XXX sweep (group into one finding with a location list); unreachable routes `Register`/`ForgotPassword`/`ResetPassword` — confirm presence/absence. Phase-0: [PHASE-0 OUTPUT]. Template-formatted findings only."

**Phase 1.5 — Adaptive:** spawn a targeted verifier only when a specialist marks something Critical/High that needs confirmation — `ecc:database-reviewer` for SQL/RLS claims, `ecc:silent-failure-hunter` for error-swallowing claims. Verifier confirms or downgrades before it lands in the report.

**Phase 2 — Synthesis (`Documentation Agent`):** "Merge the five specialists' outputs into `/Users/andrewkhoh/Documents/KinTeam/codebase-scan_2026-06-20.md`. Structure: (1) header — date, scope, methodology, Phase-0 tool results; (2) executive summary — counts by severity × category; (3) five category sections in the 5-field template (or 'No significant issues found'); (4) **Delta vs 2026-06-19** per Appendix C (RESOLVED/STILL-OPEN/REGRESSED with evidence); (5) prioritized cross-cutting recommendations. Dedupe overlaps (e.g. client-side auth appears in Architecture + Security — state once, cross-reference). Validate it is well-formed Markdown before finishing. Inputs follow: [PASTE ALL FIVE AGENT OUTPUTS]."
