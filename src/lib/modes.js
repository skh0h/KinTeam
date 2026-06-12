export const MODES = {
  normal: { label: 'Normal', emoji: '🏠', description: 'Standard chore schedule.' },
  workhorse: { label: 'Workhorse', emoji: '💪', description: 'Every chore shows up every day — progress weighted 40% chores / 60% team lift.' },
  vacation: { label: 'Vacation', emoji: '🏖️', description: 'All chores excused — enjoy the break!' },
};

// Is this chore excused under the current mode?
export function isExcused(task, mode) {
  if (mode === 'vacation') return true;
  return false;
}