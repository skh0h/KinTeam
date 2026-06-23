/**
 * apply-scheduled-mode
 *
 * Cron function (runs daily, ~5:05 UTC / midnight ET).
 * For every household: checks whether any scheduled_modes row is active today
 * (start_date <= today <= end_date, ET).  If one is active, upserts
 * household_settings.mode to the schedule's mode and sets auto_set=true.
 * If no schedule is active and the current mode was auto-set, reverts to 'normal'.
 *
 * Protected by x-cron-secret header (verify_jwt=false in config.toml).
 * Uses service-role client to bypass RLS and process all households.
 */

import { assertCronSecret, serviceClient, nyToday, jsonResponse, CORS_HEADERS } from '../_shared/cron.ts';

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
  const today = nyToday();

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
      // Fetch scheduled modes and settings for this household in parallel
      const [schedulesRes, settingsRes] = await Promise.all([
        db.from('scheduled_modes').select('*').eq('household_id', hid),
        db.from('household_settings').select('*').eq('household_id', hid).maybeSingle(),
      ]);

      if (schedulesRes.error) throw new Error(`scheduled_modes: ${schedulesRes.error.message}`);
      if (settingsRes.error) throw new Error(`household_settings: ${settingsRes.error.message}`);

      const schedules = schedulesRes.data ?? [];
      const settings = settingsRes.data;

      // Find an active schedule: start_date <= today <= end_date
      const active = schedules.find(
        (s: { start_date: string; end_date: string }) =>
          s.start_date <= today && today <= s.end_date
      );

      if (active) {
        if (!settings) {
          // No settings row yet — create one
          const { error } = await db.from('household_settings').insert({
            household_id: hid,
            mode: active.mode,
            auto_set: true,
          });
          if (error) throw new Error(`insert settings: ${error.message}`);
          results.push({ household_id: hid, applied: active.mode, schedule_id: active.id, action: 'created' });
        } else if (settings.mode !== active.mode) {
          // Update to the active schedule's mode
          const { error } = await db.from('household_settings')
            .update({ mode: active.mode, auto_set: true })
            .eq('id', settings.id);
          if (error) throw new Error(`update settings: ${error.message}`);
          results.push({ household_id: hid, applied: active.mode, schedule_id: active.id, action: 'updated' });
        } else {
          // Mode already matches the scheduled value — ensure auto_set=true so
          // the revert logic fires when the schedule ends. Without this, a
          // manually set mode that happens to equal the schedule's mode would
          // never be reverted back to 'normal' after the schedule expires.
          if (!settings.auto_set) {
            const { error } = await db.from('household_settings')
              .update({ auto_set: true })
              .eq('id', settings.id);
            if (error) throw new Error(`set auto_set: ${error.message}`);
          }
          results.push({ household_id: hid, unchanged: settings.mode });
        }
      } else {
        // No active schedule — revert only if the scheduler set the current mode
        if (settings?.auto_set && settings.mode !== 'normal') {
          const { error } = await db.from('household_settings')
            .update({ mode: 'normal', auto_set: false })
            .eq('id', settings.id);
          if (error) throw new Error(`revert settings: ${error.message}`);
          results.push({ household_id: hid, reverted: 'normal' });
        } else {
          results.push({ household_id: hid, unchanged: settings?.mode ?? 'normal' });
        }
      }

      processed++;
    } catch (err) {
      // Per-household error: log and continue so one failure doesn't block others
      results.push({ household_id: hid, error: (err as Error).message });
    }
  }

  return jsonResponse({ ok: true, processed, date: today, results });
});
