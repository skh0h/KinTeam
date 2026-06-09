import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreVertical, CheckCircle2, Clock, Circle, Trash2, UserX, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const isUnassigned = (assigned_to) => !assigned_to || assigned_to === '' || assigned_to === 'anyone';

export default function TaskCard({ task, onStatusChange, onDelete, onAssign, isAdmin, members = [] }) {
  const unassigned = isUnassigned(task.assigned_to);

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
                {task.occurrence && task.occurrence !== 'as_needed' && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                    {task.occurrence === 'fortnightly' ? 'Every 2 wks' : task.occurrence}
                  </span>
                )}
                {unassigned ? (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Unassigned
                  </span>
                ) : (
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
                {isAdmin && members.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Assign to</DropdownMenuLabel>
                    {members.map(m => (
                      <DropdownMenuItem key={m.id} onClick={() => onAssign(task.id, m.name)}>
                        <User className="w-4 h-4 mr-2 text-muted-foreground" />
                        {m.avatar_emoji} {m.display_name || m.name}
                      </DropdownMenuItem>
                    ))}
                    {!unassigned && (
                      <DropdownMenuItem onClick={() => onAssign(task.id, '')}>
                        <UserX className="w-4 h-4 mr-2 text-muted-foreground" /> Unassign
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
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