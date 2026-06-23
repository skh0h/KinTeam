import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, format,
  parseISO, differenceInCalendarWeeks,
} from 'date-fns';
import EventCard from '@/components/events/EventCard';
import { useLocalUser } from '@/lib/LocalUserContext';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const CADENCE_COLORS = {
  nightly: 'bg-violet-100 text-violet-700',
  weekly: 'bg-blue-100 text-blue-700',
  semiweekly: 'bg-cyan-100 text-cyan-700',
  fortnightly: 'bg-amber-100 text-amber-700',
};

/**
 * Returns true if the given date falls on a valid fortnightly occurrence.
 * Rule: whole-weeks-between(start_date, day) must be even (0, 2, 4, …).
 */
function isFortnightlyOccurrence(startDateStr, date) {
  const start = parseISO(startDateStr);
  const weeks = differenceInCalendarWeeks(date, start, { weekStartsOn: 1 });
  return weeks >= 0 && weeks % 2 === 0;
}

/**
 * Returns true if the given date is a scheduled occurrence for the event.
 */
function isEventOccurrence(event, date) {
  if (event.archived) return false;
  const weekdayName = WEEKDAY_NAMES[date.getDay()];

  switch (event.cadence) {
    case 'nightly':
      return true;
    case 'weekly':
      return (event.days || []).includes(weekdayName);
    case 'semiweekly':
      return (event.days || []).includes(weekdayName);
    case 'fortnightly':
      return (event.days || []).includes(weekdayName) &&
        isFortnightlyOccurrence(event.start_date, date);
    default:
      return false;
  }
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { localUser } = useLocalUser();
  const isAdmin = localUser?.role === 'admin';
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(new Date());

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.FamilyEvent.filter({ archived: false }),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FamilyEvent.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const deleteEvent = useMutation({
    mutationFn: (id) => base44.entities.FamilyEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const handleStatusChange = (id, status) => {
    const event = events.find(e => e.id === id);
    if (!event) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const completed_dates = status === 'done'
      ? [...(event.completed_dates || []), todayStr].filter((v, i, a) => a.indexOf(v) === i)
      : (event.completed_dates || []);
    updateEvent.mutate({ id, data: { status, completed_dates } });
  };

  // Build calendar grid for current view month
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const goToPrev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goToNext = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Recurring family events at a glance.</p>
        </div>
        {isAdmin && (
          <Button className="rounded-xl gap-2" onClick={() => navigate('/event-workshop')}>
            <Plus className="w-4 h-4" /> Add Event
          </Button>
        )}
      </div>

      {/* Month calendar */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Button variant="ghost" size="icon" onClick={goToPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm">{format(viewDate, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calDays.map((day, idx) => {
            const inMonth = isSameMonth(day, viewDate);
            const today = isToday(day);
            const dayEvents = events.filter(e => isEventOccurrence(e, day));

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[72px] p-1 border-b border-r',
                  !inMonth && 'bg-muted/30',
                  idx % 7 === 6 && 'border-r-0',
                  idx >= calDays.length - 7 && 'border-b-0',
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto',
                  today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      className={cn(
                        'text-[10px] px-1 py-0.5 rounded truncate leading-tight',
                        CADENCE_COLORS[e.cadence] || 'bg-muted text-muted-foreground',
                      )}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div>
        <h2 className="font-semibold text-base mb-3">All Events</h2>
        <div className="space-y-3">
          {events.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No events yet. Add one to get started!
            </p>
          )}
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              isAdmin={isAdmin}
              onStatusChange={handleStatusChange}
              onDelete={(id) => deleteEvent.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
