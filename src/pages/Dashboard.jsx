import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import QuickActions from '@/components/dashboard/QuickActions';
import WeekOverview from '@/components/dashboard/WeekOverview';

export default function Dashboard() {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Home</h1>
      </div>
      <WeekOverview tasks={tasks} />
      <QuickActions />
    </div>
  );
}