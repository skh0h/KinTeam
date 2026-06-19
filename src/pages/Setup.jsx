import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useLocalUser } from '@/lib/LocalUserContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Shield } from 'lucide-react';

export default function Setup() {
  const { signIn, localUser } = useLocalUser();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState(false);
  const [form, setForm] = useState({ name: '', display_name: '', avatar_emoji: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    base44.entities.FamilyMember.list()
      .then((members) => {
        if (!active) return;
        if (members.length > 0) setExisting(true);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
      });
    return () => { active = false; };
  }, []);

  if (localUser) return <Navigate to="/" replace />;

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (existing) return <Navigate to="/login" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const current = await base44.entities.FamilyMember.list();
      if (current.length > 0) {
        setExisting(true);
        return;
      }
      const newMember = await base44.entities.FamilyMember.create({
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        avatar_emoji: form.avatar_emoji.trim(),
        role: 'admin',
      });
      signIn(newMember);
      navigate('/', { replace: true });
    } catch (error) {
      toast({
        title: 'Failed to create admin',
        description: error?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl">🏠</span>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-3">All-Hands</h1>
          <p className="text-muted-foreground mt-1">Set up your household</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="font-display text-lg">Create the family admin</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              This person will be the household owner and admin. You can add other family members after signing in.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>Display Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Mom"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Emoji Avatar <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.avatar_emoji}
                  onChange={(e) => setForm({ ...form, avatar_emoji: e.target.value })}
                  placeholder="🧑"
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create admin & continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
