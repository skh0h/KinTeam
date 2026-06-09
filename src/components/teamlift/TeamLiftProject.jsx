import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import TaskCard from '@/components/zones/TaskCard';
import { motion } from 'framer-motion';

export default function TeamLiftProject({ projectName, phases, onStatusChange, onDelete }) {
  const total = phases.length;
  const done = phases.filter(t => t.status === 'done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">{projectName}</h3>
            </div>
          </div>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {phases.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}