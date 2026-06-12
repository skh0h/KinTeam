import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function TradeRequests() {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();
  const isAdmin = localUser?.role === 'admin';

  const { data: trades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => base44.entities.ChoreTrade.list('-created_date', 50),
    refetchInterval: 15000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['trades'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const respond = useMutation({
    mutationFn: ({ trade, status }) => base44.entities.ChoreTrade.update(trade.id, { status }),
    onSuccess: invalidate,
  });

  const adminDecide = useMutation({
    mutationFn: async ({ trade, approve }) => {
      if (approve) {
        const [task] = await base44.entities.FamilyTask.filter({ id: trade.task_id });
        const update = { assigned_to: trade.to_member_id };
        if (task?.permanent_assigned_to === trade.from_member_id) {
          update.permanent_assigned_to = trade.to_member_id;
        }
        await base44.entities.FamilyTask.update(trade.task_id, update);
      }
      await base44.entities.ChoreTrade.update(trade.id, { status: approve ? 'approved' : 'rejected' });
    },
    onSuccess: invalidate,
  });

  const incoming = trades.filter(t => t.status === 'pending_sibling' && t.to_member_id === localUser?.id);
  const adminQueue = isAdmin ? trades.filter(t => t.status === 'pending_admin') : [];
  const outgoing = trades.filter(t =>
    t.from_member_id === localUser?.id &&
    ['pending_sibling', 'pending_admin'].includes(t.status)
  );

  if (incoming.length === 0 && adminQueue.length === 0 && outgoing.length === 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          <CardTitle className="font-display text-base text-blue-700">Chore Trades</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {incoming.map(t => (
          <div key={t.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-4 py-3">
            <p className="text-sm min-w-0">
              <strong>{t.from_member_name}</strong> asks you to take <strong>{t.task_title}</strong>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm" variant="outline"
                className="gap-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => respond.mutate({ trade: t, status: 'pending_admin' })}
                disabled={respond.isPending}
              >
                <Check className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => respond.mutate({ trade: t, status: 'declined' })}
                disabled={respond.isPending}
              >
                <X className="w-3.5 h-3.5" /> Decline
              </Button>
            </div>
          </div>
        ))}

        {adminQueue.map(t => (
          <div key={t.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-4 py-3">
            <p className="text-sm min-w-0">
              Trade: <strong>{t.task_title}</strong> from <strong>{t.from_member_name}</strong> → <strong>{t.to_member_name}</strong>
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm" variant="outline"
                className="gap-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => adminDecide.mutate({ trade: t, approve: true })}
                disabled={adminDecide.isPending}
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button
                size="sm" variant="outline"
                className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => adminDecide.mutate({ trade: t, approve: false })}
                disabled={adminDecide.isPending}
              >
                <X className="w-3.5 h-3.5" /> Reject
              </Button>
            </div>
          </div>
        ))}

        {outgoing.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              <strong>{t.task_title}</strong> → {t.to_member_name}: {t.status === 'pending_sibling' ? 'waiting on them' : 'waiting on admin'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}