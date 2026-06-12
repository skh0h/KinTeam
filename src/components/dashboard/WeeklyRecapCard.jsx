import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWeekLabel } from '@/lib/weekUtils';

export default function WeeklyRecapCard() {
  const { data: recaps = [] } = useQuery({
    queryKey: ['weekly-recap'],
    queryFn: () => base44.entities.WeeklyRecap.list('-created_date', 1),
  });

  const recap = recaps[0];
  if (!recap) return null;

  const stats = [...(recap.stats || [])].sort((a, b) => b.stars - a.stars);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">
          📋 Weekly Recap — {getWeekLabel(recap.week_of)}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {recap.mvp_name && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-2xl">🏆</span>
            <p className="text-sm"><strong>{recap.mvp_name}</strong> was this week's MVP!</p>
          </div>
        )}
        <ul className="space-y-1.5">
          {stats.map(s => {
            const rate = s.chores_total > 0 ? Math.round((s.chores_done / s.chores_total) * 100) : 0;
            return (
              <li key={s.member_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 text-sm">
                <span className="text-lg">{s.emoji}</span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.chores_done}/{s.chores_total} ({rate}%)</span>
                <span className="font-semibold text-amber-600">⭐ {s.stars}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}