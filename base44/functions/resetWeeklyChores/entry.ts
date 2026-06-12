import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Compute Monday of the current week in America/New_York
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = now.getDay(); // 0 = Sunday
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekOf = monday.toISOString().slice(0, 10);

    const tasks = await base44.asServiceRole.entities.FamilyTask.list(null, 1000);
    let resetCount = 0;
    for (const t of tasks) {
      if (t.task_type !== 'routine' || t.archived) continue;
      await base44.asServiceRole.entities.FamilyTask.update(t.id, {
        status: 'pending',
        assigned_to: '',
        stars_penalty: 0,
        week_of: weekOf,
      });
      resetCount++;
    }

    return Response.json({ reset: resetCount, week_of: weekOf });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});