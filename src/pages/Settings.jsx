import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, LogIn, LogOut, Settings as SettingsIcon, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

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
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <LogIn className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Not logged in</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                <CardTitle className="font-display text-lg">Authentication</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">{user?.email || 'Not logged in'}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
              </div>

              <Link to="/forgot-password">
                <Button variant="outline" className="w-full gap-2">
                  <KeyRound className="w-4 h-4" /> Change Password
                </Button>
              </Link>

              {!user && (
                <Link to="/login">
                  <Button className="w-full gap-2">
                    <LogIn className="w-4 h-4" /> Log In
                  </Button>
                </Link>
              )}

              {user && (
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-destructive hover:bg-destructive/5"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}