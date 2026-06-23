/**
 * generate-weekly-recap
 *
 * Cron function (runs Monday ~5:20 UTC / after reset-weekly-chores).
 * For every household: computes per-member star/chore stats for the current
 * week (Mon–Sun, ET), picks an MVP, and inserts a weekly_recaps row.
 *
 * Stats schema (stored as JSONB array in weekly_recaps.stats):
 *   [{ member_id, name, emoji, stars, chores_done, chores_total }]
 *
 * Protected by x-cron-secret header (verify_jwt=false in config.toml).
 * Uses service-role client to bypass RLS and process all households.
 */

import {
  assertCronSecret, serviceClient, nyNow, mondayOf, weekDatesFrom,
  jsonResponse, CORS_HEADERS,
} from '../_shared/cron.ts';

// A task is "daily" if occurrence=daily, or due_day is absent / 'any'
const isDaily = (t: Record<string, unknown>) =>
  t['occurrence'] === 'daily' || !t['due_day'] || t['due_day'] === 'any';

const getStarWorth = (t: Record<string, unknown>): number =>
  Math.max(0, ((t['stars'] as number) ?? 1) - ((t['stars_penalty'] as number) ?? 0));

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

  // Monday of current week in ET.
  // nyNow() gives an ET-wall-clock Date whose .getDay() is correct for ET.
  // mondayOf() computes the Monday Date in the same ET-wall-clock space.
  // weekOfMonday() returns a YYYY-MM-DD string formatted in ET (no toISOString).
  // weekDatesFrom() also formats each day in ET via Intl.DateTimeFormat.
  const nowET = nyNow();
  const monday = mondayOf(nowET);
  const weekOf = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(monday);
  const weekDates = weekDatesFrom(monday);

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
      // Load tasks and members for this household in parallel
      const [tasksRes, membersRes] = await Promise.all([
        db.from('family_tasks').select('*').eq('household_id', hid),
        db.from('family_members').select('*').eq('household_id', hid),
      ]);

      if (tasksRes.error) throw new Error(`family_tasks: ${tasksRes.error.message}`);
      if (membersRes.error) throw new Error(`family_members: ${membersRes.error.message}`);

      const tasks = tasksRes.data ?? [];
      const members = membersRes.data ?? [];

      const stats = members.map((m: Record<string, unknown>) => {
        // Routine, non-archived tasks assigned to this member this week
        const chores = tasks.filter((t: Record<string, unknown>) =>
          t['task_type'] === 'routine' && !t['archived'] &&
          (t['permanent_assigned_to'] === m['id'] || t['assigned_to'] === m['id']) &&
          (!t['week_of'] || t['week_of'] === weekOf)
        );

        let stars = 0, done = 0, total = 0;
        for (const t of chores) {
          if (isDaily(t)) {
            const completedDates = (t['completed_dates'] as string[]) ?? [];
            const daysDone = weekDates.filter(d => completedDates.includes(d)).length;
            total += 7;
            done += daysDone;
            stars += getStarWorth(t) * daysDone;
          } else {
            total += 1;
            if (t['status'] === 'done') {
              done += 1;
              stars += getStarWorth(t);
            }
          }
        }

        return {
          member_id: m['id'],
          name: m['display_name'] || m['name'],
          emoji: m['avatar_emoji'] || '👤',
          stars,
          chores_done: done,
          chores_total: total,
        };
      });

      // MVP = highest stars earner (must have > 0 stars)
      const top = [...stats].sort((a, b) => b.stars - a.stars)[0];
      const mvpName = top && top.stars > 0 ? (top.name as string) : '';

      // Insert weekly recap row
      // NOTE: weekly_recaps columns confirmed from 0001_init.sql:
      //   id, created_date, household_id, week_of (text), mvp_name (text), stats (jsonb)
      const { data: recap, error: insertErr } = await db.from('weekly_recaps').insert({
        household_id: hid,
        week_of: weekOf,
        mvp_name: mvpName,
        stats,
      }).select('id').single();

      if (insertErr) throw new Error(`insert weekly_recap: ${insertErr.message}`);

      results.push({ household_id: hid, week_of: weekOf, mvp: mvpName, recap_id: recap.id });
      processed++;
    } catch (err) {
      results.push({ household_id: hid, error: (err as Error).message });
    }
  }

  return jsonResponse({ ok: true, processed, week_of: weekOf, results });
});
