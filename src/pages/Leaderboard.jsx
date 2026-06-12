import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { computeEarnedStars } from '@/lib/starEarnings';

const rankEmojis = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const entries = useMemo(() => {
    const totals = computeEarnedStars(tasks);
    return members
      .map(m => ({ member: m, stars: (totals[m.id] || 0) + (m.bonus_stars || 0) }))
      .sort((a, b) => b.stars - a.stars);
  }, [tasks, members]);

  const isLoading = tasksLoading || membersLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">Stars earned from approved chores.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <Trophy className="w-10 h-10 mx-auto text-primary mb-2" />
            <h2 className="font-display text-lg font-semibold">Star Rankings</h2>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.member.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                >
                  <span className="text-2xl w-8 text-center">{rankEmojis[i] || `${i + 1}.`}</span>
                  <span className="text-xl">{entry.member.avatar_emoji || '👤'}</span>
                  <span className="flex-1 font-medium">{entry.member.display_name || entry.member.name}</span>
                  {(entry.member.streak_count || 0) > 0 && (
                    <span className="text-sm font-semibold text-orange-500">🔥 {entry.member.streak_count}</span>
                  )}
                  <span className="font-display font-bold text-amber-600">⭐ {entry.stars}</span>
                </motion.div>
              ))}
              {entries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No family members yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}