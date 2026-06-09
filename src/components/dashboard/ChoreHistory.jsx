import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { startOfWeek, subWeeks, format, getDay } from 'date-fns';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDEX = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

function getWeekMonday(weeksAgo) {
  return format(startOfWeek(subWeeks(new Date(), weeksAgo), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function buildDayData(tasks, weekOf, isAdmin) {
  const weekTasks = tasks.filter(t => t.task_type === 'routine' && t.week_of === weekOf);
  const todayDowIndex = (getDay(new Date()) + 6) % 7; // convert Sun=0 to Mon=0

  return DAYS.map((day, i) => {
    const dayTasks = weekTasks.filter(t => {
      const idx = DAY_INDEX[t.due_day];
      return idx === i;
    });
    // Non-admins: hide future days in current week
    const isCurrentWeek = weekOf === getWeekMonday(0);
    const hidden = !isAdmin && isCurrentWeek && i > todayDowIndex;
    const done = dayTasks.filter(t => t.status === 'done').length;
    const total = dayTasks.length;
    return { day, done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0, hidden };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const { done, total, pct } = payload[0].payload;
  return (
    <div className="bg-card border rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {total > 0 ? (
        <>
          <p className="text-emerald-600">{done} done</p>
          <p className="text-muted-foreground">{total - done} remaining</p>
          <p className="font-semibold mt-1">{pct}%</p>
        </>
      ) : (
        <p className="text-muted-foreground">No chores</p>
      )}
    </div>
  );
};

export default function ChoreHistory({ tasks, isAdmin }) {
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i <= (isAdmin ? 3 : 0); i++) {
      result.push({ weekOf: getWeekMonday(i), weeksAgo: i });
    }
    return result;
  }, [isAdmin]);

  const [activeWeek, setActiveWeek] = useState(() => getWeekMonday(0));

  const chartData = useMemo(() => buildDayData(tasks, activeWeek, isAdmin), [tasks, activeWeek, isAdmin]);

  const todayDowIndex = (getDay(new Date()) + 6) % 7;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">Chore Chart</CardTitle>
          </div>
          {isAdmin && (
            <div className="flex gap-1">
              {weeks.map(({ weekOf, weeksAgo }) => (
                <button
                  key={weekOf}
                  onClick={() => setActiveWeek(weekOf)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    activeWeek === weekOf
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {weeksAgo === 0 ? 'This wk' : weeksAgo === 1 ? 'Last wk' : `-${weeksAgo}w`}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Week of {format(new Date(activeWeek + 'T00:00:00'), 'MMM d')}
        </p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'dataMax']} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            {/* Background bar: total chores */}
            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--muted))" opacity={0.5} />
            {/* Foreground bar: done chores */}
            <Bar dataKey="done" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => {
                const isToday = activeWeek === getWeekMonday(0) && i === todayDowIndex;
                return (
                  <Cell
                    key={i}
                    fill={
                      entry.hidden ? 'hsl(var(--muted))' :
                      entry.total === 0 ? 'transparent' :
                      entry.pct === 100 ? 'hsl(var(--accent))' :
                      isToday ? 'hsl(var(--primary))' :
                      'hsl(var(--chart-4))'
                    }
                    opacity={entry.hidden ? 0.3 : 1}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> All done</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--chart-4))] inline-block" /> Pending</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted inline-block" /> None</span>
        </div>
      </CardContent>
    </Card>
  );
}