import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Members() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', display_name: '', avatar_emoji: '' });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const addMember = useMutation({
    mutationFn: (data) => base44.entities.FamilyMember.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setForm({ name: '', display_name: '', avatar_emoji: '' });
    },
  });

  const deleteMember = useMutation({
    mutationFn: (id) => base44.entities.FamilyMember.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  // Redirect non-admins (after all hooks)
  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addMember.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Family Members</h1>
        <p className="text-muted-foreground mt-1">Manage who's in the household.</p>
      </div>

      {/* Add member */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">Add a Family Member</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Mom"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Emoji Avatar (optional)</Label>
              <Input
                value={form.avatar_emoji}
                onChange={(e) => setForm({ ...form, avatar_emoji: e.target.value })}
                placeholder="🧑"
                className="mt-1 w-24"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={addMember.isPending}>
              {addMember.isPending ? 'Adding…' : 'Add Member'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members list */}
      {members.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">Current Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-2xl">{member.avatar_emoji || '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{member.name}</p>
                  {member.display_name && (
                    <p className="text-xs text-muted-foreground">"{member.display_name}"</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteMember.mutate(member.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}