import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

// Placeholder data — will be wired to real chore stats later
const placeholderEntries = [
  { rank: 1, name: 'Coming Soon', emoji: '🥇', points: '—' },
  { rank: 2, name: 'Coming Soon', emoji: '🥈', points: '—' },
  { rank: 3, name: 'Coming Soon', emoji: '🥉', points: '—' },
];

export default function Leaderboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">See who's leading the family this week.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <Trophy className="w-10 h-10 mx-auto text-primary mb-2" />
            <h2 className="font-display text-lg font-semibold">Weekly Rankings</h2>
            <p className="text-sm text-muted-foreground">Leaderboard scoring is coming soon!</p>
          </div>

          <div className="space-y-2">
            {placeholderEntries.map((entry, i) => (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
              >
                <span className="text-2xl">{entry.emoji}</span>
                <span className="flex-1 font-medium text-muted-foreground italic">{entry.name}</span>
                <span className="font-display font-bold text-muted-foreground">{entry.points} pts</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}