import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLocalUser } from '@/lib/LocalUserContext';
import { useCelebration } from '@/hooks/useCelebration';
import { formatDistanceToNow } from 'date-fns';

export default function ShoutOutWall() {
  const { localUser } = useLocalUser();
  const qc = useQueryClient();
  const { celebrate, CelebrationPortal } = useCelebration();
  const [message, setMessage] = useState('');

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const { data: shoutOuts = [], isLoading } = useQuery({
    queryKey: ['shoutouts'],
    queryFn: () => base44.entities.ShoutOut.list('-created_date', 20),
  });

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const postShoutOut = useMutation({
    mutationFn: (values) => base44.entities.ShoutOut.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shoutouts'] });
      celebrate();
      setMessage('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    postShoutOut.mutate({
      author_member_id: localUser?.id ?? null,
      message: trimmed,
    });
  };

  return (
    <>
      {CelebrationPortal}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <span>📣</span> Shout-Out Wall
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Post form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              placeholder="Give someone a shout-out…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              maxLength={280}
              className="resize-none"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={!message.trim() || postShoutOut.isPending}
            >
              {postShoutOut.isPending ? 'Posting…' : '📣 Post Shout-Out'}
            </Button>
          </form>

          {/* Feed */}
          <div className="space-y-2">
            {isLoading && (
              <p className="text-xs text-muted-foreground">Loading shout-outs…</p>
            )}
            {!isLoading && shoutOuts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                The wall is quiet — be the first to cheer someone on!
              </p>
            )}
            <ul className="space-y-2">
              {shoutOuts.map(so => {
                const author = memberMap[so.author_member_id];
                const name = author
                  ? `${author.avatar_emoji || '📣'} ${author.display_name || author.name}`
                  : '📣 Someone';
                const when = so.created_date
                  ? formatDistanceToNow(new Date(so.created_date), { addSuffix: true })
                  : '';
                return (
                  <li key={so.id} className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      {when && <span className="text-xs text-muted-foreground shrink-0">{when}</span>}
                    </div>
                    <p className="text-sm text-foreground">{so.message}</p>
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
