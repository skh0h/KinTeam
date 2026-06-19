import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, UserPlus, Settings, ClipboardList, Trophy, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function AppShell() {
  const location = useLocation();
  const { localUser } = useLocalUser();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/zones', label: 'Chores', icon: ClipboardList },
    { path: '/team-lift', label: 'Team Lift', icon: Users },
    { path: '/leaderboard', label: 'Leaders', icon: Trophy },
    { path: '/rewards', label: 'Rewards', icon: Gift },
    ...(localUser?.role === 'admin' ? [{ path: '/members', label: 'Members', icon: UserPlus }] : []),
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <h1 className="font-display text-lg font-semibold tracking-tight">All-Hands</h1>
          </Link>
          {localUser && (
            <Link to="/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden">
              <span className="text-lg">{localUser.avatar_emoji || '👤'}</span>
              <span className="font-medium">{localUser.display_name || localUser.name}</span>
            </Link>
          )}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile top nav */}
        <nav className="md:hidden border-t overflow-x-auto">
          <div className="flex items-center gap-1 px-2 py-1.5 min-w-max">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all min-w-[52px]",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}