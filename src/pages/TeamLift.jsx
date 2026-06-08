import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import TeamLiftForm from '@/components/teamlift/TeamLiftForm';
import TeamLiftProject from '@/components/teamlift/TeamLiftProject';
import { getCurrentWeekMonday } from '@/lib/weekUtils';

export default function TeamLift() {
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.SystemZone.list(),
  });

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

  const handleCreateProject = async ({ projectName, zoneId, zoneName, phases }) => {
    // Create parent task
    const parent = await base44.entities.FamilyTask.create({
      title: projectName,
      zone_id: zoneId,
      zone_name: zoneName,
      task_type: 'team_lift',
      phase: 'none',
      status: 'pending',
      week_of: getCurrentWeekMonday(),
    });

    // Create phase sub-tasks
    const phaseEntries = ['prep', 'execution', 'verification'];
    for (const phase of phaseEntries) {
      const phaseData = phases[phase];
      if (phaseData.title.trim()) {
        await base44.entities.FamilyTask.create({
          title: phaseData.title,
          zone_id: zoneId,
          zone_name: zoneName,
          task_type: 'team_lift',
          phase,
          parent_task_id: parent.id,
          assigned_to: phaseData.assigned_to || '',
          notes: phaseData.notes || '',
          status: 'pending',
          week_of: getCurrentWeekMonday(),
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  // Group team-lift tasks into projects
  const projects = useMemo(() => {
    const parentTasks = tasks.filter(t => t.task_type === 'team_lift' && !t.parent_task_id);
    return parentTasks.map(parent => ({
      ...parent,
      phases: tasks.filter(t => t.parent_task_id === parent.id),
      zone: zones.find(z => z.id === parent.zone_id),
    }));
  }, [tasks, zones]);

  if (isLoading) {
    return <div className="space-y-4">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team Lift</h1>
          <p className="text-muted-foreground mt-1">Break big tasks into collaborative phases.</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Project
        </Button>
      </div>

      <div className="space-y-4">
        {projects.map(project => (
          <TeamLiftProject
            key={project.id}
            projectName={project.title}
            phases={project.phases}
            zone={project.zone}
            onStatusChange={(id, status) => updateTask.mutate({ id, data: { status } })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        ))}
        {projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <h3 className="font-display text-lg font-semibold">No Team-Lift Projects Yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Create a project to break big tasks into Prep, Execute & Verify phases.</p>
          </div>
        )}
      </div>

      <TeamLiftForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreateProject}
        zones={zones}
        members={members}
      />
    </div>
  );
}