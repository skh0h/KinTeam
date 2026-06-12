import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreVertical, CheckCircle2, Clock, Circle, Trash2, UserX, User, Pin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getStarWorth } from '@/lib/stars';

const isUnassigned = (v) => !v || v === '' || v === 'anyone';

export default function TaskCard({ task, onStatusChange, onDelete, onAssign, onPermanentAssign, isAdmin, members = [] }) {
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const weeklyAssignee = !isUnassigned(task.assigned_to) ? memberMap[task.assigned_to] : null;
  const permanentAssignee = !isUnassigned(task.permanent_assigned_to) ? memberMap[task.permanent_assigned_to] : null;

  const memberLabel = (m) => m ? `${m.avatar_emoji ? m.avatar_emoji + ' ' : ''}${m.display_name || m.name}` : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn('transition-all', task.status === 'done' && 'opacity-60')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            {task.photo_url && (
              <img src={task.photo_url} alt={task.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <StatusBadge status={task.status} />
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  ⭐ {getStarWorth(task)}
                </span>
                {task.occurrence && task.occurrence !== 'as_needed' && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                    {task.occurrence === 'fortnightly' ? 'Every 2 wks' : task.occurrence}
                  </span>
                )}
                {permanentAssignee ? (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Pin className="w-3 h-3" /> {memberLabel(permanentAssignee)}
                  </span>
                ) : weeklyAssignee ? (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    <User className="w-3 h-3" /> {memberLabel(weeklyAssignee)}
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Unassigned
                  </span>
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
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Assign this week</DropdownMenuLabel>
                    {members.map(m => (
                      <DropdownMenuItem key={m.id} onClick={() => onAssign(task.id, m.id)}>
                        <User className="w-4 h-4 mr-2 text-muted-foreground" />
                        {memberLabel(m)}
                      </DropdownMenuItem>
                    ))}
                    {!isUnassigned(task.assigned_to) && (
                      <DropdownMenuItem onClick={() => onAssign(task.id, '')}>
                        <UserX className="w-4 h-4 mr-2 text-muted-foreground" /> Unassign (week)
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Always assign to</DropdownMenuLabel>
                    {members.map(m => (
                      <DropdownMenuItem key={`perm-${m.id}`} onClick={() => onPermanentAssign(task.id, m.id)}>
                        <Pin className="w-4 h-4 mr-2 text-primary" />
                        {memberLabel(m)}
                      </DropdownMenuItem>
                    ))}
                    {!isUnassigned(task.permanent_assigned_to) && (
                      <DropdownMenuItem onClick={() => onPermanentAssign(task.id, '')}>
                        <UserX className="w-4 h-4 mr-2 text-muted-foreground" /> Remove permanent
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