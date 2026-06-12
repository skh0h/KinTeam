import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { MODES } from '@/lib/modes';
import { format } from 'date-fns';

export default function ModeScheduler() {
  const queryClient = useQueryClient();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [mode, setMode] = useState('vacation');

  const { data: schedules = [] } = useQuery({
    queryKey: ['scheduled-modes'],
    queryFn: () => base44.entities.ScheduledMode.list('start_date'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['scheduled-modes'] });

  const addSchedule = useMutation({
    mutationFn: () => base44.entities.ScheduledMode.create({ start_date: start, end_date: end, mode }),
    onSuccess: () => { invalidate(); setStart(''); setEnd(''); },
  });

  const deleteSchedule = useMutation({
    mutationFn: (id) => base44.entities.ScheduledMode.delete(id),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <CardTitle className="font-display text-lg">Schedule a Mode</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="flex-1 min-w-[130px]" value={start} onChange={e => setStart(e.target.value)} />
          <Input type="date" className="flex-1 min-w-[130px]" value={end} onChange={e => setEnd(e.target.value)} />
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MODES).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.emoji} {cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            onClick={() => addSchedule.mutate()}
            disabled={!start || !end || end < start || addSchedule.isPending}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {schedules.length > 0 && (
          <ul className="space-y-1.5">
            {schedules.map(s => (
              <li key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                <span>{MODES[s.mode]?.emoji}</span>
                <span className="flex-1">
                  <strong>{MODES[s.mode]?.label}</strong>{' '}
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(s.start_date + 'T12:00:00'), 'MMM d')} – {format(new Date(s.end_date + 'T12:00:00'), 'MMM d')}
                  </span>
                </span>
                <button
                  onClick={() => deleteSchedule.mutate(s.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">The mode switches automatically on the start date and back to Normal after the end date.</p>
      </CardContent>
    </Card>
  );
}