import type { PlanTreeWeek } from '../api/plan-tree.types.js';

export function indexOfCurrentWeek(weeks: PlanTreeWeek[], today: Date): number {
  if (weeks.length === 0) return -1;
  const todayMs = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    const startMs = Date.parse(`${w.macroWeek.weekStartDate}T00:00:00Z`);
    if (todayMs >= startMs && todayMs < startMs + 7 * 86_400_000) return i;
  }
  return weeks.length - 1;
}
