import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Zap, CheckSquare, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

const phaseIcons = { prep: ClipboardList, execution: Zap, verification: CheckSquare };
const phaseLabels = { prep: 'Prep', execution: 'Execution', verification: 'Verification' };
const phaseOrder = ['prep', 'execution', 'verification'];

export default function TeamLiftProject({ projectName, phases, onStatusChange, onDelete }) {
  const queryClient = useQueryClient();
  const total = phases.length;
  const done = phases.filter(t => t.status === 'done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggleStep = async (task, stepId) => {
    const steps = (task.steps || []).map(s =>
      s.id === stepId ? { ...s, done: !s.done } : s
    );
    await base44.entities.FamilyTask.update(task.id, { steps });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const sortedPhases = [...phases].sort((a, b) =>
    phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{projectName}</h3>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedPhases.map(task => {
            const Icon = phaseIcons[task.phase] || ClipboardList;
            const steps = task.steps || [];
            const stepsDone = steps.filter(s => s.done).length;

            return (
              <div key={task.id} className="rounded-lg border bg-card p-3 space-y-2">
                {/* Phase header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {phaseLabels[task.phase] || task.phase}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} />
                    <button
                      onClick={() => {
                        const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'pending';
                        onStatusChange(task.id, next);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {task.status === 'pending' ? 'Start' : task.status === 'in_progress' ? 'Done' : 'Reopen'}
                    </button>
                    <button onClick={() => onDelete(task.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Task title */}
                <p className="text-sm font-medium">{task.title}</p>

                {task.assigned_to && (
                  <p className="text-xs text-muted-foreground">Assigned to: {task.assigned_to}</p>
                )}

                {task.notes && (
                  <p className="text-xs text-muted-foreground italic">{task.notes}</p>
                )}

                {/* Steps checklist */}
                {steps.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                      Steps: {stepsDone}/{steps.length}
                    </p>
                    {steps.map(step => (
                      <button
                        key={step.id}
                        onClick={() => toggleStep(task, step.id)}
                        className="flex items-center gap-2 w-full text-left group"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          step.done ? 'bg-accent border-accent' : 'border-border group-hover:border-primary'
                        }`}>
                          {step.done && <span className="text-white text-[10px]">✓</span>}
                        </span>
                        <span className={`text-xs ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {step.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}