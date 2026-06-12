// Effective star worth of a chore: base worth minus 1 star per rejection (never below 0)
export function getStarWorth(task) {
  return Math.max(0, (task.stars ?? 1) - (task.stars_penalty ?? 0));
}