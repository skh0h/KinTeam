/**
 * Gamification helpers — pet growth stages and progress math.
 * Pure JS, no imports. Safe to call from any component or edge function.
 */

/** Points awarded when a family task is marked complete. */
export const GROWTH_PER_COMPLETION = 1;

/**
 * Ordered growth stages. A pet enters a stage when its growth_points
 * reach or exceed the stage's threshold.
 *
 * @type {Array<{ stage: number, label: string, emoji: string, threshold: number }>}
 */
export const STAGES = [
  { stage: 0, label: 'egg',      emoji: '🥚', threshold: 0  },
  { stage: 1, label: 'sprout',   emoji: '🌱', threshold: 5  },
  { stage: 2, label: 'sapling',  emoji: '🌿', threshold: 15 },
  { stage: 3, label: 'tree',     emoji: '🌳', threshold: 30 },
  { stage: 4, label: 'blooming', emoji: '🌸', threshold: 60 },
];

/**
 * Returns the STAGES entry whose threshold is the highest value <= growthPoints.
 *
 * @param {number} growthPoints
 * @returns {{ stage: number, label: string, emoji: string, threshold: number }}
 */
export function stageFor(growthPoints) {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (growthPoints >= s.threshold) current = s;
    else break;
  }
  return current;
}

/**
 * Returns progress toward the next growth stage.
 *
 * @param {number} growthPoints
 * @returns {{ current: { stage: number, label: string, emoji: string, threshold: number },
 *             next: { stage: number, label: string, emoji: string, threshold: number } | null,
 *             pct: number }}
 */
export function progressToNext(growthPoints) {
  const current = stageFor(growthPoints);
  const nextIndex = current.stage + 1;
  const next = nextIndex < STAGES.length ? STAGES[nextIndex] : null;

  if (!next) {
    return { current, next: null, pct: 100 };
  }

  const range = next.threshold - current.threshold;
  const earned = growthPoints - current.threshold;
  const pct = Math.min(100, Math.round((earned / range) * 100));

  return { current, next, pct };
}
