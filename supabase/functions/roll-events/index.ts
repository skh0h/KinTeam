/**
 * roll-events
 *
 * Daily cron function (runs 05:00 UTC ≈ midnight ET).
 * For every non-archived family_event, determines whether today (ET) is a
 * scheduled occurrence and rolls status accordingly:
 *
 *   - IS an occurrence + was 'done': append yesterday's date to completed_dates,
 *     set status = 'pending' (new occurrence opens).
 *   - IS an occurrence + was 'pending': leave alone (still in progress).
 *   - NOT an occurrence: leave alone.
 *
 * Cadence rules (all day comparisons in America/New_York):
 *   nightly     — every day is an occurrence
 *   weekly      — today's weekday name is in `days`
 *   semiweekly  — today's weekday name is in `days`
 *   fortnightly — today's weekday name is in `days` AND the number of whole
 *                 weeks since start_date is EVEN (0, 2, 4, …)
 *
 * Protected by x-cron-secret header (verify_jwt=false in config.toml).
 * Uses service-role client to bypass RLS and process all households.
 */

import {
  assertCronSecret,
  serviceClient,
  nyNow,
  nyToday,
  nyYesterday,
  DAY_NAMES,
  jsonResponse,
  CORS_HEADERS,
} from '../_shared/cron.ts';

/** Returns true if today (ET) is a scheduled occurrence for the given event. */
function isOccurrenceToday(
  cadence: string,
  days: string[],
  startDate: string | null,
  todayWeekday: string,
): boolean {
  switch (cadence) {
    case 'nightly':
      return true;

    case 'weekly':
    case 'semiweekly':
      return days.includes(todayWeekday);

    case 'fortnightly': {
      if (!days.includes(todayWeekday)) return false;
      if (!startDate) return true; // no anchor — always fire on correct weekday

      // Count whole calendar-weeks from start_date to today (ET), matching
      // date-fns differenceInCalendarWeeks(today, start, { weekStartsOn: 1 }).
      // Both sides are snapped to the Monday of their respective week so that
      // a mid-week start_date doesn't shift parity relative to the frontend.
      const [sy, sm, sd] = startDate.split('-').map(Number);
      // Represent both dates as UTC noon to avoid DST boundary issues when
      // computing the difference in whole days.
      const anchorMs = Date.UTC(sy, sm - 1, sd, 12, 0, 0);
      const todayStr = nyToday();
      const [ty, tm, td] = todayStr.split('-').map(Number);
      const todayMs = Date.UTC(ty, tm - 1, td, 12, 0, 0);

      // Snap anchor to Monday of its week (weekStartsOn: 1, matching date-fns).
      const anchorDate = new Date(anchorMs);
      const anchorDow = anchorDate.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
      const anchorDaysToMonday = anchorDow === 0 ? 6 : anchorDow - 1;
      const anchorMondayMs = anchorMs - anchorDaysToMonday * 24 * 60 * 60 * 1000;

      // Snap today to Monday of its week.
      const todayDate = new Date(todayMs);
      const todayDow = todayDate.getUTCDay();
      const todayDaysToMonday = todayDow === 0 ? 6 : todayDow - 1;
      const todayMondayMs = todayMs - todayDaysToMonday * 24 * 60 * 60 * 1000;

      if (todayMondayMs < anchorMondayMs) return false; // today is before the anchor week

      const wholeWeeks = Math.round((todayMondayMs - anchorMondayMs) / (7 * 24 * 60 * 60 * 1000));
      return wholeWeeks % 2 === 0; // even weeks: week 0, 2, 4, … are "on" weeks
    }

    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    assertCronSecret(req);
  } catch (resp) {
    return resp as Response;
  }

  const db = serviceClient();

  // Today's weekday name in ET (lowercase, e.g. 'monday')
  const todayWeekday = DAY_NAMES[nyNow().getDay()];
  const today = nyToday();
  const yesterday = nyYesterday();

  // Load all households
  const { data: households, error: hhErr } = await db.from('households').select('id');
  if (hhErr) {
    return jsonResponse({ error: `Failed to load households: ${hhErr.message}` }, 500);
  }

  let processed = 0;
  const results: unknown[] = [];

  for (const hh of households ?? []) {
    const hid = hh.id as string;
    try {
      // Load all non-archived events for this household
      const { data: events, error: evErr } = await db
        .from('family_events')
        .select('id, cadence, days, start_date, status, completed_dates')
        .eq('household_id', hid)
        .eq('archived', false);

      if (evErr) throw new Error(`fetch family_events: ${evErr.message}`);

      let rolled = 0;

      for (const ev of events ?? []) {
        const cadence = ev.cadence as string;
        const days = (ev.days ?? []) as string[];
        const startDate = ev.start_date as string | null;
        const status = ev.status as string;
        const completedDates = (ev.completed_dates ?? []) as string[];

        if (!isOccurrenceToday(cadence, days, startDate, todayWeekday)) {
          // Not a scheduled day — leave the row untouched
          continue;
        }

        if (status !== 'done') {
          // Occurrence day but still pending — nothing to roll yet
          continue;
        }

        // The prior occurrence was completed. Archive it and open a new one.
        // We credit yesterday as the completed occurrence date (the cron fires
        // just after ET midnight, so "yesterday" is the day the event ran on).
        const updatedDates = completedDates.includes(yesterday)
          ? completedDates
          : [...completedDates, yesterday];

        const { error: updateErr } = await db
          .from('family_events')
          .update({ status: 'pending', completed_dates: updatedDates })
          .eq('id', ev.id as string);

        if (updateErr) throw new Error(`update event ${ev.id}: ${updateErr.message}`);
        rolled++;
      }

      results.push({ household_id: hid, rolled });
      processed++;
    } catch (err) {
      results.push({ household_id: hid, error: (err as Error).message });
    }
  }

  return jsonResponse({ ok: true, processed, today, results });
});
