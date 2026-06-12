import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';

export default function RedemptionApprovals({ redemptions }) {
  const queryClient = useQueryClient();
  const pending = redemptions.filter(r => r.status === 'pending');

  const decide = useMutation({
    mutationFn: ({ redemption, status }) =>
      base44.entities.RewardRedemption.update(redemption.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['redemptions'] }),
  });

  if (pending.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <CardTitle className="font-display text-base text-primary">
            Redemption Requests ({pending.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {pending.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.member_name}</p>
                <p className="text-xs text-muted-foreground">
                  wants {r.reward_emoji || '🎁'} <strong>{r.reward_title}</strong> for {r.cost} ⭐
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm" variant="outline"
                  className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={() => decide.mutate({ redemption: r, status: 'approved' })}
                  disabled={decide.isPending}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => decide.mutate({ redemption: r, status: 'rejected' })}
                  disabled={decide.isPending}
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}