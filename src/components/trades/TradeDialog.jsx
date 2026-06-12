import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function TradeDialog({ task, onClose }) {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const siblings = members.filter(m => m.id !== localUser?.id);

  const requestTrade = useMutation({
    mutationFn: (to) => base44.entities.ChoreTrade.create({
      task_id: task.id,
      task_title: task.title,
      from_member_id: localUser.id,
      from_member_name: localUser.display_name || localUser.name,
      to_member_id: to.id,
      to_member_name: to.display_name || to.name,
      status: 'pending_sibling',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Trade "{task.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Who do you want to ask to take this chore?</p>
        <div className="grid grid-cols-2 gap-2">
          {siblings.map(m => (
            <button
              key={m.id}
              onClick={() => requestTrade.mutate(m)}
              disabled={requestTrade.isPending}
              className="flex flex-col items-center gap-1 p-4 rounded-xl border hover:bg-muted/50 active:scale-95 transition-all"
            >
              <span className="text-3xl">{m.avatar_emoji || '👤'}</span>
              <span className="text-sm font-medium">{m.display_name || m.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}