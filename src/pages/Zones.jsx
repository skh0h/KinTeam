import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import TaskCard from '@/components/zones/TaskCard';
import AddChoreDialog from '@/components/zones/AddChoreDialog';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function Zones() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { localUser } = useLocalUser();
  const isAdmin = localUser?.role === 'admin';
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.FamilyTask.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FamilyTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.FamilyTask.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const chores = tasks.filter(t => t.task_type === 'routine');

  if (isLoading) {
    return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Chores</h1>
          <p className="text-muted-foreground mt-1">All household chores in one place.</p>
        </div>
        {isAdmin && (
          <Button className="rounded-xl gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Add Chore
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {chores.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">No chores yet. Add one to get started!</p>
        )}
        {chores.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isAdmin={isAdmin}
            members={members}
            onStatusChange={(id, status) => updateTask.mutate({ id, data: { status } })}
            onAssign={(id, memberId) => updateTask.mutate({ id, data: { assigned_to: memberId } })}
            onPermanentAssign={(id, memberId) => updateTask.mutate({ id, data: { permanent_assigned_to: memberId } })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        ))}
      </div>

      <AddChoreDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(formData) => {
          createTask.mutate({ ...formData, task_type: 'routine', phase: 'none', status: 'pending' });
          setAddDialogOpen(false);
        }}
        members={members}
      />
    </div>
  );
}