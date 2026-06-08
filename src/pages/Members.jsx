import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Mail, Shield, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Members() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [status, setStatus] = useState(null);

  // Redirect non-admins
  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    await base44.users.inviteUser(email.trim(), role);
    setStatus('sent');
    setEmail('');
    setRole('user');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Family Members</h1>
        <p className="text-muted-foreground mt-1">Invite family members to create their accounts.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">Invite a Member</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
                placeholder="familymember@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Member
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full rounded-xl gap-2" disabled={status === 'sending'}>
              <Mail className="w-4 h-4" />
              {status === 'sending' ? 'Sending…' : 'Send Invite'}
            </Button>
            {status === 'sent' && (
              <p className="text-center text-sm text-emerald-600 font-medium">Invite sent! They'll receive an email to join.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}