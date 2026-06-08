import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw, Crown, ArrowRight, ChevronRight } from 'lucide-react';
import ZoneIcon from '@/components/shared/ZoneIcon';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Rotation() {
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.SystemZone.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      for (const zone of zones) {
        const order = zone.rotation_order || [];
        if (order.length === 0) continue;
        const nextIndex = ((zone.rotation_index || 0) + 1) % order.length;
        await base44.entities.SystemZone.update(zone.id, {
          rotation_index: nextIndex,
          current_lead_name: order[nextIndex],
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  if (isLoading) {
    return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Rotation</h1>
          <p className="text-muted-foreground mt-1">Fair leadership rotation across all zones.</p>
        </div>
        <Button onClick={() => rotateMutation.mutate()} className="rounded-xl gap-2">
          <RotateCcw className="w-4 h-4" /> Rotate All
        </Button>
      </div>

      {/* How it works */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <h3 className="font-display font-semibold text-sm mb-1">How Rotation Works</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each zone has its own rotation order. When you hit "Rotate All", every zone's lead advances to the next person in the list. This ensures no one gets stuck with the same heavy responsibility week after week.
          </p>
        </CardContent>
      </Card>

      {/* Current leaders */}
      <div className="space-y-3">
        {zones.map((zone, i) => {
          const order = zone.rotation_order || [];
          const currentIndex = zone.rotation_index || 0;
          const nextIndex = (currentIndex + 1) % (order.length || 1);
          const currentLead = order[currentIndex] || '—';
          const nextLead = order[nextIndex] || '—';
          const currentMember = members.find(m => m.name === currentLead);
          const nextMember = members.find(m => m.name === nextLead);

          return (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <ZoneIcon icon={zone.icon} color={zone.color} />
                    <div>
                      <h3 className="font-display text-lg font-semibold">{zone.name}</h3>
                      <p className="text-xs text-muted-foreground">{zone.description}</p>
                    </div>
                  </div>

                  {/* Current → Next */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="flex items-center gap-2 flex-1">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm">
                        {currentMember?.avatar_emoji || '👤'}
                      </div>
                      <span className="text-sm font-medium">{currentLead}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="text-sm text-muted-foreground">{nextLead}</span>
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-sm">
                        {nextMember?.avatar_emoji || '👤'}
                      </div>
                    </div>
                  </div>

                  {/* Full rotation order */}
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {order.map((name, idx) => {
                      const mem = members.find(m => m.name === name);
                      return (
                        <div key={idx} className="flex items-center">
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-md',
                            idx === currentIndex
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground'
                          )}>
                            {mem?.avatar_emoji || ''} {name}
                          </span>
                          {idx < order.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}