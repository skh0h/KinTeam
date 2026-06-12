import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import WeekOverview from '@/components/dashboard/WeekOverview';
import AdminAlerts from '@/components/dashboard/AdminAlerts';
import TodayChoreList from '@/components/dashboard/TodayChoreList';
import MyChores from '@/components/dashboard/MyChores';
import { useLocalUser } from '@/lib/LocalUserContext';
import { completionUpdate } from '@/lib/choreCompletion';
import { useHouseholdMode } from '@/hooks/useHouseholdMode';
import ModeSelector from '@/components/dashboard/ModeSelector';

export default function Dashboard() {
  const { localUser } = useLocalUser();
  const queryClient = useQueryClient();
  const { mode, setMode, isSaving } = useHouseholdMode();

  const toggleChore = useMutation({
    mutationFn: ({ task, dateStr, done }) =>
      base44.entities.FamilyTask.update(task.id, completionUpdate(task, dateStr, done)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Home</h1>
      </div>
      {localUser?.role === 'admin' && <ModeSelector mode={mode} setMode={setMode} isSaving={isSaving} />}
      <WeekOverview tasks={tasks} mode={mode} />
      <MyChores tasks={tasks} mode={mode} />
      <TodayChoreList tasks={tasks} members={members} isAdmin={localUser?.role === 'admin'} currentMemberId={localUser?.id} mode={mode} onToggle={(task, dateStr, done) => toggleChore.mutate({ task, dateStr, done })} />
      {localUser?.role === 'admin' && <AdminAlerts />}
    </div>
  );
}