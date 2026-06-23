import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ────────────────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Reads x-cron-secret header and compares to CRON_SECRET env var.
 * Throws a 401 Response if missing or mismatched (catch + return it).
 * These functions run with verify_jwt=false so this header is the only gate.
 */
export function assertCronSecret(req: Request): void {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw jsonResponse({ error: 'Unauthorized' }, 401);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Service client (bypasses RLS) ───────────────────────────────────────────

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ─── Timezone helpers (America/New_York) ──────────────────────────────────────

/** Formats a UTC Date as a YYYY-MM-DD string in America/New_York. */
function formatET(d: Date): string {
  // 'en-CA' locale uses ISO date order (YYYY-MM-DD) natively.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

/**
 * Returns the current date/time as a plain Date whose year/month/day/hour
 * values match the wall-clock time in America/New_York.
 * Use getFullYear(), getMonth(), getDate(), getDay() etc on the returned value.
 *
 * NOTE: this Date's internal UTC milliseconds are NOT a true UTC timestamp —
 * they represent ET wall-clock values. Only use it for .getDay()/.getDate()
 * comparisons, not for .toISOString() date strings (use nyToday() etc. instead).
 */
export function nyNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Returns today's date string (YYYY-MM-DD) in America/New_York.
 * Correct at all hours including the ET/UTC midnight overlap window.
 */
export function nyToday(): string {
  return formatET(new Date());
}

/**
 * Returns yesterday's date string (YYYY-MM-DD) in America/New_York.
 * Correct at all hours including the ET/UTC midnight overlap window.
 */
export function nyYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return formatET(d);
}

/**
 * Returns a Date object representing the Monday of the week containing `d`,
 * using the same logic as the Base44 originals (Sunday = -6 days, else 1 - weekday).
 * `d` must be a Date returned by nyNow() (ET wall-clock Date).
 */
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

/**
 * Returns this week's Monday date string (YYYY-MM-DD) in America/New_York.
 * Correct at all hours including the ET/UTC midnight overlap window.
 */
export function weekOfMonday(): string {
  // Compute the real UTC Date, then find Monday offset using ET weekday.
  const nowUtc = new Date();
  const dayET = nyNow().getDay(); // ET weekday (0=Sun)
  const diff = dayET === 0 ? -6 : 1 - dayET;
  const mondayUtc = new Date(nowUtc);
  mondayUtc.setUTCDate(nowUtc.getUTCDate() + diff);
  return formatET(mondayUtc);
}

/**
 * Returns all 7 date strings (YYYY-MM-DD) for the week starting on the given
 * Monday Date. `monday` must be a Date returned by nyNow() (ET wall-clock Date).
 * Date strings are formatted in America/New_York to stay consistent with ET.
 */
export function weekDatesFrom(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    // monday is an ET-wall-clock Date; adding days then formatting via
    // Intl.DateTimeFormat gives correct ET date strings even if the internal
    // UTC value drifts — because en-CA/ET re-anchors to the correct calendar day.
    dates.push(formatET(d));
  }
  return dates;
}

export const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
