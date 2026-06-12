import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const isDaily = (t) => t.occurrence === 'daily' || !t.due_day || t.due_day === 'any';
const getStarWorth = (t) => Math.max(0, (t.stars ?? 1) - (t.stars_penalty ?? 0));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Monday of the current week in America/New_York
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekOf = monday.toISOString().slice(0, 10);

    // All 7 dates of this week
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toISOString().slice(0, 10));
    }

    const [tasks, members] = await Promise.all([
      base44.asServiceRole.entities.FamilyTask.list(null, 1000),
      base44.asServiceRole.entities.FamilyMember.list(),
    ]);

    const stats = members.map(m => {
      const chores = tasks.filter(t =>
        t.task_type === 'routine' && !t.archived &&
        (t.permanent_assigned_to === m.id || t.assigned_to === m.id) &&
        (!t.week_of || t.week_of === weekOf)
      );

      let stars = 0, done = 0, total = 0;
      for (const t of chores) {
        if (isDaily(t)) {
          const daysDone = weekDates.filter(d => (t.completed_dates || []).includes(d)).length;
          total += 7;
          done += daysDone;
          stars += getStarWorth(t) * daysDone;
        } else {
          total += 1;
          if (t.status === 'done') {
            done += 1;
            stars += getStarWorth(t);
          }
        }
      }

      return {
        member_id: m.id,
        name: m.display_name || m.name,
        emoji: m.avatar_emoji || '👤',
        stars,
        chores_done: done,
        chores_total: total,
      };
    });

    const top = [...stats].sort((a, b) => b.stars - a.stars)[0];
    const mvpName = top && top.stars > 0 ? top.name : '';

    const recap = await base44.asServiceRole.entities.WeeklyRecap.create({
      week_of: weekOf,
      mvp_name: mvpName,
      stats,
    });

    return Response.json({ week_of: weekOf, mvp: mvpName, recap_id: recap.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});