import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Clock, ClipboardList, AlertCircle } from 'lucide-react';
import { useLocalUser } from '@/lib/LocalUserContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ChoreChart({ tasks }) {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(null);

  // Alerts pending for this user's tasks (so we can show "awaiting approval")
  const { data: myAlerts = [] } = useQuery({
    queryKey: ['my-alerts', localUser?.name],
    queryFn: () => base44.entities.AdminAlert.filter({ from_member: localUser?.display_name || localUser?.name }),
    enabled: !!localUser,
    refetchInterval: 15000,
  });

  const pendingTaskIds = new Set(myAlerts.filter(a => a.status === 'pending').map(a => a.task_id));

  // Rejection notifications for this user
  const rejections = myAlerts.filter(a => a.status === 'rejected' && !a.user_notified);

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FamilyTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const createAlert = useMutation({
    mutationFn: (data) => base44.entities.AdminAlert.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-alerts', localUser?.name] }),
  });

  const markNotified = useMutation({
    mutationFn: (id) => base44.entities.AdminAlert.update(id, { user_notified: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-alerts', localUser?.name] }),
  });

  const handleComplete = async (task) => {
    setSubmitting(task.id);
    await updateTask.mutateAsync({ id: task.id, data: { status: 'in_progress' } });
    await createAlert.mutateAsync({
      message: `${localUser?.display_name || localUser?.name} says they completed "${task.title}" — please verify.`,
      from_member: localUser?.display_name || localUser?.name || 'Unknown',
      task_title: task.title,
      task_id: task.id,
      status: 'pending',
      user_notified: false,
    });
    toast.success('Sent for admin approval!');
    setSubmitting(null);
  };

  const handleDismissRejection = (alert) => {
    markNotified.mutate(alert.id);
  };

  if (!localUser) return null;

  const myChores = tasks.filter(
    t => t.task_type === 'routine' &&
    t.status !== 'done' &&
    (!t.assigned_to || t.assigned_to === 'anyone' || t.assigned_to === localUser?.id)
  );

  return (
    <div className="space-y-3">
      {/* Rejection notifications */}
      {rejections.map(alert => (
        <div key={alert.id} className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Not quite done yet!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Admin marked <strong>{alert.task_title}</strong> as not complete. Please try again.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleDismissRejection(alert)}>
            OK
          </Button>
        </div>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">
              {localUser.display_name || localUser.name}'s Chores
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {myChores.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              All done! Nothing pending.
            </div>
          ) : (
            <ul className="space-y-2">
              {myChores.map(task => {
                const isPendingApproval = pendingTaskIds.has(task.id);
                return (
                  <li key={task.id} className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-xl transition-colors',
                    isPendingApproval ? 'bg-amber-50 border border-amber-200' : 'bg-muted/40 hover:bg-muted/70'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isPendingApproval
                        ? <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {isPendingApproval ? '⏳ Awaiting approval' : (task.occurrence === 'fortnightly' ? 'Every 2 wks' : task.occurrence)}
                        </p>
                      </div>
                    </div>
                    {!isPendingApproval && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn('shrink-0 gap-1.5 text-xs', submitting === task.id && 'opacity-60')}
                        disabled={submitting === task.id}
                        onClick={() => handleComplete(task)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Done
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}