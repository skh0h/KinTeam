import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function StreakBadge() {
  const { localUser } = useLocalUser();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
    enabled: !!localUser,
  });

  if (!localUser) return null;
  const me = members.find(m => m.id === localUser.id);
  const streak = me?.streak_count ?? 0;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-sm font-medium text-orange-700">
      <span>🔥</span>
      <span>{streak} day streak</span>
      {(me?.bonus_stars ?? 0) > 0 && (
        <span className="text-xs text-amber-600 ml-1">+{me.bonus_stars} bonus ⭐</span>
      )}
    </div>
  );
}