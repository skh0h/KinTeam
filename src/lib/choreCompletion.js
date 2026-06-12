import { format } from 'date-fns';

export const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export const isDaily = (task) => task.occurrence === 'daily';

// Is this chore done on the given date? Daily chores are tracked per-date.
export function isDoneOn(task, dateStr) {
  if (isDaily(task)) return (task.completed_dates || []).includes(dateStr);
  return task.status === 'done';
}

// Build the entity update for marking a chore done/undone on a date.
export function completionUpdate(task, dateStr, done) {
  if (isDaily(task)) {
    const dates = new Set(task.completed_dates || []);
    if (done) dates.add(dateStr); else dates.delete(dateStr);
    return { completed_dates: [...dates], status: 'pending' };
  }
  return { status: done ? 'done' : 'pending' };
}