import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const isDaily = (t) => t.occurrence === 'daily' || !t.due_day || t.due_day === 'any';
const isDoneOn = (t, d) => isDaily(t) ? (t.completed_dates || []).includes(d) : t.status === 'done';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Yesterday in America/New_York
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[yesterday.getDay()];

    const settings = await base44.asServiceRole.entities.HouseholdSettings.list();
    if (settings[0]?.mode === 'vacation') {
      return Response.json({ skipped: 'vacation mode' });
    }

    const [tasks, members] = await Promise.all([
      base44.asServiceRole.entities.FamilyTask.list(null, 1000),
      base44.asServiceRole.entities.FamilyMember.list(),
    ]);

    const results = [];
    for (const m of members) {
      if (m.last_streak_date === yStr) continue; // already credited

      const chores = tasks.filter(t =>
        t.task_type === 'routine' && !t.archived &&
        (t.permanent_assigned_to === m.id || t.assigned_to === m.id) &&
        (isDaily(t) || t.due_day === dayName)
      );
      if (chores.length === 0) continue;

      const allDone = chores.every(t => isDoneOn(t, yStr));
      if (allDone) {
        const newStreak = (m.streak_count || 0) + 1;
        await base44.asServiceRole.entities.FamilyMember.update(m.id, {
          streak_count: newStreak,
          bonus_stars: (m.bonus_stars || 0) + 1,
          last_streak_date: yStr,
        });
        results.push({ member: m.name, streak: newStreak });
      } else if ((m.streak_count || 0) > 0) {
        await base44.asServiceRole.entities.FamilyMember.update(m.id, { streak_count: 0 });
        results.push({ member: m.name, streak: 0 });
      }
    }

    return Response.json({ date: yStr, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});