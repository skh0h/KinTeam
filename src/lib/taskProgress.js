// Derive completion from actual checked steps so progress never relies on stale status fields
export const isPhaseComplete = (phase) =>
  phase.status === 'done' ||
  ((phase.steps || []).length > 0 && phase.steps.every(s => s.done));

export const isProjectComplete = (project, allTasks) => {
  const phases = allTasks.filter(t => t.parent_task_id === project.id);
  if (phases.length === 0) return project.status === 'done';
  return phases.every(isPhaseComplete);
};