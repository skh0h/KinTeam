import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import AppShell from '@/components/layout/AppShell';
import { LocalUserProvider } from '@/lib/LocalUserContext';
import Dashboard from '@/pages/Dashboard';
import Zones from '@/pages/Zones';
import TeamLift from '@/pages/TeamLift';
import Members from '@/pages/Members';
import Setup from '@/pages/Setup';
import Leaderboard from '@/pages/Leaderboard';
import Rewards from '@/pages/Rewards';
import Workshop from '@/pages/Workshop';
import Settings from '@/pages/Settings';
import CalendarPage from '@/pages/Calendar';
import EventWorkshop from '@/pages/EventWorkshop';
import Family from '@/pages/Family';
import Wrapped from '@/pages/Wrapped';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Only redirect if not already on /login — prevents an infinite reload loop
      if (window.location.pathname !== '/login') {
        navigateToLogin();
        return null;
      }
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/team-lift" element={<TeamLift />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/members" element={<Members />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/event-workshop" element={<EventWorkshop />} />
          <Route path="/family" element={<Family />} />
          <Route path="/wrapped" element={<Wrapped />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <LocalUserProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
      </LocalUserProvider>
    </AuthProvider>
  )
}

export default App