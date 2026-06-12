import { useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Circle, Clock, XCircle, CheckCircle2, Send } from 'lucide-react';
import { useLocalUser } from '@/lib/LocalUserContext';
import { getStarWorth } from '@/lib/stars';
import { isDoneOn, todayStr } from '@/lib/choreCompletion';

function getChoreState(task, alertsByTaskId) {
  if (isDoneOn(task, todayStr())) return 'done';
  const alert = alertsByTaskId[task.id];
  if (alert?.status === 'rejected') return 'rejected';
  if (alert?.status === 'pending') return 'pending_review';
  return 'not_done';
}

const STATE_CONFIG = {
  not_done:       { label: 'Not done',        bg: 'bg-muted/40',    border: 'border-muted',        Icon: Circle,       iconColor: 'text-muted-foreground' },
  pending_review: { label: 'Waiting on admin', bg: 'bg-yellow-50',  border: 'border-yellow-200',   Icon: Clock,        iconColor: 'text-yellow-500' },
  rejected:       { label: 'Rejected — redo it', bg: 'bg-red-50',   border: 'border-red-200',      Icon: XCircle,      iconColor: 'text-red-500' },
  done:           { label: 'Done ✓',           bg: 'bg-emerald-50', border: 'border-emerald-200',  Icon: CheckCircle2, iconColor: 'text-emerald-600' },
};

export default function MyChores({ tasks }) {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();

  const myChores = useMemo(() =>
    tasks.filter(t =>
      t.task_type === 'routine' &&
      (t.assigned_to === localUser?.id || t.permanent_assigned_to === localUser?.id)
    ),
    [tasks, localUser?.id]
  );

  const { data: alerts = [] } = useQuery({
    queryKey: ['my-alerts'],
    queryFn: () => base44.entities.AdminAlert.list(),
    refetchInterval: 10000,
  });

  // Map task_id → most relevant active alert
  const alertsByTaskId = useMemo(() => {
    const map = {};
    alerts.forEach(a => {
      if (a.status === 'pending') {
        map[a.task_id] = a;
      } else if (a.status === 'rejected' && !a.user_notified) {
        // Only surface rejected if user hasn't acknowledged/resubmitted yet
        if (!map[a.task_id]) map[a.task_id] = a;
      }
    });
    return map;
  }, [alerts]);

  // Celebrate freshly approved chores — only on the kid's own account
  const celebrated = useRef(new Set());
  const myName = localUser?.display_name || localUser?.name;
  useEffect(() => {
    if (!myName) return;
    const fresh = alerts.filter(a =>
      a.status === 'approved' && !a.user_notified &&
      a.from_member === myName && !celebrated.current.has(a.id)
    );
    if (fresh.length === 0) return;
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    fresh.forEach(a => {
      celebrated.current.add(a.id);
      base44.entities.AdminAlert.update(a.id, { user_notified: true });
    });
  }, [alerts, myName]);

  const submitForReview = useMutation({
    mutationFn: async (task) => {
      await base44.entities.FamilyTask.update(task.id, { status: 'in_progress' });
      await base44.entities.AdminAlert.create({
        task_id: task.id,
        task_title: task.title,
        from_member: localUser?.display_name || localUser?.name,
        message: `${localUser?.display_name || localUser?.name} completed ${task.title}`,
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
    },
  });

  const resubmit = useMutation({
    mutationFn: async ({ task, alert }) => {
      // Mark old rejected alert as seen
      await base44.entities.AdminAlert.update(alert.id, { user_notified: true });
      await base44.entities.FamilyTask.update(task.id, { status: 'in_progress' });
      // Create fresh alert for admin
      await base44.entities.AdminAlert.create({
        task_id: task.id,
        task_title: task.title,
        from_member: localUser?.display_name || localUser?.name,
        message: `${localUser?.display_name || localUser?.name} resubmitted ${task.title}`,
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
    },
  });

  if (!localUser || myChores.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">My Chores</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {myChores.map(chore => {
            const state = getChoreState(chore, alertsByTaskId);
            const { label, bg, border, Icon, iconColor } = STATE_CONFIG[state];
            const alert = alertsByTaskId[chore.id];

            return (
              <li key={chore.id} className={`flex items-center gap-3 p-3 rounded-lg border ${bg} ${border}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                {chore.photo_url && (
                  <img src={chore.photo_url} alt={chore.title} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${state === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                    {chore.title}
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-normal">
                      ⭐ {getStarWorth(chore)}
                    </span>
                  </p>
                  <p className={`text-xs mt-0.5 ${iconColor}`}>{label}</p>
                </div>

                {state === 'not_done' && (
                  <Button
                    size="sm" variant="outline"
                    className="shrink-0 text-xs gap-1"
                    onClick={() => submitForReview.mutate(chore)}
                    disabled={submitForReview.isPending}
                  >
                    <Send className="w-3 h-3" /> Submit
                  </Button>
                )}

                {state === 'rejected' && (
                  <Button
                    size="sm" variant="outline"
                    className="shrink-0 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => resubmit.mutate({ task: chore, alert })}
                    disabled={resubmit.isPending}
                  >
                    <Send className="w-3 h-3" /> Resubmit
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}