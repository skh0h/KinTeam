import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, Users, Clock } from 'lucide-react';
import MemberAvatar from '@/components/shared/MemberAvatar';
import ZoneIcon from '@/components/shared/ZoneIcon';
import { getCurrentWeekMonday, getWeekLabel } from '@/lib/weekUtils';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const availabilityColors = {
  full: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unavailable: 'bg-red-100 text-red-700',
};

export default function Huddle() {
  const queryClient = useQueryClient();
  const weekOf = getCurrentWeekMonday();

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.SystemZone.list(),
  });

  const { data: huddles = [] } = useQuery({
    queryKey: ['huddles'],
    queryFn: () => base44.entities.HuddleNote.list(),
  });

  const currentHuddle = huddles.find(h => h.week_of === weekOf);
  const [notes, setNotes] = useState(currentHuddle?.notes || '');
  const [adjustments, setAdjustments] = useState(currentHuddle?.adjustments || '');

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FamilyMember.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const saveHuddle = useMutation({
    mutationFn: async () => {
      if (currentHuddle) {
        return base44.entities.HuddleNote.update(currentHuddle.id, { notes, adjustments, completed: true });
      }
      return base44.entities.HuddleNote.create({ week_of: weekOf, notes, adjustments, completed: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['huddles'] }),
  });

  // Stats per zone
  const zoneStats = useMemo(() => {
    return zones.map(z => {
      const zt = tasks.filter(t => t.zone_id === z.id && t.week_of === weekOf);
      return {
        ...z,
        total: zt.length,
        done: zt.filter(t => t.status === 'done').length,
        pending: zt.filter(t => t.status === 'pending').length,
      };
    });
  }, [zones, tasks, weekOf]);

  // Stats per member
  const memberStats = useMemo(() => {
    return members.map(m => {
      const mt = tasks.filter(t => t.assigned_to === m.name && t.week_of === weekOf);
      return {
        ...m,
        total: mt.length,
        done: mt.filter(t => t.status === 'done').length,
      };
    });
  }, [members, tasks, weekOf]);

  if (membersLoading) {
    return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Family Huddle</h1>
        <p className="text-muted-foreground mt-1">{getWeekLabel(weekOf)} — 5-minute sync</p>
      </div>

      {/* Step 1: Availability */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">1. Check Availability</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/40"
            >
              <MemberAvatar emoji={m.avatar_emoji} name={m.name} />
              <Select
                value={m.availability || 'full'}
                onValueChange={(v) => updateMember.mutate({ id: m.id, data: { availability: v } })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">✅ Full</SelectItem>
                  <SelectItem value="partial">⚠️ Partial</SelectItem>
                  <SelectItem value="unavailable">❌ Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Step 2: Zone Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-lg">2. Zone Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {zoneStats.map(z => (
              <div key={z.id} className="p-3 rounded-xl border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <ZoneIcon icon={z.icon} color={z.color} size="sm" />
                  <span className="text-sm font-medium">{z.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-600">{z.done} done</span>
                  <span className="text-muted-foreground">/</span>
                  <span>{z.total} total</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Member workload */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <CardTitle className="font-display text-lg">3. Workload Balance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberStats.map(m => {
            const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <MemberAvatar emoji={m.avatar_emoji} name={m.name} />
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs font-medium w-16 text-right">{m.done}/{m.total} done</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', availabilityColors[m.availability || 'full'])}>
                  {m.availability || 'full'}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Step 4: Notes & Adjustments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <CardTitle className="font-display text-lg">4. Notes & Adjustments</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Huddle Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key takeaways from this week's sync..." className="h-20" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Workload Adjustments</label>
            <Textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)} placeholder="Any swaps, redistributions, or changes..." className="h-20" />
          </div>
          <Button onClick={() => saveHuddle.mutate()} className="w-full rounded-xl">
            {currentHuddle ? 'Update Huddle Notes' : 'Save Huddle'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}