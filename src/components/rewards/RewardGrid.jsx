import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function RewardGrid({ rewards, balance }) {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();

  const redeem = useMutation({
    mutationFn: (reward) => base44.entities.RewardRedemption.create({
      reward_id: reward.id,
      reward_title: reward.title,
      reward_emoji: reward.emoji || '🎁',
      cost: reward.cost,
      member_id: localUser.id,
      member_name: localUser.display_name || localUser.name,
      status: 'pending',
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['redemptions'] }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">Reward Shop</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No rewards yet — ask an admin to add some!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rewards.map(reward => {
              const affordable = balance >= reward.cost;
              return (
                <div key={reward.id} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-muted/30 text-center">
                  <span className="text-3xl">{reward.emoji || '🎁'}</span>
                  <p className="text-sm font-medium leading-tight">{reward.title}</p>
                  <span className="text-xs font-semibold text-amber-600">⭐ {reward.cost}</span>
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    disabled={!localUser || !affordable || redeem.isPending}
                    onClick={() => redeem.mutate(reward)}
                  >
                    {affordable ? 'Redeem' : 'Not enough ⭐'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}