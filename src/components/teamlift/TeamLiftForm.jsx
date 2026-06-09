import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClipboardList, Zap, CheckSquare, Plus, X } from 'lucide-react';

const phaseIcons = { prep: ClipboardList, execution: Zap, verification: CheckSquare };

const emptyPhase = () => ({ title: '', assigned_to: '', notes: '', steps: [] });

export default function TeamLiftForm({ open, onOpenChange, onSubmit, members }) {
  const [projectName, setProjectName] = useState('');
  const [phases, setPhases] = useState({
    prep: emptyPhase(),
    execution: emptyPhase(),
    verification: emptyPhase(),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onSubmit({ projectName, phases });
    setProjectName('');
    setPhases({ prep: emptyPhase(), execution: emptyPhase(), verification: emptyPhase() });
    onOpenChange(false);
  };

  const updatePhase = (phase, field, value) => {
    setPhases(p => ({ ...p, [phase]: { ...p[phase], [field]: value } }));
  };

  const addStep = (phase) => {
    setPhases(p => ({
      ...p,
      [phase]: {
        ...p[phase],
        steps: [...p[phase].steps, { id: crypto.randomUUID(), text: '', assigned_to: '', done: false }],
      },
    }));
  };

  const updateStep = (phase, stepId, field, value) => {
    setPhases(p => ({
      ...p,
      [phase]: {
        ...p[phase],
        steps: p[phase].steps.map(s => s.id === stepId ? { ...s, [field]: value } : s),
      },
    }));
  };

  const removeStep = (phase, stepId) => {
    setPhases(p => ({
      ...p,
      [phase]: {
        ...p[phase],
        steps: p[phase].steps.filter(s => s.id !== stepId),
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New Team-Lift Chore</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Project Name</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Deep Clean Kitchen" className="mt-1" />
          </div>

          {['prep', 'execution', 'verification'].map(phase => {
            const Icon = phaseIcons[phase];
            return (
              <div key={phase} className="p-4 rounded-xl bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <h4 className="font-medium text-sm capitalize">{phase} Phase</h4>
                </div>

                <Input
                  value={phases[phase].title}
                  onChange={(e) => updatePhase(phase, 'title', e.target.value)}
                  placeholder={`What needs to happen in ${phase}?`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Select value={phases[phase].assigned_to} onValueChange={(v) => updatePhase(phase, 'assigned_to', v)}>
                    <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
                    <SelectContent>
                      {members.map(m => <SelectItem key={m.id} value={m.name}>{m.avatar_emoji} {m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={phases[phase].notes}
                    onChange={(e) => updatePhase(phase, 'notes', e.target.value)}
                    placeholder="Notes..."
                    className="h-9 min-h-9"
                  />
                </div>

                {/* Steps */}
                <div className="space-y-1.5">
                  {phases[phase].steps.map((step, idx) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                      <Input
                        value={step.text}
                        onChange={(e) => updateStep(phase, step.id, 'text', e.target.value)}
                        placeholder="Step description..."
                        className="h-8 text-sm flex-1"
                      />
                      <Select value={step.assigned_to} onValueChange={(v) => updateStep(phase, step.id, 'assigned_to', v)}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Anyone</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.name}>{m.avatar_emoji} {m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button type="button" onClick={() => removeStep(phase, step.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addStep(phase)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <Plus className="w-3 h-3" /> Add step
                  </button>
                </div>
              </div>
            );
          })}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}