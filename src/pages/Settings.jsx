import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, LogIn, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">Account</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{user.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{user.email} · <span className="capitalize">{user.role}</span></p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => base44.auth.logout()}
              >
                <LogOut className="w-4 h-4" /> Log Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <LogIn className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Not logged in</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}