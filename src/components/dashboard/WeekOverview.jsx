import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getWeekLabel, getCurrentWeekMonday } from '@/lib/weekUtils';
import { motion } from 'framer-motion';

export default function WeekOverview({ tasks }) {
  const weekTasks = tasks.filter(t => t.week_of === getCurrentWeekMonday());

  // Chores = routine tasks (75% weight), Team Lift = phase sub-tasks (25% weight)
  const choreTasks = weekTasks.filter(t => t.task_type === 'routine' || (!t.task_type && !t.parent_task_id));
  const teamLiftTasks = weekTasks.filter(t => t.task_type === 'team_lift' && t.parent_task_id);

  const choresDone = choreTasks.filter(t => t.status === 'done').length;
  const teamLiftDone = teamLiftTasks.filter(t => t.status === 'done').length;

  const choreProgress = choreTasks.length > 0 ? choresDone / choreTasks.length : 0;
  const teamLiftProgress = teamLiftTasks.length > 0 ? teamLiftDone / teamLiftTasks.length : 0;

  const progress = Math.round((choreProgress * 0.75 + teamLiftProgress * 0.25) * 100);

  const done = weekTasks.filter(t => t.status === 'done').length;
  const inProgress = weekTasks.filter(t => t.status === 'in_progress').length;
  const pending = weekTasks.filter(t => t.status === 'pending').length;

  const stats = [
    { label: 'Done', value: done, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Active', value: inProgress, icon: Clock, color: 'text-primary' },
    { label: 'Pending', value: pending, icon: AlertCircle, color: 'text-muted-foreground' },
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

        {/* Segmented progress bar: chores (75%) + team lift (25%) */}
        <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2 flex gap-0.5">
          <motion.div
            className="h-full bg-primary rounded-l-full"
            style={{ width: '75%' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: choreProgress }}
            style={{ width: `${choreProgress * 75}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-accent rounded-r-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: teamLiftProgress }}
            style={{ width: `${teamLiftProgress * 25}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Chores 75%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" />Team Lift 25%</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
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