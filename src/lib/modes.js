export const MODES = {
  normal: { label: 'Normal', emoji: '🏠', description: 'Standard chore schedule.' },
  casual: { label: 'Casual', emoji: '😎', description: 'Low-priority chores are excused.' },
  workhorse: { label: 'Workhorse', emoji: '💪', description: 'Every chore shows up every day.' },
  vacation: { label: 'Vacation', emoji: '🏖️', description: 'All chores excused — enjoy the break!' },
};

// Is this chore excused under the current mode?
export function isExcused(task, mode) {
  if (mode === 'vacation') return true;
  if (mode === 'casual') return task.priority === 'low';
  return false;
}