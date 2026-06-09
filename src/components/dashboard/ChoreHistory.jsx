import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, History } from 'lucide-react';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { getCurrentWeekMonday } from '@/lib/weekUtils';

function getWeekMonday(weeksAgo) {
  return format(startOfWeek(subWeeks(new Date(), weeksAgo), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function WeekRow({ weekOf, tasks, defaultOpen }) {
  const [isOpen, setIsOpen] = useState(defaultOpen || false);
  const weekTasks = tasks.filter(t => t.task_type === 'routine' && t.week_of === weekOf);
  const done = weekTasks.filter(t => t.status === 'done');
  const notDone = weekTasks.filter(t => t.status !== 'done');
  const total = weekTasks.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : null;

  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setIsOpen(v => !v)}
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
          {total > 0 && <span className="text-xs text-muted-foreground">{done.length}/{total}</span>}
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
}

export default function ChoreHistory({ tasks, isAdmin }) {
  const [showOlder, setShowOlder] = useState(false);

  const lastWeek = useMemo(() => getWeekMonday(1), []);

  const olderWeeks = useMemo(() => {
    if (!isAdmin) return [];
    const currentWeek = getCurrentWeekMonday();
    const weekSet = new Set(
      tasks
        .filter(t => t.task_type === 'routine' && t.week_of && t.week_of < lastWeek)
        .map(t => t.week_of)
    );
    for (let i = 2; i <= 6; i++) weekSet.add(getWeekMonday(i));
    weekSet.delete(currentWeek);
    weekSet.delete(lastWeek);
    return Array.from(weekSet).sort((a, b) => b.localeCompare(a)).slice(0, 5);
  }, [tasks, isAdmin, lastWeek]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <CardTitle className="font-display text-lg">Chore History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        <WeekRow weekOf={lastWeek} tasks={tasks} defaultOpen={true} />

        {isAdmin && olderWeeks.length > 0 && (
          <>
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-1 transition-colors"
              onClick={() => setShowOlder(v => !v)}
            >
              {showOlder ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showOlder ? 'Hide older weeks' : 'Show older weeks'}
            </button>
            {showOlder && olderWeeks.map(weekOf => (
              <WeekRow key={weekOf} weekOf={weekOf} tasks={tasks} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}