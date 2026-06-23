import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, CalendarDays, Users, Trophy, Gift, Sparkles, CalendarPlus, Settings, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import WeekOverview from '@/components/dashboard/WeekOverview';
import AdminAlerts from '@/components/dashboard/AdminAlerts';
import TodayChoreList from '@/components/dashboard/TodayChoreList';
import MyChores from '@/components/dashboard/MyChores';
import { useLocalUser } from '@/lib/LocalUserContext';
import { completionUpdate } from '@/lib/choreCompletion';
import { useHouseholdMode } from '@/hooks/useHouseholdMode';
import ModeSelector from '@/components/dashboard/ModeSelector';
import ModeScheduler from '@/components/dashboard/ModeScheduler';
import WeeklyRecapCard from '@/components/dashboard/WeeklyRecapCard';
import TradeRequests from '@/components/trades/TradeRequests';
import StreakBadge from '@/components/dashboard/StreakBadge';

const HUB_ITEMS = [
  { path: '/zones',          label: 'Chores',          icon: ClipboardList, adminOnly: false },
  { path: '/calendar',       label: 'Calendar',        icon: CalendarDays,  adminOnly: false },
  { path: '/team-lift',      label: 'Team Lift',       icon: Users,         adminOnly: false },
  { path: '/leaderboard',    label: 'Leaders',         icon: Trophy,        adminOnly: false },
  { path: '/rewards',        label: 'Rewards',         icon: Gift,          adminOnly: false },
  { path: '/workshop',       label: 'AI Chores',       icon: Sparkles,      adminOnly: false },
  { path: '/event-workshop', label: 'Event Workshop',  icon: CalendarPlus,  adminOnly: false },
  { path: '/settings',       label: 'Settings',        icon: Settings,      adminOnly: false },
  { path: '/members',        label: 'Members',         icon: UserPlus,      adminOnly: true  },
];

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

  const isAdmin = localUser?.role === 'admin';
  const hubItems = HUB_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome Home</h1>
        <StreakBadge />
      </div>

      {/* Quick-access hub */}
      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {hubItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center',
              'text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50',
              'transition-all active:scale-95'
            )}
          >
            <Icon className="w-6 h-6 shrink-0" />
            <span className="text-xs font-medium leading-tight">{label}</span>
          </Link>
        ))}
      </div>
      {localUser?.role === 'admin' && <ModeSelector mode={mode} setMode={setMode} isSaving={isSaving} />}
      <TradeRequests />
      <WeekOverview tasks={tasks} mode={mode} />
      <MyChores tasks={tasks} mode={mode} />
      <TodayChoreList tasks={tasks} members={members} isAdmin={localUser?.role === 'admin'} currentMemberId={localUser?.id} mode={mode} onToggle={(task, dateStr, done) => toggleChore.mutate({ task, dateStr, done })} />
      {localUser?.role === 'admin' && <AdminAlerts />}
      <WeeklyRecapCard />
      {localUser?.role === 'admin' && <ModeScheduler />}
    </div>
  );
}