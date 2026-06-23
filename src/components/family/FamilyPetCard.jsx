import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { stageFor, progressToNext, GROWTH_PER_COMPLETION } from '@/lib/gamification';
import { useCelebration } from '@/hooks/useCelebration';

function computeGrowth(members, tasks) {
  const totalStars = members.reduce((sum, m) => sum + (m.bonus_stars || 0), 0);
  const completedChoreCount = tasks.reduce((sum, t) => {
    // Count tasks with status 'done'
    const doneMark = t.status === 'done' ? 1 : 0;
    // Also count historical completed_dates entries
    const historyCount = Array.isArray(t.completed_dates) ? t.completed_dates.length : 0;
    return sum + doneMark + historyCount;
  }, 0);
  return totalStars + completedChoreCount * GROWTH_PER_COMPLETION;
}

export default function FamilyPetCard() {
  const qc = useQueryClient();
  const { celebrate, CelebrationPortal } = useCelebration();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const prevStageRef = useRef(null);
  const cardRef = useRef(null);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.FamilyMember.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.FamilyTask.list(),
  });

  const {
    data: pets = [],
    isLoading: petsLoading,
  } = useQuery({
    queryKey: ['family-pet'],
    queryFn: () => base44.entities.FamilyPet.list(),
  });

  // Create pet if none exists
  const createPet = useMutation({
    mutationFn: () => base44.entities.FamilyPet.create({ name: 'Sprout', species: 'plant', growth_points: 0, stage: 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-pet'] }),
  });

  // Update pet (rename or growth sync)
  const updatePet = useMutation({
    mutationFn: ({ id, values }) => base44.entities.FamilyPet.update(id, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['family-pet'] }),
  });

  const pet = pets[0] ?? null;

  // Auto-create if no pet found after load
  useEffect(() => {
    if (!petsLoading && pets.length === 0 && !createPet.isPending) {
      createPet.mutate();
    }
  }, [petsLoading, pets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync computed growth back to pet row
  useEffect(() => {
    if (!pet || members.length === 0) return;
    const growth_points = computeGrowth(members, tasks);
    const stage = stageFor(growth_points).stage;

    if (pet.growth_points !== growth_points || pet.stage !== stage) {
      updatePet.mutate({ id: pet.id, values: { growth_points, stage } });
    }
  }, [members, tasks, pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect stage increase → celebrate
  useEffect(() => {
    if (!pet) return;
    const currentStage = stageFor(pet.growth_points).stage;
    if (prevStageRef.current !== null && currentStage > prevStageRef.current) {
      const rect = cardRef.current?.getBoundingClientRect();
      celebrate(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
    }
    prevStageRef.current = currentStage;
  }, [pet?.growth_points]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = () => {
    if (!pet || !draftName.trim()) { setEditing(false); return; }
    updatePet.mutate({ id: pet.id, values: { name: draftName.trim() } });
    setEditing(false);
  };

  if (petsLoading || !pet) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {petsLoading ? 'Awakening the family pet…' : 'Growing your first pet…'}
        </CardContent>
      </Card>
    );
  }

  const growth_points = computeGrowth(members, tasks);
  const { current, next, pct } = progressToNext(growth_points);

  const stageCaption = {
    egg: 'Still in the shell — keep doing chores to hatch!',
    sprout: 'Just sprouted! Every task helps it grow.',
    sapling: 'Growing stronger every day.',
    tree: 'A mighty tree! Your family rocks.',
    blooming: 'In full bloom — you\'re an all-star family!',
  }[current.label] ?? 'Keep it up!';

  return (
    <>
      {CelebrationPortal}
      <Card ref={cardRef}>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <span>🌱</span> Family Pet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big stage emoji + name */}
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-7xl select-none" role="img" aria-label={current.label}>
              {current.emoji}
            </span>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-36 text-center font-display font-semibold"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
                  autoFocus
                  maxLength={24}
                />
                <Button size="sm" onClick={handleRename}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <button
                className="font-display text-xl font-bold tracking-tight hover:underline focus:outline-none"
                onClick={() => { setDraftName(pet.name); setEditing(true); }}
                title="Click to rename"
              >
                {pet.name}
              </button>
            )}
            <span className="text-xs text-muted-foreground capitalize">{current.label} · {growth_points} pts</span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{current.emoji} {current.label}</span>
              {next ? <span>{next.emoji} {next.label}</span> : <span>Max stage!</span>}
            </div>
            <Progress value={pct} className="h-2.5" />
            {next && (
              <p className="text-xs text-center text-muted-foreground">{pct}% to {next.label}</p>
            )}
          </div>

          {/* Caption */}
          <p className="text-sm text-center text-muted-foreground italic">{stageCaption}</p>
        </CardContent>
      </Card>
    </>
  );
}
