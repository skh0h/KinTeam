import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import { completionUpdate, todayStr } from '@/lib/choreCompletion';

export default function AdminAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: () => base44.entities.AdminAlert.filter({ status: 'pending' }),
    refetchInterval: 15000,
  });

  const approve = useMutation({
    mutationFn: async (alert) => {
      const [task] = await base44.entities.FamilyTask.filter({ id: alert.task_id });
      if (!task) throw new Error(`Task ${alert.task_id} not found`);
      if (alert.step_id) {
        // Team Lift step approval
        const steps = (task.steps || []).map(s =>
          s.id === alert.step_id ? { ...s, done: true, pending_review: false } : s
        );
        const allDone = steps.length > 0 && steps.every(s => s.done);
        const status = allDone ? 'done' : 'in_progress';
        await base44.entities.FamilyTask.update(task.id, { steps, status });
        if (task.parent_task_id) {
          const phases = await base44.entities.FamilyTask.filter({ parent_task_id: task.parent_task_id });
          const updated = phases.map(p => p.id === task.id ? { ...p, status } : p);
          const parentStatus = updated.every(p => p.status === 'done') ? 'done'
            : updated.some(p => p.status !== 'pending') ? 'in_progress' : 'pending';
          await base44.entities.FamilyTask.update(task.parent_task_id, { status: parentStatus });
        }
      } else {
        await base44.entities.FamilyTask.update(alert.task_id, completionUpdate(task, alert.created_date || todayStr(), true));
      }
      await base44.entities.AdminAlert.update(alert.id, { status: 'approved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const reject = useMutation({
    mutationFn: async (alert) => {
      const [task] = await base44.entities.FamilyTask.filter({ id: alert.task_id });
      if (!task) throw new Error(`Task ${alert.task_id} not found`);
      if (alert.step_id) {
        // Team Lift step rejection — uncheck the pending step
        const steps = (task.steps || []).map(s =>
          s.id === alert.step_id ? { ...s, pending_review: false } : s
        );
        await base44.entities.FamilyTask.update(task.id, { steps });
      } else {
        await base44.entities.FamilyTask.update(alert.task_id, {
          ...completionUpdate(task, todayStr(), false),
          stars_penalty: (task?.stars_penalty ?? 0) + 1,
        });
      }
      await base44.entities.AdminAlert.update(alert.id, { status: 'rejected', user_notified: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  if (alerts.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <CardTitle className="font-display text-base text-primary">
            Check This! ({alerts.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map(alert => (
            <li key={alert.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{alert.from_member}</p>
                <p className="text-xs text-muted-foreground">completed <strong>{alert.task_title}</strong></p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={() => approve.mutate(alert)}
                  disabled={approve.isPending || reject.isPending}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => reject.mutate(alert)}
                  disabled={approve.isPending || reject.isPending}
                >
                  <XCircle className="w-3.5 h-3.5" /> No
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}