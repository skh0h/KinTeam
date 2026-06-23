# Auth Overhaul Runbook — 2026-06-20

**Status:** Not started. All phases below are gated operator work.  
**Applies to:** KinTeam Supabase project `djnhsgfldbizgqfdpayn`  
**Author note:** This runbook accompanies `supabase/migrations/0009_auth_overhaul.sql`, which contains only the additive-safe changes. Every phase below is manual and operator-gated. No phase in this document is applied automatically.

---

## The Single Biggest Risk

**The households identity inversion.** Currently `households.id = auth.uid()` — the Supabase anonymous user's UID *is* the household primary key, and every RLS policy, every FK, and every cron query depends on this equality. After the cutover, `households.id` becomes an independent UUID and real auth users link to households via `family_members.auth_uid`. Until the data migration (Phase 4) completes and is verified, applying the RLS cutover (Phase 5) will lock every user out of their data. **Do not skip or reorder phases.**

---

## Phase 1 — Storage Privacy Verification

Resolve scan item #2: the `uploads` bucket may still be public-read.

**Check current state (run in Dashboard SQL Editor → SQL):**
```sql
select id, public from storage.buckets where id = 'uploads';
```

- If `public = false`: already hardened, skip to Phase 2.
- If `public = true`: apply `supabase/migrations/0002_private_uploads.sql` via Dashboard SQL Editor. Expected result after re-running the check: `public = false`.

**Note:** After flipping to private, the `public select` storage policy in `0001_init.sql` (line 286) will stop working. The signed-URL approach in `0002_private_uploads.sql` must be confirmed working for Edge Function photo uploads before this phase closes.

---

## Phase 2 — Google Cloud Console: Create OAuth Client

1. Open [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID.
2. Application type: **Web application**.
3. Authorized redirect URIs — add **exactly**:
   ```
   https://djnhsgfldbizgqfdpayn.supabase.co/auth/v1/callback
   ```
4. Save. Copy the **Client ID** and **Client Secret** — you will need them in Phase 3.

---

## Phase 3 — Supabase Dashboard: Enable Google Provider

1. Open Supabase Dashboard → Authentication → Providers → Google.
2. Enable the provider. Paste the Client ID and Client Secret from Phase 2.
3. Under **Redirect URLs** (Authentication → URL Configuration), add:
   - Your production domain, e.g. `https://your-kinteam-domain.com/`
   - `http://localhost:5180/`
4. **Keep anonymous sign-ins ON.** Do not disable them until Phase 8 (the last step).
5. Verify the Google sign-in flow end-to-end in a browser before proceeding.

---

## Phase 4 — Data Migration: Anonymous Household → UUID-Based Household

> **BACK UP THE DATABASE FIRST.**
> In Dashboard → Settings → Database → Backups, trigger a manual backup and confirm it completes before running any of the SQL below.

This migration:
- Generates a new UUID for each existing household (breaking the `households.id = auth.uid()` equality).
- Repoints all FK `household_id` references in every child table.
- Sets `households.owner_uid` to the old anonymous user UID (preserves traceability).
- Seeds the admin family member's `auth_uid` once they sign in with Google (cannot be automated here; see step 7 below).

**Run in Dashboard SQL Editor — one statement at a time, verify between each:**

```sql
-- Step 1: Create a mapping table (old anon uid -> new household uuid)
-- Run this in a transaction.
begin;

create temp table household_id_map as
  select
    id                    as old_id,
    gen_random_uuid()     as new_id
  from public.households;

-- Step 2: Update households.id to new UUIDs, set owner_uid = old anon uid
-- FK cascade is not available here because id is the PK; we update child tables manually.
-- Temporarily disable FK checks is not possible in Postgres; we must update children first.

-- Step 2a: Update all child tables to point at new_id
update public.family_members fm
  set household_id = m.new_id
  from household_id_map m
  where fm.household_id = m.old_id;

update public.family_tasks ft
  set household_id = m.new_id
  from household_id_map m
  where ft.household_id = m.old_id;

update public.admin_alerts aa
  set household_id = m.new_id
  from household_id_map m
  where aa.household_id = m.old_id;

update public.scheduled_modes sm
  set household_id = m.new_id
  from household_id_map m
  where sm.household_id = m.old_id;

update public.household_settings hs
  set household_id = m.new_id
  from household_id_map m
  where hs.household_id = m.old_id;

update public.star_rewards sr
  set household_id = m.new_id
  from household_id_map m
  where sr.household_id = m.old_id;

update public.reward_redemptions rr
  set household_id = m.new_id
  from household_id_map m
  where rr.household_id = m.old_id;

update public.chore_trades ct
  set household_id = m.new_id
  from household_id_map m
  where ct.household_id = m.old_id;

update public.system_zones sz
  set household_id = m.new_id
  from household_id_map m
  where sz.household_id = m.old_id;

update public.huddle_notes hn
  set household_id = m.new_id
  from household_id_map m
  where hn.household_id = m.old_id;

update public.weekly_recaps wr
  set household_id = m.new_id
  from household_id_map m
  where wr.household_id = m.old_id;

-- Step 2b: The households table has id as PK referenced by auth.users FK (on delete cascade).
-- households.id currently references auth.users(id). After this migration it must be
-- an independent UUID. That requires dropping and recreating the PK/FK — see note below.
-- This step requires careful DDL; consult Supabase support if blocked.
-- Simplified approach: add a new surrogate PK column, migrate, then rename.
-- (Detailed DDL intentionally omitted here — perform with DBA review.)

-- Step 2c: Stamp owner_uid on each household with the old anonymous auth.uid
update public.households h
  set owner_uid = m.old_id
  from household_id_map m
  where h.id = m.old_id;  -- still matches before the PK swap

commit;
```

**Step 7 — Seed admin auth_uid after Google sign-in:**  
Once the admin family member signs in with Google for the first time, their new `auth.users.id` (Google-linked) will differ from the old anon UID. Run:
```sql
update public.family_members
  set auth_uid = '<new-google-auth-uid>'
  where household_id = '<new-household-uuid>'
    and role = 'admin';
```
Verify `select auth_uid, role from public.family_members where household_id = '<id>';` shows the correct auth_uid before proceeding to Phase 5.

---

## Phase 5 — RLS Cutover DDL

**Apply ONLY after Phase 4 is complete and verified.**  
**Keep anonymous sign-ins ON during this phase** — existing anonymous sessions need to continue until all members have signed in with Google.

This DDL drops the old `household_id = auth.uid()` policies and replaces them with role-aware policies that use `current_member_context()` (added in migration 0009).

**Pre-cutover audit — run first:**
```bash
grep -rn "auth.uid\|getUser\|user\.id" src/
```
Every location in `src/` that treats `auth.uid()` as a `household_id` must be updated in the frontend before applying these policies, or those calls will silently return empty results.

```sql
-- ─── family_tasks ─────────────────────────────────────────────────────────
drop policy if exists "family own rows" on public.family_tasks;

-- Members can read and insert their household's tasks
create policy "members read family tasks" on public.family_tasks
  for select to authenticated
  using (
    household_id in (select household_id from public.current_member_context())
  );

create policy "members insert family tasks" on public.family_tasks
  for insert to authenticated
  with check (
    household_id in (select household_id from public.current_member_context())
  );

create policy "members update family tasks" on public.family_tasks
  for update to authenticated
  using (
    household_id in (select household_id from public.current_member_context())
  )
  with check (
    household_id in (select household_id from public.current_member_context())
  );

-- Only admins can delete tasks
create policy "admin delete family tasks" on public.family_tasks
  for delete to authenticated
  using (
    household_id in (
      select household_id from public.current_member_context() where role = 'admin'
    )
  );

-- ─── household_settings ───────────────────────────────────────────────────
drop policy if exists "family own rows" on public.household_settings;

create policy "admin manage household settings" on public.household_settings
  for all to authenticated
  using (
    household_id in (
      select household_id from public.current_member_context() where role = 'admin'
    )
  )
  with check (
    household_id in (
      select household_id from public.current_member_context() where role = 'admin'
    )
  );

-- ─── family_members ───────────────────────────────────────────────────────
-- NOTE: Do NOT use current_member_context() here — it queries family_members,
-- which would cause infinite RLS recursion. Use a direct self-join on auth_uid instead.
drop policy if exists "family own rows" on public.family_members;

-- All members of the same household can read member rows
create policy "members read family members" on public.family_members
  for select to authenticated
  using (
    household_id = (
      select m2.household_id
      from public.family_members m2
      where m2.auth_uid = auth.uid()
      limit 1
    )
  );

-- Only admins can insert, update, or delete member rows
create policy "admin manage family members" on public.family_members
  for insert to authenticated
  with check (
    household_id = (
      select m2.household_id
      from public.family_members m2
      where m2.auth_uid = auth.uid()
        and m2.role = 'admin'
      limit 1
    )
  );

create policy "admin update family members" on public.family_members
  for update to authenticated
  using (
    household_id = (
      select m2.household_id
      from public.family_members m2
      where m2.auth_uid = auth.uid()
        and m2.role = 'admin'
      limit 1
    )
  )
  with check (
    household_id = (
      select m2.household_id
      from public.family_members m2
      where m2.auth_uid = auth.uid()
        and m2.role = 'admin'
      limit 1
    )
  );

create policy "admin delete family members" on public.family_members
  for delete to authenticated
  using (
    household_id = (
      select m2.household_id
      from public.family_members m2
      where m2.auth_uid = auth.uid()
        and m2.role = 'admin'
      limit 1
    )
  );

-- ─── Remaining tables (admin_alerts, scheduled_modes, star_rewards, etc.) ──
-- Apply the same pattern: drop "family own rows", create read policy using
-- current_member_context() for read/insert/update, and admin-only for delete.
-- Omitted here for brevity; follow the family_tasks template above.
```

---

## Phase 6 — handle_new_user() Trigger Rewrite

Replace the current trigger (which sets `households.id = new.id`) with one that generates an independent household UUID and seeds the creating user as the admin member.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := gen_random_uuid();
  v_display_name text;
begin
  -- Resolve display name from Google OAuth metadata or email prefix
  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Admin'
  );

  -- Create the household with the new independent UUID
  insert into public.households (id, name, owner_uid)
  values (v_household_id, v_display_name || '''s Household', new.id)
  on conflict do nothing;

  -- Seed the creating user as the admin family member
  insert into public.family_members (household_id, name, display_name, role, auth_uid)
  values (v_household_id, v_display_name, v_display_name, 'admin', new.id)
  on conflict do nothing;

  return new;
end;
$$;
```

**This trigger fires on new signups only.** Existing households are migrated via Phase 4. Apply this rewrite before re-enabling self-serve signup.

---

## Phase 7 — Frontend AuthContext.jsx Rewrite Sketch

Replace the current Base44 `auth.me()` polling with Supabase's native auth state listener:

```javascript
// src/lib/AuthContext.jsx — post-cutover shape
import { supabase } from '@/api/supabaseClient';
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [household, setHousehold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate from existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadHousehold(session.user.id);
      else setIsLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) loadHousehold(session.user.id);
        else { setHousehold(null); setIsLoading(false); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadHousehold(userId) {
    // After cutover, household is found via family_members.auth_uid
    const { data } = await supabase
      .from('family_members')
      .select('household_id, role, households(id, name)')
      .eq('auth_uid', userId)
      .single();
    setHousehold(data?.households ?? null);
    setIsLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, household, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

Key changes from current implementation:
- No more `base44.auth.me()` polling.
- `household` is resolved via `family_members.auth_uid`, not `auth.uid() = household.id`.
- `isLoading` prevents protected routes from rendering before auth is resolved.
- `signOut` calls Supabase directly.

---

## Phase 8 — Remove Anonymous Session Fallback (LAST STEP)

**Apply ONLY after:**
- All family members have signed in with Google at least once (their `auth_uid` is populated in `family_members`).
- Phase 5 RLS policies are live and verified.
- Phase 7 frontend is deployed.

In `src/api/supabaseAdapter.js`, replace `ensureSession()`:

```javascript
// BEFORE (anonymous fallback):
async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await supabase.auth.signInAnonymously();
  }
}

// AFTER (hard redirect — no anonymous fallback):
async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('401: No active session. Redirecting to login.');
    // Callers should catch this and redirect to /login.
  }
}
```

Also disable anonymous sign-ins in Supabase Dashboard → Authentication → Providers → Anonymous once the above is deployed and verified.

---

## Phase 9 — Pre-Cutover Frontend Audit

Run before Phase 5:
```bash
grep -rn "auth\.uid\|getUser\|user\.id" src/
```

Check each result:
- Any place that uses `auth.uid()` (or its JS equivalent `session.user.id`) as a `household_id` will break after the identity inversion.
- Specifically audit: `AuthContext.jsx`, `LocalUserContext.jsx`, `supabaseAdapter.js` (the `list`/`filter`/`create` methods that pass `household_id` defaults).
- Fix each call site to use `household.id` from the `AuthContext` instead of `user.id`.

---

## Safe Rollout Order

| Phase | Action | Blocking Prereq |
|-------|--------|-----------------|
| 1 | Storage privacy verification | None |
| 2 | Google OAuth client in GCP | None |
| 3 | Enable Google provider in Supabase | Phase 2 |
| 0009 migration | Apply additive-only SQL | None (safe any time) |
| 9 | Frontend audit grep | None |
| 7 | Frontend AuthContext rewrite + deploy | Phase 3, Phase 9 |
| 4 | Data migration (DB backup first) | Phase 7 deployed |
| 6 | handle_new_user trigger rewrite | Phase 4 |
| 5 | RLS cutover DDL | Phase 4, Phase 7 |
| 8 | Remove anonymous fallback + disable anon sign-ins | Phase 5 verified |

**Do not skip phases or apply Phase 5 before Phase 4.** The RLS cutover without the data migration will lock all existing households out of their data.
