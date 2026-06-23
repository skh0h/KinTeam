import { supabase } from './supabaseClient';

/**
 * Supabase backend adapter — entity and functions surface contract.
 *
 * @typedef {Object} EntityClient
 * @property {(sortField?: string, limit?: number) => Promise<Array>} list
 *   Fetch all rows. sortField may be prefixed with '-' for descending.
 * @property {(criteria: Record<string, unknown>) => Promise<Array>} filter
 *   Fetch rows matching every key=value pair in criteria.
 * @property {(id: string) => Promise<Object>} get
 *   Fetch a single row by primary key.
 * @property {(values: Object) => Promise<Object>} create
 *   Insert a row; household_id is stripped (set by DB default). Returns inserted row.
 * @property {(id: string, values: Object) => Promise<Object>} update
 *   Update a row by primary key; household_id is stripped. Returns updated row.
 * @property {(id: string) => Promise<void>} delete
 *   Delete a row by primary key.
 *
 * functions.invoke(name, payload) → { data }
 *   Dispatches to an Edge Function via FN_MAP. Names not in FN_MAP that are
 *   in DEFERRED are silently skipped (no-op) rather than thrown.
 *
 * integrations.Core.UploadFile({ file }) → { file_url }
 *   Uploads a file to the 'uploads' storage bucket and returns a signed URL.
 */

// PascalCase entity name → postgres table name
const TABLE_MAP = {
  FamilyTask: 'family_tasks',
  FamilyMember: 'family_members',
  AdminAlert: 'admin_alerts',
  ScheduledMode: 'scheduled_modes',
  HouseholdSettings: 'household_settings',
  StarReward: 'star_rewards',
  RewardRedemption: 'reward_redemptions',
  ChoreTrade: 'chore_trades',
  SystemZone: 'system_zones',
  WeeklyRecap: 'weekly_recaps',
  FamilyPet: 'family_pet',
  Kudos: 'kudos',
  ShoutOut: 'shout_outs',
};

// Module-level flag: household upsert is idempotent per session; run it at most once.
let _householdEnsured = false;

// Edge function name map
const FN_MAP = {
  analyzeChorePhoto: 'analyze-chore-photo',
  analyzeTeamLiftPhoto: 'analyze-team-lift-photo',
  analyzeEventPhoto: 'analyze-event-photo',
};

function makeEntity(tableName) {
  return {
    // list(sortField?, limit?) → bare array
    // sortField: leading '-' = descending, e.g. '-created_date'
    async list(sortField, limit) {
      await ensureSession();
      let q = supabase.from(tableName).select('*');
      if (sortField) {
        const desc = sortField.startsWith('-');
        const col = desc ? sortField.slice(1) : sortField;
        q = q.order(col, { ascending: !desc });
      }
      if (limit != null) {
        q = q.limit(limit);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    // filter({key: value, ...}) → bare array
    async filter(criteria) {
      await ensureSession(); // C-2: was missing; RLS silently returned [] on cold load (S-1 race also resolved here)
      let q = supabase.from(tableName).select('*');
      for (const [k, v] of Object.entries(criteria)) {
        q = q.eq(k, v);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    // create(values) → inserted row (callers use .id)
    // household_id is stamped by the DB column default (auth.uid()); do not pass it.
    // The households upsert (FK guard) now runs inside ensureSession() so all entity
    // operations benefit from it, not just create().
    async create(values) {
      await ensureSession();
      const { household_id: _drop, ...safeValues } = values ?? {};

      const { data, error } = await supabase
        .from(tableName)
        .insert(safeValues)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // update(id, values) → updated row
    async update(id, values) {
      await ensureSession();
      const { household_id: _drop, ...safeValues } = values ?? {};
      const { data, error } = await supabase
        .from(tableName)
        .update(safeValues)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // delete(id)
    async delete(id) {
      await ensureSession();
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  };
}

// Build entities object from table map
const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([name, table]) => [name, makeEntity(table)])
);

// --- Auth bridge ---
// NOTE: The LocalUserContext localStorage layer (role/PIN gating, allhands_local_user)
// is provider-agnostic and flows through FamilyMember entity — no changes needed there.
const auth = {
  // me() → user object with at least { role }
  // Throws { status: 401 } if no active session (matches Base44 auth error shape)
  async me() {
    await ensureSession();
    // L-2: ensureSession() returns the session object but not the full user profile
    // (which includes user_metadata). supabase.auth.getUser() is a separate call that
    // validates the JWT server-side and returns the canonical user record. Reusing the
    // session token here would skip that validation and could return stale metadata.
    // Left as two calls intentionally to preserve the auth guarantee.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw { status: 401, message: 'Not authenticated' };
    return {
      ...user,
      role: user.user_metadata?.role ?? 'user',
    };
  },

  // logout(redirectUrl?)
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  // redirectToLogin(returnUrl?)
  redirectToLogin(returnUrl) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },

  // register({ email, password, ... })
  async register(params) {
    const { data, error } = await supabase.auth.signUp(params);
    if (error) throw error;
    return data;
  },

  // verifyOtp({ email, otpCode }) → { access_token }
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup',
    });
    if (error) throw error;
    return { access_token: data.session?.access_token };
  },

  // setToken — no-op: supabase-js persists the session automatically
  setToken() {},

  // resendOtp(email)
  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  // loginWithProvider('google', redirectPath)
  async loginWithProvider(provider, redirectPath) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + (redirectPath || '/'),
      },
    });
    if (error) throw error;
  },

  // resetPasswordRequest(email) — sends recovery email
  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
  },

  // resetPassword({ resetToken, newPassword })
  // resetToken is ignored — Supabase uses the active recovery session from the URL hash
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  // updateMe({ password, ... }) — update current user attributes
  async updateMe(attrs) {
    const { data, error } = await supabase.auth.updateUser(attrs);
    if (error) throw error;
    return data;
  },
};

// --- ensureSession ---
// Shared-device model: one Supabase identity per household. On first visit (no
// session yet) we sign in anonymously so auth.uid() is always non-null, which
// satisfies the RLS `household_id = auth.uid()` check. The anonymous session is
// upgradeable later via signUp/OTP (Register.jsx flow) without losing data.
//
// Concurrent-call guard: module-level promise is reused by all simultaneous
// callers (e.g. list() + list() fired together on mount). Once the promise
// settles it is cleared so the next cold start can re-check the session.
//
// M-1: On sign-in failure, all concurrent awaiters reject together by design —
// the single shared promise propagates the error to every caller, which surfaces
// it to the UI. This is intentional: a broken session should fail loudly, not
// silently. S-1 (filter() race leading to unauthenticated RLS) is resolved by
// fix C-2 above, which adds ensureSession() as the first line of filter().
let _ensureSessionPromise = null;

export function ensureSession() {
  if (_ensureSessionPromise) return _ensureSessionPromise;
  _ensureSessionPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      // Ensure a households row exists for the current user. Runs at most once per
      // session (M-4: idempotent upsert, but avoids a round-trip on every call).
      // Placed here so every entity operation benefits, not just create().
      if (!_householdEnsured) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw { status: 401, message: 'Not authenticated' };
        const { error: upsertError } = await supabase
          .from('households')
          .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
        if (upsertError) throw upsertError;
        _householdEnsured = true;
      }
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      return currentSession;
    } finally {
      _ensureSessionPromise = null;
    }
  })();
  return _ensureSessionPromise;
}

// --- Storage ---

// Signed URL TTL: 1 year in seconds.
//
// Tradeoff: a long-lived signed URL is stored directly in entity rows because
// the Base44-synced components read `file_url` at render time and cannot be
// edited to re-sign on each read. A 1-year TTL is far better than public-read
// (URLs are now unguessable, scoped, and expirable), but the URL will stop
// working after the TTL expires.
//
// Future enhancement: store the storage PATH in entity rows instead of the
// signed URL, then re-sign inside the adapter's list/get methods on every
// fetch — giving fresh short-TTL URLs without any component changes.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw { status: 401, message: 'Not authenticated' };
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: signedData, error: signedError } = await supabase.storage
        .from('uploads')
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signedError) throw signedError;
      return { file_url: signedData.signedUrl };
    },
  },
};

// --- Edge Functions ---
const functions = {
  // invoke(name, payload) → { data }
  // Callers read response.data (e.g. AiChoreBuilder reads result.data.title)
  async invoke(name, payload) {
    const mapped = FN_MAP[name];
    if (!mapped) {
      // CRITICAL-2: These 5 functions are pg_cron-triggered edge endpoints scheduled
      // in migrations 0003/0006 — they are called directly by the DB scheduler, not
      // from the frontend. Intentionally not in FN_MAP; no-op here is correct.
      const DEFERRED = ['resetWeeklyChores', 'updateStreaks', 'applyScheduledMode', 'generateWeeklyRecap', 'rollEvents'];
      if (DEFERRED.includes(name)) {
        console.warn(`[supabaseAdapter] "${name}" is pg_cron-triggered and not frontend-routable — skipping.`);
        return { data: null };
      }
      throw new Error(`Unknown function: ${name}`);
    }
    const { data, error } = await supabase.functions.invoke(mapped, {
      body: payload,
    });
    if (error) throw error;
    return { data };
  },
};

export const supabaseBase44 = {
  entities,
  auth,
  integrations,
  functions,
};
