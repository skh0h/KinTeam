import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import PhaseBadge from '@/components/shared/PhaseBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, CheckCircle2, Clock, Circle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function TaskCard({ task, onStatusChange, onDelete }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('transition-all', task.status === 'done' && 'opacity-60')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <StatusBadge status={task.status} />
                <PhaseBadge phase={task.phase} />
                {task.assigned_to && (
                  <span className="text-xs text-muted-foreground">→ {task.assigned_to}</span>
                )}
              </div>
              {task.notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.notes}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'pending')}>
                  <Circle className="w-4 h-4 mr-2 text-muted-foreground" /> Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                  <Clock className="w-4 h-4 mr-2 text-primary" /> In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(task.id, 'done')}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Done
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}