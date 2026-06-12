import { getStarWorth } from '@/lib/stars';
import { isDaily } from '@/lib/choreCompletion';

// Stars earned per member (map of member_id → stars) from routine chores
export function computeEarnedStars(tasks) {
  const totals = {};
  tasks
    .filter(t => t.task_type === 'routine' && !t.archived)
    .forEach(t => {
      const memberId = t.permanent_assigned_to || t.assigned_to;
      if (!memberId) return;
      if (isDaily(t)) {
        const days = (t.completed_dates || []).length;
        if (days > 0) totals[memberId] = (totals[memberId] || 0) + getStarWorth(t) * days;
      } else if (t.status === 'done') {
        totals[memberId] = (totals[memberId] || 0) + getStarWorth(t);
      }
    });
  return totals;
}

// Spendable balance = earned + streak bonus − (pending + approved) redemptions
export function computeStarBalance(memberId, tasks, member, redemptions) {
  const earned = computeEarnedStars(tasks)[memberId] || 0;
  const bonus = member?.bonus_stars || 0;
  const spent = (redemptions || [])
    .filter(r => r.member_id === memberId && (r.status === 'approved' || r.status === 'pending'))
    .reduce((sum, r) => sum + (r.cost || 0), 0);
  return earned + bonus - spent;
}