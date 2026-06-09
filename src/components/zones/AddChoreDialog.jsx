import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const OCCURRENCES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'as_needed', label: 'As needed' },
];

const DAYS = [
  { value: 'any', label: 'Any day' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const empty = { title: '', occurrence: 'weekly', priority: 'medium', due_day: 'any', notes: '' };

export default function AddChoreDialog({ open, onOpenChange, onSubmit, members }) {
  const [form, setForm] = useState(empty);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    let assigned_to = '';
    if (selectedMembers.length === 0) {
      assigned_to = 'anyone';
    } else if (selectedMembers.length === 1) {
      assigned_to = selectedMembers[0];
    } else {
      // 2+ checked = random pick from the pool
      assigned_to = selectedMembers[Math.floor(Math.random() * selectedMembers.length)];
    }
    onSubmit({ ...form, assigned_to });
    setForm(empty);
    setSelectedMembers([]);
  };

  const toggleMember = (name) => {
    setSelectedMembers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add Chore</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Chore Name</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Take out the bins"
              className="mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Occurrence</Label>
              <Select value={form.occurrence} onValueChange={(v) => set('occurrence', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCCURRENCES.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Day</Label>
            <Select value={form.due_day} onValueChange={(v) => set('due_day', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assign To</Label>
            <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`member-${m.id}`}
                    checked={selectedMembers.includes(m.name)}
                    onCheckedChange={() => toggleMember(m.name)}
                  />
                  <label htmlFor={`member-${m.id}`} className="text-sm cursor-pointer select-none">
                    {m.avatar_emoji} {m.display_name || m.name}
                  </label>
                </div>
              ))}
              {selectedMembers.length >= 2 && (
                <p className="text-xs text-muted-foreground border-t pt-2 mt-1">
                  🎲 Will be randomly assigned to one of the checked members.
                </p>
              )}
            </div>
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
            <Button type="submit">Add Chore</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}