# KinTeam Authentication & Trust Model

**Document Date:** 2026-06-19  
**Status:** Trusted Shared Device (Option B, as of remediation pass)

---

## Security Posture

KinTeam currently operates under a **single trusted household device** security model.

### How It Works

- **Entry Point:** Every visitor to the app signs in anonymously via Supabase `signInAnonymously()` in `src/api/supabaseAdapter.js:216`.
- **Session Scope:** The anonymous session is household-scoped; RLS policies restrict queries to a single `household_id`.
- **Admin Gating:** Admin-only actions (approvals, member management, schedule changes) are gated by a **hashed PIN** stored per family member in `family_members.pin_hash`. The PIN is validated in React before mutations.

### What This Means

- **Database-level access is unrestricted by role.** RLS only checks `household_id = auth.uid()` with no role distinction. Any household member can read and write all household data at the database level.
- **The PIN is a UX boundary, not a security boundary.** It prevents accidental admin actions by non-admin members, but does not prevent direct database manipulation.
- **Not suitable for untrusted household members.** If you do not trust all people in your household, this model does not protect you.

### Current Limitations

- No per-member identities or role claims
- No server-side authorization (RLS is household-scoped only)
- Weekly jobs (resetWeeklyChores, updateStreaks, applyScheduledMode, generateWeeklyRecap) are deferred and currently do not run
- No multi-factor authentication (MFA)
- No password-based auth (PIN only, no email/Google sign-in for self-serve signup)

---

## Future: Real Authorization (Tracked in TODO.md)

The following improvements are deferred to a future pass:

1. **Per-member identities** — Make household members real Supabase auth accounts (email or Google OAuth).
2. **Role-based access control** — Add role claims and enforce admin-only mutations with security-definer RLS policies.
3. **Self-serve signup & password recovery** — Reimplement Register / ForgotPassword / ResetPassword pages.

See `/TODO.md` under "Auth / Identity (future)" and "Architecture refactors" for full details.

---

## For Users

- ✅ Use KinTeam for trusted household settings (family, roommates you trust, small teams).
- ❌ Do not use KinTeam in settings where you need to restrict who can edit chores, approvals, or member data.

---

## For Developers

- Hashed PIN logic: `src/lib/pin.js`
- Admin gating: Check for `isAdmin` flag in React (e.g., `Dashboard.jsx:43,48,50`)
- Database RLS: `supabase/migrations/0001_init.sql:202-255`
- Adapter contract (anonymous session): `src/api/supabaseAdapter.js:216-230`
