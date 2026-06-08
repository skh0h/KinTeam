import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Crown } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ZoneIcon from '@/components/shared/ZoneIcon';
import TaskCard from '@/components/zones/TaskCard';
import AddTaskDialog from '@/components/zones/AddTaskDialog';
import { getCurrentWeekMonday } from '@/lib/weekUtils';
import { cn } from '@/lib/utils';

export default function Zones() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.SystemZone.list(),
  });

  const { data: tasks = [] } = useQuery({
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

  const handleAddTask = (formData) => {
    createTask.mutate({
      ...formData,
      zone_id: selectedZone.id,
      zone_name: selectedZone.name,
      task_type: 'routine',
      phase: 'none',
      status: 'pending',
      week_of: getCurrentWeekMonday(),
    });
  };

  const handleStatusChange = (taskId, status) => {
    updateTask.mutate({ id: taskId, data: { status } });
  };

  const activeZone = selectedZone || zones[0];
  const zoneTasks = tasks.filter(t => t.zone_id === activeZone?.id && t.task_type === 'routine');

  if (zonesLoading) {
    return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">System Zones</h1>
        <p className="text-muted-foreground mt-1">Tap a zone to manage its chores.</p>
      </div>

      {/* Zone pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {zones.map(zone => (
          <button
            key={zone.id}
            onClick={() => setSelectedZone(zone)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium whitespace-nowrap transition-all shrink-0',
              activeZone?.id === zone.id
                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                : 'border-border bg-card hover:bg-muted'
            )}
          >
            <ZoneIcon icon={zone.icon} color={zone.color} size="sm" />
            {zone.name}
          </button>
        ))}
      </div>

      {/* Active zone detail */}
      {activeZone && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ZoneIcon icon={activeZone.icon} color={activeZone.color} />
                <div>
                  <h2 className="font-display text-xl font-semibold">{activeZone.name}</h2>
                  <p className="text-xs text-muted-foreground">{activeZone.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                <Crown className="w-3.5 h-3.5" />
                {activeZone.current_lead_name}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatePresence>
              {zoneTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => deleteTask.mutate(id)}
                />
              ))}
            </AnimatePresence>
            {zoneTasks.length === 0 && (
               <p className="text-center text-muted-foreground py-8 text-sm">No chores yet. Add one to get started!</p>
             )}
             <Button
               variant="outline"
               className="w-full rounded-xl border-dashed"
               onClick={() => setAddDialogOpen(true)}
             >
               <Plus className="w-4 h-4 mr-2" /> Add Chore
             </Button>
          </CardContent>
        </Card>
      )}

      <AddTaskDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddTask}
        members={members}
        zoneName={activeZone?.name || ''}
      />
    </div>
  );
}