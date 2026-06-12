import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import TeamLiftForm from '@/components/teamlift/TeamLiftForm';
import TeamLiftProject from '@/components/teamlift/TeamLiftProject';
import ArchivedProjects from '@/components/teamlift/ArchivedProjects';
import { getCurrentWeekMonday } from '@/lib/weekUtils';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function TeamLift() {
  const [formOpen, setFormOpen] = useState(false);
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

  const handleCreateProject = async ({ projectName, phases }) => {
    const parent = await base44.entities.FamilyTask.create({
      title: projectName,
      task_type: 'team_lift',
      phase: 'none',
      status: 'pending',
      week_of: getCurrentWeekMonday(),
    });

    for (const phase of ['prep', 'execution', 'verification']) {
      const phaseData = phases[phase];
      if (phaseData.title.trim()) {
        await base44.entities.FamilyTask.create({
          title: phaseData.title,
          task_type: 'team_lift',
          phase,
          parent_task_id: parent.id,
          assigned_to: phaseData.assigned_to || '',
          notes: phaseData.notes || '',
          steps: (phaseData.steps || []).filter(s => s.text.trim()),
          status: 'pending',
          week_of: getCurrentWeekMonday(),
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const allProjects = useMemo(() => {
    const parentTasks = tasks.filter(t => t.task_type === 'team_lift' && !t.parent_task_id);
    return parentTasks.map(parent => ({
      ...parent,
      phases: tasks.filter(t => t.parent_task_id === parent.id),
    }));
  }, [tasks]);

  const projects = allProjects.filter(p => !p.archived);
  const archivedProjects = allProjects.filter(p => p.archived);

  const setProjectArchived = async (project, archived) => {
    await base44.entities.FamilyTask.update(project.id, { archived });
    for (const phase of project.phases) {
      await base44.entities.FamilyTask.update(phase.id, { archived });
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  if (isLoading) {
    return <div className="space-y-4">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team Lift</h1>
          <p className="text-muted-foreground mt-1">Break big chores into collaborative phases.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {projects.map(project => (
          <TeamLiftProject
            key={project.id}
            projectId={project.id}
            projectName={project.title}
            phases={project.phases}
            members={members}
            onStatusChange={(id, status) => updateTask.mutate({ id, data: { status } })}
            onDelete={(id) => deleteTask.mutate(id)}
            onArchiveProject={() => setProjectArchived(project, true)}
            onDeleteProject={async (id) => {
              // Delete all phases first, then the parent
              for (const phase of project.phases) {
                await base44.entities.FamilyTask.delete(phase.id);
              }
              await deleteTask.mutateAsync(id);
            }}
          />
        ))}
        {projects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏋️</p>
            <h3 className="font-display text-lg font-semibold">No Team-Lift Projects Yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Create a project to break big chores into Prep, Execute & Verify phases.</p>
          </div>
        )}
      </div>

      <ArchivedProjects projects={archivedProjects} onRestore={(p) => setProjectArchived(p, false)} />

      <TeamLiftForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreateProject}
        members={members}
      />
    </div>
  );
}