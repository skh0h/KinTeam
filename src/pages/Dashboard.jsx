import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import QuickActions from '@/components/dashboard/QuickActions';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Home</h1>
      </div>
      <QuickActions />
    </div>
  );
}