/**
 * Badge definitions and derivation helpers.
 * Pure JS, no imports. Always returns the full set of badge definitions
 * so the UI can render both locked and unlocked states.
 */

/**
 * Master badge catalogue. Each entry declares the threshold that earns it.
 *
 * @type {Array<{
 *   id: string,
 *   label: string,
 *   emoji: string,
 *   check: (stats: { streak_count: number, bonus_stars: number }) => boolean
 * }>}
 */
const BADGE_DEFS = [
  // ── streak badges ─────────────────────────────────────────────────────────
  {
    id: 'streak_3',
    label: 'On a Roll',
    emoji: '🔥',
    check: ({ streak_count }) => streak_count >= 3,
  },
  {
    id: 'streak_7',
    label: 'Week Warrior',
    emoji: '⚡',
    check: ({ streak_count }) => streak_count >= 7,
  },
  {
    id: 'streak_30',
    label: 'Month Master',
    emoji: '🏆',
    check: ({ streak_count }) => streak_count >= 30,
  },
  // ── star badges ───────────────────────────────────────────────────────────
  {
    id: 'stars_10',
    label: 'Star Collector',
    emoji: '⭐',
    check: ({ bonus_stars }) => bonus_stars >= 10,
  },
  {
    id: 'stars_50',
    label: 'Star Hoarder',
    emoji: '🌟',
    check: ({ bonus_stars }) => bonus_stars >= 50,
  },
  {
    id: 'stars_100',
    label: 'Superstar',
    emoji: '💫',
    check: ({ bonus_stars }) => bonus_stars >= 100,
  },
];

/**
 * Derives all badge definitions with an `earned` boolean for the given member stats.
 *
 * @param {{ streak_count?: number, bonus_stars?: number }} stats
 * @returns {Array<{ id: string, label: string, emoji: string, earned: boolean }>}
 */
export function deriveBadges({ streak_count = 0, bonus_stars = 0 } = {}) {
  const stats = { streak_count, bonus_stars };
  return BADGE_DEFS.map(({ id, label, emoji, check }) => ({
    id,
    label,
    emoji,
    earned: check(stats),
  }));
}
