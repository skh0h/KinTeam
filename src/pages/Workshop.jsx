import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Star, Repeat, CalendarDays, Users, ImagePlus, StickyNote, ArrowLeft, Hammer, X, Loader2 } from 'lucide-react';
import WorkshopTile from '@/components/workshop/WorkshopTile';
import ChorePreviewCard from '@/components/workshop/ChorePreviewCard';
import AiChoreBuilder from '@/components/workshop/AiChoreBuilder';

const OCCURRENCES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'as_needed', label: 'As needed' },
];

const DAYS = ['any', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const empty = { title: '', occurrence: 'weekly', priority: 'medium', due_day: 'any', notes: '', assigned_to: '', permanent_assigned_to: '', photo_url: '', stars: 1 };

export default function Workshop() {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const createChore = useMutation({
    mutationFn: (data) => base44.entities.FamilyTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/zones');
    },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
    } finally {
      setUploading(false);
    }
  };

  const handleBuild = () => {
    if (!form.title.trim()) return;
    createChore.mutate({ ...form, task_type: 'routine', phase: 'none', status: 'pending' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/zones')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Chore Workshop 🔨</h1>
          <p className="text-muted-foreground mt-1">Build your chore card tile by tile.</p>
        </div>
      </div>

      {/* AI builder */}
      <AiChoreBuilder onBuilt={(aiData) => setForm(f => ({ ...f, ...aiData }))} />

      {/* Live preview */}
      <ChorePreviewCard form={form} members={members} />

      {/* Builder tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <WorkshopTile icon={Pencil} title="Name" filled={!!form.title.trim()}>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Take out the bins"
            autoFocus
          />
        </WorkshopTile>

        <WorkshopTile icon={Star} title="Worth" filled={true}>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => set('stars', n)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  form.stars === n ? 'bg-amber-100 border-amber-400 text-amber-700 font-semibold' : 'border-border text-muted-foreground hover:border-amber-300'
                }`}
              >
                ⭐ {n}
              </button>
            ))}
          </div>
        </WorkshopTile>

        <WorkshopTile icon={Repeat} title="Occurrence" filled={true}>
          <Select value={form.occurrence} onValueChange={(v) => set('occurrence', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OCCURRENCES.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkshopTile>

        <WorkshopTile icon={CalendarDays} title="Day" filled={form.due_day !== 'any'}>
          <Select value={form.due_day} onValueChange={(v) => set('due_day', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map(d => (
                <SelectItem key={d} value={d} className="capitalize">{d === 'any' ? 'Any day' : d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkshopTile>

        <WorkshopTile icon={Users} title="Assign" filled={!!(form.assigned_to || form.permanent_assigned_to)}>
          <div className="space-y-2">
            <Select value={form.assigned_to} onValueChange={(v) => set('assigned_to', v)}>
              <SelectTrigger><SelectValue placeholder="This week: Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.avatar_emoji ? `${m.avatar_emoji} ` : ''}{m.display_name || m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.permanent_assigned_to} onValueChange={(v) => set('permanent_assigned_to', v)}>
              <SelectTrigger><SelectValue placeholder="Always: Nobody" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nobody</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.avatar_emoji ? `${m.avatar_emoji} ` : ''}{m.display_name || m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </WorkshopTile>

        <WorkshopTile icon={ImagePlus} title="Photo" filled={!!form.photo_url}>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          {form.photo_url ? (
            <div className="relative w-full h-24 rounded-lg overflow-hidden border">
              <img src={form.photo_url} alt="Chore reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => set('photo_url', '')}
                className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-16 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              <span className="text-xs">{uploading ? 'Uploading…' : 'Upload photo'}</span>
            </button>
          )}
        </WorkshopTile>

        <WorkshopTile icon={StickyNote} title="Notes" filled={!!form.notes.trim()} className="sm:col-span-2 lg:col-span-3">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Any extra details..."
            className="h-16"
          />
        </WorkshopTile>
      </div>

      {/* Build button */}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="outline" onClick={() => navigate('/zones')}>Cancel</Button>
        <Button
          className="gap-2 rounded-xl"
          onClick={handleBuild}
          disabled={!form.title.trim() || uploading || createChore.isPending}
        >
          <Hammer className="w-4 h-4" />
          {createChore.isPending ? 'Building…' : 'Build Chore'}
        </Button>
      </div>
    </div>
  );
}