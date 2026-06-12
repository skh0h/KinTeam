import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { getWeekLabel, getCurrentWeekMonday } from '@/lib/weekUtils';

export default function WeekOverview({ tasks }) {
  const weekTasks = tasks.filter(t => !t.week_of || t.week_of === getCurrentWeekMonday());

  // Chores = routine tasks (75% weight), Team Lift = phase sub-tasks (25% weight)
  const choreTasks = weekTasks.filter(t => t.task_type === 'routine' || (!t.task_type && !t.parent_task_id));
  // Count projects (parent tasks), not phases
  const teamLiftTasks = weekTasks.filter(t => t.task_type === 'team_lift' && !t.parent_task_id);

  const choresDone = choreTasks.filter(t => t.status === 'done').length;
  const teamLiftDone = teamLiftTasks.filter(t => t.status === 'done').length;

  const hasTeamLift = teamLiftTasks.length > 0;

  const choreProgress = choreTasks.length > 0 ? choresDone / choreTasks.length : 0;
  const teamLiftProgress = teamLiftTasks.length > 0 ? teamLiftDone / teamLiftTasks.length : 0;

  const progress = Math.round(
    hasTeamLift
      ? (choreProgress * 0.75 + teamLiftProgress * 0.25) * 100
      : choreProgress * 100
  );

  const stats = [
    { label: 'Chores Done', value: `${choresDone}/${choreTasks.length}`, icon: CheckCircle2, color: 'text-primary' },
    { label: 'Team Lift Done', value: `${teamLiftDone}/${teamLiftTasks.length}`, icon: CheckCircle2, color: 'text-accent' },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{getWeekLabel(getCurrentWeekMonday())}</p>
            <h2 className="font-display text-2xl font-semibold mt-1">Family Progress</h2>
          </div>
          <div className="text-right">
            <span className="font-display text-3xl font-bold text-primary">{progress}%</span>
          </div>
        </div>

        {/* Segmented progress bar */}
        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-700"
            style={{ width: `${hasTeamLift ? choreProgress * 75 : choreProgress * 100}%` }}
          />
          {hasTeamLift && (
            <div
              className="absolute top-0 h-full bg-accent transition-all duration-700"
              style={{ left: `${choreProgress * 75}%`, width: `${teamLiftProgress * 25}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Chores {hasTeamLift ? '75%' : '100%'}</span>
          {hasTeamLift && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" />Team Lift 25%</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center p-3 rounded-xl bg-muted/50">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                <p className="font-display text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}