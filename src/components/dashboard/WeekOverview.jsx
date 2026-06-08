import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getWeekLabel, getCurrentWeekMonday } from '@/lib/weekUtils';
import { motion } from 'framer-motion';

export default function WeekOverview({ tasks }) {
  const weekTasks = tasks.filter(t => t.week_of === getCurrentWeekMonday());
  const done = weekTasks.filter(t => t.status === 'done').length;
  const inProgress = weekTasks.filter(t => t.status === 'in_progress').length;
  const pending = weekTasks.filter(t => t.status === 'pending').length;
  const total = weekTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

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

        {/* Progress bar */}
        <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-5">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
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