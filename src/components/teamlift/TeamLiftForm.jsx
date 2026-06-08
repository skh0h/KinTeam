import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ClipboardList, Zap, CheckSquare } from 'lucide-react';

const phaseIcons = { prep: ClipboardList, execution: Zap, verification: CheckSquare };

export default function TeamLiftForm({ open, onOpenChange, onSubmit, zones, members }) {
  const [projectName, setProjectName] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [phases, setPhases] = useState({
    prep: { title: '', assigned_to: '', notes: '' },
    execution: { title: '', assigned_to: '', notes: '' },
    verification: { title: '', assigned_to: '', notes: '' },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectName.trim() || !zoneId) return;
    const zone = zones.find(z => z.id === zoneId);
    onSubmit({ projectName, zoneId, zoneName: zone?.name || '', phases });
    setProjectName('');
    setZoneId('');
    setPhases({
      prep: { title: '', assigned_to: '', notes: '' },
      execution: { title: '', assigned_to: '', notes: '' },
      verification: { title: '', assigned_to: '', notes: '' },
    });
    onOpenChange(false);
  };

  const updatePhase = (phase, field, value) => {
    setPhases(p => ({ ...p, [phase]: { ...p[phase], [field]: value } }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New Team-Lift Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Project Name</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Deep Clean Kitchen" className="mt-1" />
          </div>
          <div>
            <Label>Zone</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
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