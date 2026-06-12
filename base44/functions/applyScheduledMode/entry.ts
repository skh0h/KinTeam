import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Today in America/New_York
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const today = now.toISOString().slice(0, 10);

    const [schedules, settingsList] = await Promise.all([
      base44.asServiceRole.entities.ScheduledMode.list(),
      base44.asServiceRole.entities.HouseholdSettings.list(),
    ]);

    const settings = settingsList[0];
    const active = schedules.find(s => s.start_date <= today && today <= s.end_date);

    if (active) {
      if (!settings) {
        await base44.asServiceRole.entities.HouseholdSettings.create({ mode: active.mode, auto_set: true });
      } else if (settings.mode !== active.mode) {
        await base44.asServiceRole.entities.HouseholdSettings.update(settings.id, { mode: active.mode, auto_set: true });
      }
      return Response.json({ applied: active.mode, schedule_id: active.id });
    }

    // No active schedule — revert only if the scheduler set the current mode
    if (settings?.auto_set && settings.mode !== 'normal') {
      await base44.asServiceRole.entities.HouseholdSettings.update(settings.id, { mode: 'normal', auto_set: false });
      return Response.json({ reverted: 'normal' });
    }

    return Response.json({ unchanged: settings?.mode || 'normal' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});