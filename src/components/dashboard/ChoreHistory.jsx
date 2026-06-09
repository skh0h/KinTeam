import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, History } from 'lucide-react';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { getCurrentWeekMonday } from '@/lib/weekUtils';

function getWeekMonday(weeksAgo) {
  return format(startOfWeek(subWeeks(new Date(), weeksAgo), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export default function ChoreHistory({ tasks }) {
  const [expandedWeek, setExpandedWeek] = useState(null);

  const weeks = useMemo(() => {
    const currentWeek = getCurrentWeekMonday();
    // Collect all past week_of values from tasks, excluding current week
    const weekSet = new Set(
      tasks
        .filter(t => t.task_type === 'routine' && t.week_of && t.week_of < currentWeek)
        .map(t => t.week_of)
    );
    // Also include the last 4 weeks even if no tasks
    for (let i = 1; i <= 4; i++) weekSet.add(getWeekMonday(i));
    weekSet.delete(currentWeek);

    return Array.from(weekSet)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 6);
  }, [tasks]);

  const getWeekTasks = (weekOf) =>
    tasks.filter(t => t.task_type === 'routine' && t.week_of === weekOf);

  if (weeks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <CardTitle className="font-display text-lg">Chore History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {weeks.map(weekOf => {
          const weekTasks = getWeekTasks(weekOf);
          const done = weekTasks.filter(t => t.status === 'done');
          const notDone = weekTasks.filter(t => t.status !== 'done');
          const total = weekTasks.length;
          const pct = total > 0 ? Math.round((done.length / total) * 100) : null;
          const isOpen = expandedWeek === weekOf;

          return (
            <div key={weekOf} className="rounded-xl border overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                onClick={() => setExpandedWeek(isOpen ? null : weekOf)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    Week of {format(new Date(weekOf + 'T00:00:00'), 'MMM d')}
                  </span>
                  {pct !== null ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pct === 100 ? 'bg-emerald-100 text-emerald-700' :
                      pct >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{pct}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No data</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {total > 0 && (
                    <span className="text-xs text-muted-foreground">{done.length}/{total}</span>
                  )}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-1 bg-muted/20">
                  {total === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No chores recorded for this week.</p>
                  ) : (
                    <>
                      {done.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground line-through">{t.title}</span>
                          {t.assigned_to && <span className="text-xs text-muted-foreground ml-auto">{t.assigned_to}</span>}
                        </div>
                      ))}
                      {notDone.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1">
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="text-sm">{t.title}</span>
                          {t.assigned_to && <span className="text-xs text-muted-foreground ml-auto">{t.assigned_to}</span>}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}