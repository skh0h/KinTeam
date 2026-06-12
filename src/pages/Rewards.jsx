import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { useLocalUser } from '@/lib/LocalUserContext';
import { computeStarBalance } from '@/lib/starEarnings';
import RewardGrid from '@/components/rewards/RewardGrid';
import MyRedemptions from '@/components/rewards/MyRedemptions';
import RedemptionApprovals from '@/components/rewards/RedemptionApprovals';
import RewardManager from '@/components/rewards/RewardManager';

export default function Rewards() {
  const { localUser } = useLocalUser();
  const isAdmin = localUser?.role === 'admin';

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => base44.entities.StarReward.list(),
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['redemptions'],
    queryFn: () => base44.entities.RewardRedemption.list('-created_date', 100),
  });

  const balance = localUser ? computeStarBalance(localUser.id, tasks, localUser, redemptions) : 0;
  const myRedemptions = redemptions.filter(r => r.member_id === localUser?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Rewards</h1>
          <p className="text-muted-foreground mt-1">Spend your stars on rewards.</p>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-5 flex items-center justify-between">
          <span className="font-medium text-sm">Your spendable stars</span>
          <span className="font-display text-3xl font-bold text-amber-600">⭐ {balance}</span>
        </CardContent>
      </Card>

      {isAdmin && <RedemptionApprovals redemptions={redemptions} />}
      <RewardGrid rewards={rewards} balance={balance} />
      <MyRedemptions redemptions={myRedemptions} />
      {isAdmin && <RewardManager rewards={rewards} />}
    </div>
  );
}