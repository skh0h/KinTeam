/**
 * update-streaks
 *
 * Cron function (runs daily ~5:10 UTC / midnight ET, after apply-scheduled-mode).
 * For every household (unless mode='vacation'):
 *   - Determines "yesterday" in ET and its day-name.
 *   - For each family member, finds their routine tasks due yesterday.
 *   - If ALL were completed: increments streak_count and bonus_stars by 1,
 *     sets last_streak_date=yesterday to prevent double-credit.
 *   - If any were missed and streak > 0: resets streak_count to 0.
 *   - Skips members already credited for yesterday (last_streak_date === yesterday).
 *
 * Protected by x-cron-secret header (verify_jwt=false in config.toml).
 * Uses service-role client to bypass RLS and process all households.
 */

import {
  assertCronSecret, serviceClient, nyNow,
  jsonResponse, CORS_HEADERS, DAY_NAMES,
} from '../_shared/cron.ts';

// Mirrors the helper from the Base44 original
const isDaily = (t: Record<string, unknown>) =>
  t['occurrence'] === 'daily' || !t['due_day'] || t['due_day'] === 'any';

const isDoneOn = (t: Record<string, unknown>, d: string): boolean => {
  if (isDaily(t)) {
    return ((t['completed_dates'] as string[]) ?? []).includes(d);
  }
  return t['status'] === 'done';
};

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

  // Yesterday in America/New_York.
  // nyNow() gives an ET-wall-clock Date; subtracting 1 day from it and
  // reading .getDay() gives the correct ET weekday for yesterday.
  // For the date string we use the ET wall-clock Date directly so we never
  // call .toISOString() on a locale-adjusted Date (which would give UTC).
  const nowET = nyNow();
  const yesterdayET = new Date(nowET);
  yesterdayET.setDate(nowET.getDate() - 1);
  // Format as YYYY-MM-DD in ET using a real UTC Date offset by -1 day.
  const yesterdayUtc = new Date();
  yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
  const yStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(yesterdayUtc);
  const dayName = DAY_NAMES[yesterdayET.getDay()];

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
      // Check vacation mode first — skip household entirely if vacationing
      const { data: settings, error: settingsErr } = await db
        .from('household_settings')
        .select('mode')
        .eq('household_id', hid)
        .maybeSingle();

      if (settingsErr) throw new Error(`household_settings: ${settingsErr.message}`);

      if (settings?.mode === 'vacation') {
        results.push({ household_id: hid, skipped: 'vacation mode' });
        processed++;
        continue;
      }

      // Load tasks and members in parallel
      const [tasksRes, membersRes] = await Promise.all([
        db.from('family_tasks').select('*').eq('household_id', hid),
        db.from('family_members').select('*').eq('household_id', hid),
      ]);

      if (tasksRes.error) throw new Error(`family_tasks: ${tasksRes.error.message}`);
      if (membersRes.error) throw new Error(`family_members: ${membersRes.error.message}`);

      const tasks = tasksRes.data ?? [];
      const members = membersRes.data ?? [];

      const memberResults: unknown[] = [];

      for (const m of members) {
        // Already credited for yesterday — skip to avoid double-increment
        if (m['last_streak_date'] === yStr) continue;

        // Tasks assigned to this member that were due yesterday
        // (daily tasks are always due; non-daily tasks match by due_day name)
        const chores = tasks.filter((t: Record<string, unknown>) =>
          t['task_type'] === 'routine' && !t['archived'] &&
          (t['permanent_assigned_to'] === m['id'] || t['assigned_to'] === m['id']) &&
          (isDaily(t) || t['due_day'] === dayName)
        );

        // No tasks due → nothing to evaluate for streak
        if (chores.length === 0) continue;

        const allDone = chores.every(t => isDoneOn(t, yStr));

        if (allDone) {
          const newStreak = ((m['streak_count'] as number) || 0) + 1;
          const { error } = await db.from('family_members').update({
            streak_count: newStreak,
            bonus_stars: ((m['bonus_stars'] as number) || 0) + 1,
            last_streak_date: yStr,
          }).eq('id', m['id']);
          if (error) throw new Error(`update member ${m['id']}: ${error.message}`);
          memberResults.push({ member: m['name'], streak: newStreak });
        } else if (((m['streak_count'] as number) || 0) > 0) {
          const { error } = await db.from('family_members')
            .update({ streak_count: 0 })
            .eq('id', m['id']);
          if (error) throw new Error(`reset streak for member ${m['id']}: ${error.message}`);
          memberResults.push({ member: m['name'], streak: 0 });
        }
      }

      results.push({ household_id: hid, date: yStr, members: memberResults });
      processed++;
    } catch (err) {
      results.push({ household_id: hid, error: (err as Error).message });
    }
  }

  return jsonResponse({ ok: true, processed, date: yStr, results });
});
