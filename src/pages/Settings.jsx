import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Settings as SettingsIcon, LogOut, Shield } from 'lucide-react';
import { useLocalUser } from '@/lib/LocalUserContext';
import { base44 } from '@/api/base44Client';

const ADMIN_PIN = '1234';

export default function Settings() {
  const { localUser, signIn, signOut } = useLocalUser();
  const [members, setMembers] = useState([]);
  const [pinTarget, setPinTarget] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState(() => localUser ? 'account' : 'auth');

  useEffect(() => {
    base44.entities.FamilyMember.list().then(setMembers);
  }, []);

  const handleSwitch = (member) => {
    if (member.role === 'admin') {
      setPinTarget(member);
      setPin('');
      setPinError('');
      setActiveTab('account');
    } else {
      signIn(member);
      window.location.href = '/';
    }
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      signIn(pinTarget);
      window.location.href = '/';
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
          <TabsTrigger value="auth" className="flex-1">Switch User</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                <CardTitle className="font-display text-lg">You are</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {localUser ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                    <span className="text-4xl">{localUser.avatar_emoji || '👤'}</span>
                    <div>
                      <p className="font-semibold">{localUser.display_name || localUser.name}</p>
                      {localUser.display_name && <p className="text-xs text-muted-foreground">{localUser.name}</p>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={signOut}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </Button>
                </div>
              ) : pinTarget ? null : (
                <p className="text-sm text-muted-foreground text-center py-4">No one selected. Use Switch User.</p>
              )}
            </CardContent>
          </Card>

          {pinTarget && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle className="font-display text-lg">Admin PIN Required</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Enter the admin PIN to sign in as <strong>{pinTarget.display_name || pinTarget.name}</strong>.
                  </p>
                  <Input
                    type="password"
                    placeholder="PIN"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                    autoFocus
                  />
                  {pinError && <p className="text-xs text-destructive">{pinError}</p>}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handlePinSubmit}>Confirm</Button>
                    <Button variant="outline" className="flex-1" onClick={() => setPinTarget(null)}>Cancel</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Switch User Tab */}
        <TabsContent value="auth" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">Who are you?</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No members set up yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleSwitch(member)}
                      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-95 ${
                        localUser?.id === member.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'bg-card hover:bg-muted/50 hover:border-primary/40'
                      }`}
                    >
                      <span className="text-4xl">{member.avatar_emoji || '👤'}</span>
                      <span className="font-medium text-sm">{member.display_name || member.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}