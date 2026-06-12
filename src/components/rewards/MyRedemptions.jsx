import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

const STATUS = {
  pending:  { label: 'Waiting on admin', Icon: Clock, color: 'text-yellow-500' },
  approved: { label: 'Approved 🎉', Icon: CheckCircle2, color: 'text-emerald-600' },
  rejected: { label: 'Rejected', Icon: XCircle, color: 'text-red-500' },
};

export default function MyRedemptions({ redemptions }) {
  if (redemptions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">My Redemptions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {redemptions.map(r => {
            const { label, Icon, color } = STATUS[r.status] || STATUS.pending;
            return (
              <li key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                <span className="text-xl">{r.reward_emoji || '🎁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.reward_title}</p>
                  <p className={`text-xs flex items-center gap-1 ${color}`}>
                    <Icon className="w-3 h-3" /> {label}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-600">−{r.cost} ⭐</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}