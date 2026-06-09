import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import { useLocalUser } from '@/lib/LocalUserContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ChoreChart({ tasks }) {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState(null);

  const myChores = tasks.filter(
    t => t.task_type === 'routine' &&
    t.status !== 'done' &&
    (!t.assigned_to || t.assigned_to === 'anyone' || t.assigned_to === localUser?.name)
  );

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FamilyTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const createAlert = useMutation({
    mutationFn: (data) => base44.entities.AdminAlert.create(data),
  });

  const handleComplete = async (task) => {
    setCompleting(task.id);
    await updateTask.mutateAsync({ id: task.id, data: { status: 'done' } });
    await createAlert.mutateAsync({
      message: `${localUser?.display_name || localUser?.name || 'Someone'} completed "${task.title}" — check this!`,
      from_member: localUser?.display_name || localUser?.name || 'Unknown',
      task_title: task.title,
      read: false,
    });
    toast.success('Marked done! Admins have been notified ✓');
    setCompleting(null);
  };

  if (!localUser) return null;

  return (
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
            {myChores.map(task => (
              <li key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.occurrence && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.occurrence === 'fortnightly' ? 'Every 2 wks' : task.occurrence}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn('shrink-0 gap-1.5 text-xs', completing === task.id && 'opacity-60')}
                  disabled={completing === task.id}
                  onClick={() => handleComplete(task)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Done
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}