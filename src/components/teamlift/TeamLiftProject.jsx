import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Zap, CheckSquare, Trash2, ChevronDown, MoreVertical, Circle, Clock, CheckCircle2, Lock, Archive, User, UserX } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useLocalUser } from '@/lib/LocalUserContext';
import { isPhaseComplete } from '@/lib/taskProgress';

const phaseIcons = { prep: ClipboardList, execution: Zap, verification: CheckSquare };
const phaseLabels = { prep: 'Prep', execution: 'Execution', verification: 'Verification' };
const phaseOrder = ['prep', 'execution', 'verification'];

export default function TeamLiftProject({ projectName, projectId, phases, members = [], onStatusChange, onDelete, onDeleteProject, onArchiveProject }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { localUser } = useLocalUser();
  const isAdmin = localUser?.role === 'admin';
  const total = phases.length;
  const done = phases.filter(isPhaseComplete).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const syncParentStatus = async (updatedPhase) => {
    const updatedPhases = phases.map(p => p.id === updatedPhase.id ? updatedPhase : p);
    const allDone = updatedPhases.every(p => p.status === 'done');
    const anyStarted = updatedPhases.some(p => p.status !== 'pending');
    const status = allDone ? 'done' : anyStarted ? 'in_progress' : 'pending';
    await base44.entities.FamilyTask.update(projectId, { status });
  };

  const toggleStep = async (task, stepId) => {
    const steps = (task.steps || []).map(s =>
      s.id === stepId ? { ...s, done: !s.done } : s
    );
    const allStepsDone = steps.length > 0 && steps.every(s => s.done);
    const status = allStepsDone ? 'done' : steps.some(s => s.done) ? 'in_progress' : 'pending';
    await base44.entities.FamilyTask.update(task.id, { steps, status });
    await syncParentStatus({ ...task, status });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const reassignPhase = async (task, name) => {
    await base44.entities.FamilyTask.update(task.id, { assigned_to: name });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const reassignStep = async (task, stepId, name) => {
    const steps = (task.steps || []).map(s =>
      s.id === stepId ? { ...s, assigned_to: name } : s
    );
    await base44.entities.FamilyTask.update(task.id, { steps });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const setPhaseStatus = async (task, status) => {
    await base44.entities.FamilyTask.update(task.id, { status });
    await syncParentStatus({ ...task, status });
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
            <div className="flex items-center gap-2 flex-1 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
              <h3 className="font-display text-lg font-semibold">{projectName}</h3>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">{progress}%</span>
              {isAdmin && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onArchiveProject && onArchiveProject(projectId)}>
                    <Archive className="w-4 h-4 mr-2" /> Archive Project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDeleteProject && onDeleteProject(projectId)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
          <Progress value={progress} className="h-1.5 mt-2" />
          <p className="text-xs text-muted-foreground mt-1">{done}/{total} phases complete</p>
        </CardHeader>
        <AnimatePresence>
        {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
        <CardContent className="space-y-3 pt-0">
          {sortedPhases.map(task => {
            const Icon = phaseIcons[task.phase] || ClipboardList;
            const steps = task.steps || [];
            const stepsDone = steps.filter(s => s.done).length;
            const matchesMe = (name) => !!name && (name === localUser?.name || name === localUser?.display_name);
            const canEdit = isAdmin || matchesMe(task.assigned_to);
            const canEditStep = (step) => (canEdit || matchesMe(step.assigned_to)) && (isAdmin || !step.done);
            const hasAnyAccess = canEdit || steps.some(s => matchesMe(s.assigned_to));

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
                    {!hasAnyAccess && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    <StatusBadge status={task.status} />
                    {canEdit && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPhaseStatus(task, 'pending')}>
                          <Circle className="w-4 h-4 mr-2 text-muted-foreground" /> Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPhaseStatus(task, 'in_progress')}>
                          <Clock className="w-4 h-4 mr-2 text-primary" /> In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPhaseStatus(task, 'done')}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Done
                        </DropdownMenuItem>
                        {isAdmin && members.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Reassign to</DropdownMenuLabel>
                            {members.map(m => (
                              <DropdownMenuItem key={m.id} onClick={() => reassignPhase(task, m.display_name || m.name)}>
                                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                                {m.avatar_emoji ? `${m.avatar_emoji} ` : ''}{m.display_name || m.name}
                              </DropdownMenuItem>
                            ))}
                            {task.assigned_to && (
                              <DropdownMenuItem onClick={() => reassignPhase(task, '')}>
                                <UserX className="w-4 h-4 mr-2 text-muted-foreground" /> Unassign
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
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
                      <div key={step.id} className="flex items-center gap-2">
                        <button
                          onClick={() => canEditStep(step) && toggleStep(task, step.id)}
                          disabled={!canEditStep(step)}
                          className={`flex items-center gap-2 flex-1 text-left group ${!canEditStep(step) ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            step.done ? 'bg-accent border-accent' : 'border-border group-hover:border-primary'
                          }`}>
                            {step.done && <span className="text-white text-[10px]">✓</span>}
                          </span>
                          <span className={`text-xs flex-1 ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {step.text}
                          </span>
                        </button>
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
                                <User className="w-3 h-3" />
                                {step.assigned_to && step.assigned_to !== 'unassigned' ? step.assigned_to : 'Assign'}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {members.map(m => (
                                <DropdownMenuItem key={m.id} onClick={() => reassignStep(task, step.id, m.display_name || m.name)}>
                                  {m.avatar_emoji ? `${m.avatar_emoji} ` : ''}{m.display_name || m.name}
                                </DropdownMenuItem>
                              ))}
                              {step.assigned_to && step.assigned_to !== 'unassigned' && (
                                <DropdownMenuItem onClick={() => reassignStep(task, step.id, '')}>
                                  <UserX className="w-4 h-4 mr-2 text-muted-foreground" /> Unassign
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          step.assigned_to && step.assigned_to !== 'unassigned' && (
                            <span className="text-xs text-muted-foreground shrink-0">{step.assigned_to}</span>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
        </motion.div>
        )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}