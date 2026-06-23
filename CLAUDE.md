# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Communication Style (KinTeam)

When narrating in-flight orchestration / status updates (the "ongoing steps" shown while delegating to agents or running tools), use dramatic fantasy-wizard or sci-fi-engineering flavor instead of plain corporate phrasing. **Prioritize fun, playful, and nonsensical/whimsical verbs to keep narration vivid and inventive.** For example, prefer "Summoning the Engineer from the tower," "Warp-folding the codebase," "Bamboozling the linter," "Transmogrifying the gremlins," or "Untangling the ley-lines" over flat corporate verbs like "routing to specialist," "checking circuit breakers," or "processing."

Vary verb choices throughout the narration to keep them fresh and unexpected. Do not let the narration drift back into plain phrasing—keep inventing and enjoy the unusual verbs.

Keep this flavor confined to in-flight progress narration. Final summaries, decisions, and error reports must stay clear, accurate, and neutral so meaning is never obscured. Continue to avoid sycophantic exclamations ("Excellent!", "Perfect!", "You're absolutely right!").

This project-scoped instruction intentionally overrides the global `claude_mpm` output style's `Tone: Professional, neutral` directive — but for in-flight status narration only.

---

## Overview

**KinTeam** is a family chore-management and gamification app built with **Vite + React** on the frontend and **Supabase** (with Deno Edge Functions) on the backend. The app is mid-migration from the Base44 low-code SDK to self-hosted Supabase, selectable at runtime via the `VITE_BACKEND` environment variable.

### Core Domain

- **Households:** One family per account, identified by the Supabase `auth.users.id` (currently anonymous session).
- **Members:** Family members assigned to chores, with streaks, stars, and weekly recaps.
- **Chores:** Weekly routine tasks that reset every Monday; can be assigned or traded between members.
- **Cron jobs:** Daily/weekly automated tasks (apply household modes, update streaks, reset chores, generate recaps).
- **Gamification:** Leaderboards, star rewards, streaks, weekly MVP, team-lift collaborative projects, and drag-and-drop task management.

---

## Build & Dev Commands

All commands assume npm is used (no yarn/pnpm aliases).

| Command | Purpose | Notes |
|---|---|---|
| `npm run dev` | Start Vite dev server | Strict port 5180 (fails if busy; adjust `.vite.config.js` to change) |
| `npm run build` | Build production bundle | Output: `dist/` |
| `npm run preview` | Preview production build locally | Use before deploy |
| `npm run lint` | Run ESLint | ESLint 9 (flat config: `eslint.config.js`) |
| `npm run lint:fix` | Auto-fix linting issues | Modifies files in-place |
| `npm run typecheck` | Type-check via TypeScript | Checks JS with JSDoc comments against `jsconfig.json` |

### Supabase Backend Management

Project reference: `djnhsgfldbizgqfdpayn` (in `supabase/config.toml`).

| Command | Purpose |
|---|---|
| `supabase db push` | Apply pending migrations from `supabase/migrations/` |
| `supabase functions serve` | Run edge functions locally for testing |
| `supabase functions deploy <name>` | Deploy a single edge function (requires Owner/Admin role; may 403; workaround: Dashboard UI) |
| `supabase secrets set <NAME>=<value>` | Set function environment secrets (e.g., `GEMINI_API_KEY`, `CRON_SECRET`) |

---

## Frontend Architecture

### Structure
```
src/
├── api/           # Backend swap layer (Base44 ↔ Supabase adapter)
├── components/    # React components, grouped by feature
│   ├── dashboard/ # AdminAlerts, ChoreChart, TodayChoreList, ModeScheduler
│   ├── trades/    # TradeRequests
│   ├── workshop/  # AiChoreBuilder
│   ├── zones/     # Zone management, AddChoreDialog
│   ├── layout/    # AppShell (routed layout wrapper)
│   ├── shared/    # Generic/cross-cutting components
│   └── ui/        # ~49 shadcn/Radix primitives
├── pages/         # Route components (Dashboard, Workshop, Leaderboard, etc.)
├── lib/           # Contexts (AuthContext, LocalUserContext), query client, helpers
├── hooks/         # Custom hooks (useHouseholdMode, useMobile, etc.)
└── utils/         # Domain utilities (weekUtils, pin.js, etc.)
```

### Routing

- **Router:** `react-router-dom` v6 (BrowserRouter in `App.jsx`).
- **Protected routes:** Nested under `ProtectedRoute` → `AppShell` → `src/pages/*.jsx` components.
- **Public routes:** `/login`, `/setup`; unmatched → `PageNotFound`.
- **Note:** `Register`, `ForgotPassword`, `ResetPassword` components exist but have no public route entry points.

### State Management & Data Fetching

- **Server cache:** `@tanstack/react-query` v5 (client in `src/lib/query-client.js`, `refetchOnWindowFocus: false`, `retry: 1`).
- **Local state:** React Context for auth (`AuthContext.jsx`) and device-scoped role/PIN gating (`LocalUserContext.jsx`).
- **Import pattern:** Always import backend via `@/api/base44Client`; the Vite alias at build time reroutes to the adapter.

### Backend Swap Layer (Critical)

The **backend is swappable at runtime.** The mechanism:

1. Vite alias (highest priority): `@/api/base44Client` → `src/api/backendAdapter.js`
2. `backendAdapter.js` reads `VITE_BACKEND` (env var, default: `"base44"`)
3. Returns an implementation:
   - `VITE_BACKEND="supabase"` → `src/api/supabaseAdapter.js`
   - Otherwise → Base44 SDK (legacy fallback)

**Contract:** Both adapters expose:
- `entities` — CRUD methods (`list`, `filter`, `get`, `create`, `update`, `delete`) with PascalCase→snake_case mapping (e.g., `FamilyTask` → `family_tasks`).
- `auth` — authentication (anonymous Supabase session for current flow).
- `integrations.Core.UploadFile` — file uploads to `uploads/<uid>/…` with 1-year signed URLs.
- `functions.invoke` — edge function dispatch via name map.
- `ensureSession()` — lazy anonymous sign-in.

**Important:** Do not import `supabaseAdapter.js`, `supabaseClient.js`, or `realBase44Client.js` directly from components. Always go through the adapter to keep the swap intact.

---

## Backend (Supabase)

### Edge Functions — `supabase/functions/<name>/index.ts`

All in Deno/TypeScript. Shared utilities live in `supabase/functions/_shared/cron.ts`.

| Function | JWT verify | Trigger | Purpose |
|---|---|---|---|
| `analyze-chore-photo` | yes | User (HTTP POST) | Gemini 2.5 Flash vision: photo → chore card (`title`, `occurrence`, `stars`, `notes`) |
| `analyze-team-lift-photo` | yes | User (HTTP POST) | Gemini vision: photo → 3-phase Team Lift project |
| `apply-scheduled-mode` | no | Cron (daily 05:05 UTC) | Apply/revert active `scheduled_modes` to household mode; reverts auto-set modes to `normal` |
| `update-streaks` | no | Cron (daily 05:10 UTC) | Per household/member: increment streak if all yesterday's tasks done, else reset |
| `reset-weekly-chores` | no | Cron (Monday 05:15 UTC) | Bulk-reset routine `family_tasks` to `pending`, clear assignments, zero penalties, stamp `week_of` |
| `generate-weekly-recap` | no | Cron (Monday 05:20 UTC) | Compute per-member weekly stats, pick MVP, insert `weekly_recaps` row |

**Cron security:** The 4 cron functions run with `verify_jwt = false` (scheduler has no user JWT). They are protected by a shared `CRON_SECRET` header checked in `cron.ts:assertCronSecret()`.

### Migrations — `supabase/migrations/`

| File | Contents | Status |
|---|---|---|
| `0001_init.sql` | Multi-tenant schema (households, family_members, family_tasks, +9 tables), `handle_new_user` trigger, RLS policy (`household_id = auth.uid()`), public uploads bucket | Auto-applied |
| `0002_private_uploads.sql` | Flip `uploads` to private, add owner-folder SELECT policy (signed URLs only) | Manual (optional hardening) |
| `0003_schedule_cron.sql` | Enable `pg_cron`/`pg_net`, schedule the 4 cron jobs via Vault `cron_secret` | **Manual + prereqs:** deploy functions, `supabase secrets set CRON_SECRET=…`, enable extensions in Dashboard |
| `0004_family_member_pin.sql` | PIN-based access gating for shared devices | Recent addition |

**Migration rules (hard):**
- New migrations are `NNNN_name.sql` (zero-padded, sequential, >max applied number currently `0004`).
- Write migrations as idempotent (`if not exists`, unschedule-before-schedule).
- Write SQL with lowercase keywords.

### Multi-Tenant Behavior

Cron functions:
1. Load all `public.households` using service-role client (bypasses RLS).
2. Iterate over households, running per-household logic filtered by `household_id`.
3. Return `{ ok: true, processed: N, results: [...] }` (one household failure does not abort others).

This replaces the single-family Base44 model.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React + react-router-dom | 18.2 + 6.26 |
| Build | Vite | 6.1 |
| Language | JavaScript/JSX (JS project, not TS) | ES modules |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | 3.4 |
| UI primitives | Radix UI + shadcn/ui + Framer Motion | Various |
| Icons | Lucide React | 0.475 |
| Forms | React Hook Form + Zod | 7.54 + 3.24 |
| Data fetching | TanStack React Query | 5.84 |
| Date handling | date-fns + moment | 3.6 + 2.30 |
| Backend adapters | Supabase JS SDK + Base44 SDK | 2.108 + 0.8–1.0 |
| Edge runtime | Deno (Supabase) | — |
| Payments | Stripe | 5.2 |
| Drag-and-drop | @hello-pangea/dnd | 17.0 |
| Visualization | Recharts, three.js, react-leaflet | Various |
| Lint | ESLint (flat config) | 9.19 |

---

## Environment Setup

Copy `.env.example` → `.env.local` (gitignored, never commit).

| Name | Required when | Purpose | Example |
|---|---|---|---|
| `VITE_BACKEND` | Always | Backend selector (`"base44"` or `"supabase"`) | `supabase` |
| `VITE_SUPABASE_URL` | `VITE_BACKEND=supabase` | Supabase project URL | `https://djnhsgfldbizgqfdpayn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `VITE_BACKEND=supabase` | Anon/publishable key (browser-safe) | `eyJ...` |
| `VITE_BASE44_APP_ID` | `VITE_BACKEND=base44` | Base44 app ID | (legacy; omit if supabase) |
| `VITE_BASE44_FUNCTIONS_VERSION` | `VITE_BACKEND=base44` | Base44 version | (legacy) |
| `VITE_BASE44_APP_BASE_URL` | `VITE_BACKEND=base44` | Base44 backend URL | (legacy) |

**Server-only secrets** (never expose to browser, never commit):
- `GEMINI_API_KEY` — Gemini vision API key; set via `supabase secrets set GEMINI_API_KEY=…`
- `CRON_SECRET` — shared secret for cron job authorization; set via `supabase secrets set CRON_SECRET=…` and Vault
- `service_role` key, DB password — never in `.env.local` or browser

---

## Key Patterns & Conventions

### Backend Access

Always:
```javascript
import { base44Client } from '@/api/base44Client';
const tasks = await base44Client.entities.FamilyTask.list();
```

Never directly import adapters or specific client implementations from components.

### Household & Session

- **Single household per user** (current model): one `households` row per Supabase `auth.users.id`.
- **Anonymous session** (current model): `supabaseAdapter.ensureSession()` lazily creates an anonymous user; no password/OAuth.
- **Multi-family signup/OAuth** planned but not yet implemented; see `TODO.md`.

### PIN Gating (Shared Device)

`src/lib/LocalUserContext.jsx` stores a per-device PIN in `localStorage`. The `pin.js` utility provides PIN generation/validation. Allows role-based task filtering on shared-device households.

### Weekly Task Resets

`reset-weekly-chores` runs Mondays at 05:15 UTC (≈midnight ET). Sets all routine tasks to `pending`, clears `assigned_to`, zeros `stars_penalty`, stamps `week_of`. The migration `0003_schedule_cron.sql` configures the pg_cron job.

### Streaks & Recaps

- **Streaks:** `update-streaks` (05:10 UTC daily) increments streak if all of yesterday's assigned tasks were completed, else resets to 0.
- **Weekly recap:** `generate-weekly-recap` (05:20 UTC Monday) computes per-member star and chore counts from the previous week, picks an MVP, and inserts a `weekly_recaps` row.

### Drag-and-drop Task Assignment

Uses `@hello-pangea/dnd`. Drag behavior is implemented in `src/components/dashboard/TodayChoreList.jsx` and related components.

### Admin Alerts

`src/components/dashboard/AdminAlerts.jsx` displays alerts; model is `admin_alerts` table, RLS-protected by household. Alerts are created by cron functions or during task updates.

---

## Known Issues & Gotchas

1. **Do not edit Base44-synced files.** ~33 components plus `base44/entities/*.jsonc` and `base44/functions/*` are two-way synced with the Base44 builder. Route UI changes through Base44, not by editing files directly.

2. **`filter()` can silently return `[]`.** The Supabase adapter's `filter()` was missing `ensureSession()`, causing RLS to silently return empty results on cold load (recently fixed in `supabaseAdapter.js` line 74).

3. **`functions deploy` may 403.** The CLI login may lack Owner/Admin permissions. Workaround: Deploy via the Supabase Dashboard UI (paste function code).

4. **Storage privacy risk:** The `uploads` bucket may still be public-read (privacy concern for child/home photos). Apply `0002_private_uploads.sql` and verify it is applied.

5. **Auth is client-side only.** Anonymous Supabase session + hardcoded `ADMIN_PIN='1234'`; the DB enforces no roles. This is a known architectural open item; do not rely on it for real authorization.

6. **Unreachable routes:** `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` exist but have no public route entry point.

7. **Cron job timing:** All times are UTC. America/New_York is UTC−5 (EST) or UTC−4 (EDT); 05:xx UTC ≈ midnight–1am ET. Monday jobs must run in this order: reset (05:15) → recap (05:20).

8. **`pg_cron`/`pg_net` extensions:** Cannot be enabled via DDL on hosted Supabase; use the Dashboard toggle (Extensions tab).

---

## Handoff & Planning Docs

See these for in-flight work & context:
- `HANDOFF/codebase-scan_2026-06-19.md` — codebase audit and open items.
- `HANDOFF/supabase-migration-handoff_2026-06-19_1747.md` — detailed migration status.
- `TODO.md` — next steps (multi-family signup, Google OAuth, authorization hardening).

---

## Quick Reference

**Frontend hot-reload:** Edit `src/**/*.jsx` → browser auto-refreshes (Vite + React Fast Refresh).

**Test an edge function locally:**
```bash
supabase functions serve
curl -X POST http://localhost:54321/functions/v1/analyze-chore-photo \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"file_url": "..."}'
```

**Deploy migration:**
```bash
supabase db push
# Or manually paste into Dashboard SQL Editor
```

**Type-check without building:**
```bash
npm run typecheck
```

**View logs (Supabase Functions):**
```bash
# Dashboard → Functions → edge-function-name → Logs tab
```

---

## Notes for Future Developers

- This codebase is actively transitioning from Base44 to Supabase; expect in-flight refactoring.
- The backend swap layer (`backendAdapter.js`) is load-bearing; changes to the Supabase adapter should maintain the Base44-shaped surface.
- Cron functions are idempotent and multi-tenant; modifications should preserve both properties.
- The app currently enforces authorization via PIN on the client; real authorization should be added before expanded access.
