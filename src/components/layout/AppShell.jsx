import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, UserPlus, Settings, ClipboardList, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useLocalUser } from '@/lib/LocalUserContext';

export default function AppShell() {
  const location = useLocation();
  const { user } = useAuth();
  const { localUser } = useLocalUser();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/zones', label: 'Chores', icon: ClipboardList },
    { path: '/team-lift', label: 'Team Lift', icon: Users },
    { path: '/leaderboard', label: 'Leaders', icon: Trophy },
    ...(user?.role === 'admin' ? [{ path: '/members', label: 'Members', icon: UserPlus }] : []),
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
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all min-w-[52px]",
                  active
                    ? "text-primary"
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
    </div>
  );
}