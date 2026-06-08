import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import WeekOverview from '@/components/dashboard/WeekOverview';
import QuickActions from '@/components/dashboard/QuickActions';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.SystemZone.list(),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  if (zonesLoading || tasksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Home</h1>
        <p className="text-muted-foreground mt-1">Here's how the family's doing this week.</p>
      </div>
      <WeekOverview tasks={tasks} />
      <QuickActions />
    </div>
  );
}