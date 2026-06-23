import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deriveBadges } from '@/lib/badges';
import { cn } from '@/lib/utils';

function MemberBadges({ member }) {
  const badges = deriveBadges({ streak_count: member.streak_count, bonus_stars: member.bonus_stars });
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{member.avatar_emoji || '👤'}</span>
        <span className="font-medium text-sm">{member.display_name || member.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {earned.length}/{badges.length} earned
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {earned.map(badge => (
          <span
            key={badge.id}
            title={badge.label}
            className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-medium text-amber-800"
          >
            <span>{badge.emoji}</span>
            <span>{badge.label}</span>
          </span>
        ))}
        {locked.map(badge => (
          <span
            key={badge.id}
            title={badge.label}
            className={cn(
              'flex items-center gap-1 bg-muted border border-border rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground opacity-50'
            )}
          >
            <span>{badge.emoji}</span>
            <span>{badge.label}</span>
          </span>
        ))}
        {badges.length === 0 && (
          <span className="text-xs text-muted-foreground">No badges yet — start a streak!</span>
        )}
      </div>
    </div>
  );
}

export default function BadgeShelf() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Dusting off the badge cabinet…
        </CardContent>
      </Card>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No family members yet — add some to see badges!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <span>🏅</span> Badges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.map(member => (
          <MemberBadges key={member.id} member={member} />
        ))}
      </CardContent>
    </Card>
  );
}
