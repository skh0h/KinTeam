import { startOfWeek, format } from 'date-fns';

export function getCurrentWeekMonday() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function getWeekLabel(dateStr) {
  if (!dateStr) return 'This Week';
  const date = new Date(dateStr + 'T12:00:00');
  return `Week of ${format(date, 'MMM d')}`;
}