import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import AiEventBuilder from './AiEventBuilder';
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
    <div>
      <Label>
        Day{isDouble ? 's (pick exactly 2)' : ''}
      </Label>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {ALL_DAYS.map(day => {
          const selected = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              className={`px-2.5 py-1 rounded-lg text-xs border capitalize transition-all ${
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>
      {isDouble && days.length !== 2 && (
        <p className="text-xs text-destructive mt-1">Select exactly 2 days</p>
      )}
    </div>
  );
}

export default function AddEventDialog({ open, onOpenChange, onSubmit, isAdmin = false }) {
  const [form, setForm] = useState(empty);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleCadenceChange = (val) => {
    setForm(f => ({ ...f, cadence: val, days: val === 'nightly' ? [] : ['monday'] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!form.title.trim()) return;
    if (form.cadence === 'semiweekly' && form.days.length !== 2) return;
    onSubmit({ ...form });
    setForm(empty);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Add Event</DialogTitle>
        </DialogHeader>
        <AiEventBuilder onBuilt={(aiData) => setForm(f => ({ ...f, ...aiData }))} />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Event Name</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Family dinner"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label>Cadence</Label>
            <Select value={form.cadence} onValueChange={handleCadenceChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CADENCES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DayPicker cadence={form.cadence} days={form.days} onChange={(days) => set('days', days)} />

          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any extra details..."
              className="mt-1 h-20"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={!form.title.trim() || (form.cadence === 'semiweekly' && form.days.length !== 2)}
            >
              Add Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
