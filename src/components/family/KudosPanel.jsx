import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocalUser } from '@/lib/LocalUserContext';
import { useCelebration } from '@/hooks/useCelebration';
import { formatDistanceToNow } from 'date-fns';

const KUDOS_EMOJIS = ['🙌', '👏', '⭐', '💪', '❤️'];

export default function KudosPanel() {
  const { localUser } = useLocalUser();
  const qc = useQueryClient();
  const { celebrate, CelebrationPortal } = useCelebration();

  const [toMemberId, setToMemberId] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(KUDOS_EMOJIS[0]);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const { data: kudosList = [], isLoading: kudosLoading } = useQuery({
    queryKey: ['kudos'],
    queryFn: () => base44.entities.Kudos.list('-created_date', 20),
  });

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  // Filter out self from recipients
  const recipients = members.filter(m => m.id !== localUser?.id);

  const giveKudos = useMutation({
    mutationFn: (values) => base44.entities.Kudos.create(values),
    onSuccess: (_data, _vars, _ctx) => {
      qc.invalidateQueries({ queryKey: ['kudos'] });
      celebrate();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toMemberId) return;
    giveKudos.mutate({
      from_member_id: localUser?.id ?? null,
      to_member_id: toMemberId,
      emoji: selectedEmoji,
    });
    // Keep emoji selection; reset recipient only if desired
  };

  return (
    <>
      {CelebrationPortal}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <span>🙌</span> High-Fives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Give kudos form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {recipients.length === 0 ? (
                <p className="text-xs text-muted-foreground">No other members to high-five yet.</p>
              ) : (
                recipients.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setToMemberId(m.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      toMemberId === m.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    <span>{m.avatar_emoji || '👤'}</span>
                    <span>{m.display_name || m.name}</span>
                  </button>
                ))
              )}
            </div>

            {/* Emoji picker */}
            <div className="flex items-center gap-2">
              {KUDOS_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setSelectedEmoji(e)}
                  className={`text-2xl rounded-lg p-1.5 transition-all ${
                    selectedEmoji === e
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={!toMemberId || giveKudos.isPending}
              className="w-full"
            >
              {giveKudos.isPending ? 'Sending…' : `Send ${selectedEmoji} High-Five`}
            </Button>
          </form>

          {/* Recent kudos feed */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</h3>
            {kudosLoading && (
              <p className="text-xs text-muted-foreground">Loading high-fives…</p>
            )}
            {!kudosLoading && kudosList.length === 0 && (
              <p className="text-xs text-muted-foreground">No high-fives yet — be the first!</p>
            )}
            <ul className="space-y-1.5">
              {kudosList.map(k => {
                const from = memberMap[k.from_member_id];
                const to = memberMap[k.to_member_id];
                const fromLabel = from ? `${from.avatar_emoji || '👤'} ${from.display_name || from.name}` : '?';
                const toLabel = to ? `${to.avatar_emoji || '👤'} ${to.display_name || to.name}` : '?';
                const when = k.created_date
                  ? formatDistanceToNow(new Date(k.created_date), { addSuffix: true })
                  : '';
                return (
                  <li key={k.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/40">
                    <span className="font-medium">{fromLabel}</span>
                    <span className="text-lg">{k.emoji}</span>
                    <span className="font-medium">{toLabel}</span>
                    {when && <span className="ml-auto text-xs text-muted-foreground">{when}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
