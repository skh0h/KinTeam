import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import QuickActions from '@/components/dashboard/QuickActions';
import WeekOverview from '@/components/dashboard/WeekOverview';
import AdminAlerts from '@/components/dashboard/AdminAlerts';
import TodayChoreList from '@/components/dashboard/TodayChoreList';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function Dashboard() {
  const { localUser } = useLocalUser();

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
      <WeekOverview tasks={tasks} />
      <TodayChoreList tasks={tasks} members={members} isAdmin={localUser?.role === 'admin'} />
      {localUser?.role === 'admin' && <AdminAlerts />}
      {localUser?.role === 'admin' && <QuickActions />}
    </div>
  );
}