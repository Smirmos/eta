import type { Discipline, NextWeekFrame, PlannedWorkout } from '@eta/shared-types';

export interface DisciplineGroup {
  discipline: Discipline;
  totalSeconds: number;
  sessionCount: number;
  sessions: PlannedWorkout[];
}

const ORDER: Discipline[] = ['swim', 'bike', 'run'];
const LONG_NOUN: Record<Discipline, string> = { swim: 'Long swim', bike: 'Long ride', run: 'Long run' };
const MS_PER_DAY = 86_400_000;

export function groupByDiscipline(workouts: PlannedWorkout[]): DisciplineGroup[] {
  return ORDER.map((discipline) => {
    const sessions = workouts.filter((w) => w.discipline === discipline);
    return {
      discipline,
      sessions,
      sessionCount: sessions.length,
      totalSeconds: sessions.reduce((sum, w) => sum + w.totalDurationSeconds, 0),
    };
  }).filter((g) => g.sessionCount > 0);
}

export function sessionType(workout: PlannedWorkout, frame: NextWeekFrame): string {
  const index = Math.round((Date.parse(workout.date) - Date.parse(frame.weekStartDate)) / MS_PER_DAY);
  const day = index >= 0 && index < frame.days.length ? frame.days[index] : undefined;
  if (!day) return workout.workoutCode;
  switch (day.role) {
    case 'long': return LONG_NOUN[workout.discipline];
    case 'quality': return 'Threshold / quality';
    case 'aerobic': return 'Aerobic';
    case 'recovery': return 'Recovery';
    default: return workout.workoutCode; // 'rest' — no workout expected
  }
}

export function formatHours(totalSeconds: number): string {
  const rounded = Math.round((totalSeconds / 3600) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}
