import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getDay, addDays, startOfWeek } from 'date-fns';
import { getCurrentWeekMonday } from '@/lib/weekUtils';
import { isDoneOn } from '@/lib/choreCompletion';
import { isExcused } from '@/lib/modes';

const DOW_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function TodayChoreList({ tasks, members, isAdmin, currentMemberId, mode = 'normal', onToggle }) {
  const today = new Date();
  const todayDowIndex = (getDay(today) + 6) % 7; // Mon=0 ... Sun=6
  const weekOf = getCurrentWeekMonday();

  const [selectedDayIndex, setSelectedDayIndex] = useState(todayDowIndex);

  const selectedDayName = WEEK_DAYS[selectedDayIndex];
  // Compute the actual date for the selected day
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const selectedDate = addDays(weekStart, selectedDayIndex);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const chores = useMemo(() => {
    return tasks
      .filter(t =>
        t.task_type === 'routine' &&
        !isExcused(t, mode) &&
        (!t.week_of || t.week_of === weekOf) &&
        (mode === 'workhorse' || t.due_day === selectedDayName || t.due_day === 'any')
      )
      .sort((a, b) => {
        const aDone = isDoneOn(a, selectedDateStr);
        const bDone = isDoneOn(b, selectedDateStr);
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        return 0;
      });
  }, [tasks, weekOf, selectedDayName, selectedDateStr, mode]);

  const memberMap = useMemo(() => {
    const map = {};
    (members || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const doneCount = chores.filter(t => isDoneOn(t, selectedDateStr)).length;
  const total = chores.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const isToday = selectedDayIndex === todayDowIndex;
  const title = isToday ? "Today's Chores" : `${format(selectedDate, 'EEEE')}'s Chores`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg">{title}</CardTitle>
          <span className="text-sm text-muted-foreground">{format(selectedDate, 'MMM d')}</span>
        </div>

        {/* Day selector — admins only */}
        {isAdmin && (
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={() => setSelectedDayIndex(i => Math.max(0, i - 1))}
              disabled={selectedDayIndex === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-1 gap-1">
              {WEEK_DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => setSelectedDayIndex(i)}
                  className={`flex-1 text-xs py-1 rounded-md transition-colors font-medium ${
                    i === selectedDayIndex
                      ? 'bg-primary text-primary-foreground'
                      : i === todayDowIndex
                      ? 'bg-muted text-foreground ring-1 ring-primary/40'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {day.slice(0, 1).toUpperCase() + day.slice(1, 2)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedDayIndex(i => Math.min(6, i + 1))}
              disabled={selectedDayIndex === 6}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

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
        {mode === 'vacation' ? (
          <p className="text-sm text-muted-foreground text-center py-4">🏖️ Vacation mode — all chores are excused!</p>
        ) : chores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No chores scheduled 🎉</p>
        ) : (
          <ul className="space-y-2">
            {chores.map(chore => {
              const done = isDoneOn(chore, selectedDateStr);
              const assignee = chore.assigned_to ? memberMap[chore.assigned_to] : null;
              const canToggle = isAdmin && !done;
              return (
                <li
                  key={chore.id}
                  onClick={() => canToggle && onToggle && onToggle(chore, selectedDateStr, true)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                    canToggle ? 'cursor-pointer' : 'cursor-default opacity-70'
                  } ${
                    done ? 'bg-accent/10 hover:bg-accent/20' : canToggle ? 'bg-muted/40 hover:bg-muted' : 'bg-muted/40'
                  }`}
                >
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  }
                  {chore.photo_url && (
                    <img src={chore.photo_url} alt={chore.title} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                  )}
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