import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export default function RewardManager({ rewards }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [cost, setCost] = useState('5');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rewards'] });

  const addReward = useMutation({
    mutationFn: () => base44.entities.StarReward.create({
      title: title.trim(),
      emoji: emoji.trim() || '🎁',
      cost: Math.max(1, parseInt(cost) || 1),
    }),
    onSuccess: () => { invalidate(); setTitle(''); setEmoji(''); setCost('5'); },
  });

  const deleteReward = useMutation({
    mutationFn: (id) => base44.entities.StarReward.delete(id),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">Manage Rewards</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="🎁" className="w-14 text-center" maxLength={4} value={emoji} onChange={e => setEmoji(e.target.value)} />
          <Input placeholder="Reward name" className="flex-1" value={title} onChange={e => setTitle(e.target.value)} />
          <Input type="number" min="1" className="w-20" value={cost} onChange={e => setCost(e.target.value)} />
          <Button size="icon" onClick={() => addReward.mutate()} disabled={!title.trim() || addReward.isPending}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {rewards.length > 0 && (
          <ul className="space-y-1.5">
            {rewards.map(r => (
              <li key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                <span>{r.emoji || '🎁'}</span>
                <span className="flex-1 font-medium">{r.title}</span>
                <span className="text-xs text-amber-600 font-semibold">⭐ {r.cost}</span>
                <button
                  onClick={() => deleteReward.mutate(r.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}