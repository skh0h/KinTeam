/**
 * reset-weekly-chores
 *
 * Cron function (runs Monday ~5:15 UTC / midnight ET).
 * For every household: resets all routine, non-archived family_tasks to
 * pending, clears assigned_to, zeroes stars_penalty, and stamps week_of
 * with this week's Monday (ET).
 *
 * Protected by x-cron-secret header (verify_jwt=false in config.toml).
 * Uses service-role client to bypass RLS and process all households.
 */

import {
  assertCronSecret, serviceClient, weekOfMonday,
  jsonResponse, CORS_HEADERS,
} from '../_shared/cron.ts';

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
  const weekOf = weekOfMonday();

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
      // Bulk update: all routine non-archived tasks for this household
      // Matches original logic: task_type === 'routine' && !archived
      const { data: updated, error: updateErr } = await db
        .from('family_tasks')
        .update({
          status: 'pending',
          assigned_to: '',   // Original uses empty string, not null
          stars_penalty: 0,
          week_of: weekOf,
        })
        .eq('household_id', hid)
        .eq('task_type', 'routine')
        .eq('archived', false)
        .select('id');

      if (updateErr) throw new Error(`update family_tasks: ${updateErr.message}`);

      const resetCount = updated?.length ?? 0;
      results.push({ household_id: hid, reset: resetCount, week_of: weekOf });
      processed++;
    } catch (err) {
      results.push({ household_id: hid, error: (err as Error).message });
    }
  }

  return jsonResponse({ ok: true, processed, week_of: weekOf, results });
});
