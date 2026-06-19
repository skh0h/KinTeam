import { supabase } from './supabaseClient';

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
  HuddleNote: 'huddle_notes',
  WeeklyRecap: 'weekly_recaps',
};

// Edge function name map
const FN_MAP = {
  analyzeChorePhoto: 'analyze-chore-photo',
  analyzeTeamLiftPhoto: 'analyze-team-lift-photo',
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
    // For tables that FK to households, we upsert the household row first so the
    // foreign-key constraint is always satisfied (handles new users whose trigger
    // didn't fire or whose migration was applied after signup).
    async create(values) {
      await ensureSession();
      const { household_id: _drop, ...safeValues } = values ?? {};

      // Ensure a households row exists for the current user before inserting
      // into any table that has household_id FK → households(id).
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw { status: 401, message: 'Not authenticated' };
      const { error: upsertError } = await supabase
        .from('households')
        .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
      if (upsertError) throw upsertError;

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
let _ensureSessionPromise = null;

export function ensureSession() {
  if (_ensureSessionPromise) return _ensureSessionPromise;
  _ensureSessionPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return data.session;
    } finally {
      _ensureSessionPromise = null;
    }
  })();
  return _ensureSessionPromise;
}

// --- Storage ---
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
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

// --- Edge Functions ---
const functions = {
  // invoke(name, payload) → { data }
  // Callers read response.data (e.g. AiChoreBuilder reads result.data.title)
  async invoke(name, payload) {
    const mapped = FN_MAP[name];
    if (!mapped) throw new Error(`Unknown function: ${name}`);
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
