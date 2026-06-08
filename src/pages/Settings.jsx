import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, LogOut, Settings as SettingsIcon, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import Login from '@/pages/Login';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="w-full">
          <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
          <TabsTrigger value="auth" className="flex-1">Auth</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                <CardTitle className="font-display text-lg">Your Account</CardTitle>
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
                <p className="text-sm text-muted-foreground text-center py-4">Not logged in. Use the Auth tab to sign in.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth Tab — embedded login form */}
        <TabsContent value="auth" className="mt-4">
          {user ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-3">
                <KeyRound className="w-8 h-8 text-primary mx-auto" />
                <p className="font-medium">You're already logged in as <span className="text-primary">{user.full_name || user.email}</span>.</p>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Login />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}