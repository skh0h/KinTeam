import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreVertical, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const CADENCE_LABELS = {
  nightly: 'Nightly',
  weekly: 'Weekly',
  semiweekly: 'Twice a week',
  fortnightly: 'Every two weeks',
};

function formatDays(days = []) {
  if (!days.length) return 'Every day';
  return days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
}

export default function EventCard({ event, onStatusChange, onDelete, isAdmin }) {
  const isDone = event.status === 'done';

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('transition-all', isDone && 'opacity-60')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            {event.photo_url && (
              <img src={event.photo_url} alt={event.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium text-sm', isDone && 'line-through text-muted-foreground')}>
                {event.title}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'
                )}>
                  {isDone ? 'Done' : 'Pending'}
                </span>
                {event.cadence && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {CADENCE_LABELS[event.cadence] || event.cadence}
                  </span>
                )}
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {formatDays(event.days)}
                </span>
              </div>
              {event.notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{event.notes}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange(event.id, 'pending')}>
                  <Circle className="w-4 h-4 mr-2 text-muted-foreground" /> Mark Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(event.id, 'done')}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Mark Done
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(event.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
