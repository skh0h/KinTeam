import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, User } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { getCurrentWeekMonday } from '@/lib/weekUtils';

const DOW_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default function TodayChoreList({ tasks, members }) {
  const today = new Date();
  const todayName = DOW_MAP[getDay(today)];
  const weekOf = getCurrentWeekMonday();

  const todayChores = useMemo(() => {
    return tasks
      .filter(t =>
        t.task_type === 'routine' &&
        t.week_of === weekOf &&
        (t.due_day === todayName || t.due_day === 'any')
      )
      .sort((a, b) => {
        // done tasks go to the bottom
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        return 0;
      });
  }, [tasks, weekOf, todayName]);

  const memberMap = useMemo(() => {
    const map = {};
    (members || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const doneCount = todayChores.filter(t => t.status === 'done').length;
  const total = todayChores.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg">
            Today's Chores
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {format(today, 'EEEE, MMM d')}
          </span>
        </div>
        {total > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{doneCount} of {total} done</span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'
                }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {todayChores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No chores scheduled for today 🎉</p>
        ) : (
          <ul className="space-y-2">
            {todayChores.map(chore => {
              const done = chore.status === 'done';
              const assignee = chore.assigned_to ? memberMap[chore.assigned_to] : null;
              return (
                <li
                  key={chore.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    done ? 'bg-accent/10' : 'bg-muted/40'
                  }`}
                >
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  }
                  <span className={`flex-1 text-sm font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {chore.title}
                  </span>
                  {assignee ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{assignee.avatar_emoji || '👤'}</span>
                      <span>{assignee.display_name || assignee.name}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>Unassigned</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}