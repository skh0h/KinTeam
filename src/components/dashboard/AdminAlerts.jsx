import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';

export default function AdminAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: () => base44.entities.AdminAlert.filter({ read: false }),
    refetchInterval: 30000,
  });

  const dismiss = useMutation({
    mutationFn: (id) => base44.entities.AdminAlert.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-alerts'] }),
  });

  if (alerts.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <CardTitle className="font-display text-base text-primary">
            Check This! ({alerts.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map(alert => (
            <li key={alert.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-xl px-4 py-2.5">
              <p className="text-sm">{alert.message}</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => dismiss.mutate(alert.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}