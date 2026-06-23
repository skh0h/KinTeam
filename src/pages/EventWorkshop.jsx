import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLocalUser } from '@/lib/LocalUserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AiEventBuilder from '@/components/events/AiEventBuilder';
import { format } from 'date-fns';

const CADENCES = [
  { value: 'nightly', label: 'Nightly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'semiweekly', label: 'Twice a week' },
  { value: 'fortnightly', label: 'Every two weeks' },
];

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const today = format(new Date(), 'yyyy-MM-dd');
const empty = { title: '', cadence: 'weekly', days: ['monday'], start_date: today, notes: '', photo_url: '' };

function DayPicker({ cadence, days, onChange }) {
  if (cadence === 'nightly') return null;

  const isSingle = cadence === 'weekly' || cadence === 'fortnightly';
  const isDouble = cadence === 'semiweekly';

  const toggle = (day) => {
    if (isSingle) {
      onChange([day]);
    } else if (isDouble) {
      if (days.includes(day)) {
        onChange(days.filter(d => d !== day));
      } else if (days.length < 2) {
        onChange([...days, day]);
      }
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium mb-3">
          Day{isDouble ? 's — pick exactly 2' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(day => {
            const selected = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                className={`px-3 py-1.5 rounded-lg text-sm border capitalize transition-all ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {isDouble && days.length !== 2 && (
          <p className="text-xs text-destructive mt-2">Select exactly 2 days</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function EventWorkshop() {
  const [form, setForm] = useState(empty);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { localUser } = useLocalUser();
  const isAdmin = localUser?.role === 'admin';

  useEffect(() => {
    if (localUser && !isAdmin) {
      navigate('/calendar', { replace: true });
    }
  }, [localUser, isAdmin, navigate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleCadenceChange = (val) => {
    setForm(f => ({ ...f, cadence: val, days: val === 'nightly' ? [] : (f.days.length ? f.days : ['monday']) }));
  };

  const createEvent = useMutation({
    mutationFn: (data) => base44.entities.FamilyEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/calendar');
    },
  });

  const canSubmit = form.title.trim() &&
    (form.cadence === 'nightly' || (form.cadence === 'semiweekly' ? form.days.length === 2 : form.days.length === 1));

  const handleBuild = () => {
    if (!canSubmit) return;
    createEvent.mutate({
      title: form.title.trim(),
      notes: form.notes,
      cadence: form.cadence,
      days: form.days,
      start_date: form.start_date,
      status: 'pending',
      photo_url: form.photo_url || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/calendar')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Event Workshop</h1>
          <p className="text-muted-foreground mt-1">Set up a recurring family event.</p>
        </div>
      </div>

      {/* AI builder */}
      <AiEventBuilder onBuilt={(aiData) => setForm(f => ({ ...f, ...aiData }))} />

      {/* Form tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="sm:col-span-2">
          <CardContent className="p-4 space-y-1">
            <Label htmlFor="title">Event Name</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Family dinner"
              autoFocus
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <Label>Cadence</Label>
            <Select value={form.cadence} onValueChange={handleCadenceChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CADENCES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <Label htmlFor="start_date">
              <CalendarDays className="inline w-3.5 h-3.5 mr-1" />
              Start Date
            </Label>
            <Input
              id="start_date"
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="sm:col-span-2">
          <DayPicker cadence={form.cadence} days={form.days} onChange={(days) => set('days', days)} />
        </div>

        <Card className="sm:col-span-2">
          <CardContent className="p-4 space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any extra details..."
              className="h-16"
            />
          </CardContent>
        </Card>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="outline" onClick={() => navigate('/calendar')}>Cancel</Button>
        <Button
          className="gap-2 rounded-xl"
          onClick={handleBuild}
          disabled={!canSubmit || createEvent.isPending}
        >
          {createEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
          {createEvent.isPending ? 'Saving…' : 'Save Event'}
        </Button>
      </div>
    </div>
  );
}
