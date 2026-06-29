import { Injectable } from '@nestjs/common';
import type { Discipline, TrainingAnalysis, TrendDirection, WeekBucket } from '@eta/shared-types';
import { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run'];
const round1 = (n: number): number => Math.round(n * 10) / 10;
const addDaysIso = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

interface AnalysisRow {
  date: string;
  discipline: string;
  actualDurationSeconds: number | null;
  actualTss: string | null;
}

function emptyAnalysis(): TrainingAnalysis {
  return {
    hasData: false,
    window: null,
    overall: {
      totalSessions: 0,
      totalHours: 0,
      trainingDays: 0,
      avgSessionsPerWeek: 0,
      avgTrainingDaysPerWeek: 0,
      sportSplit: [],
    },
    perWeek: [],
    trend: 'steady',
    longestSessions: [],
    dataNote: { tssCoverage: 'bike_only', staleDays: 0 },
  };
}

@Injectable()
export class TrainingAnalysisService {
  constructor(private readonly workoutsRepo: WorkoutsCompletedRepository) {}

  async analyze(userId: string, today: Date = new Date()): Promise<TrainingAnalysis> {
    const todayIso = today.toISOString().slice(0, 10);
    const all = (await this.workoutsRepo.findByUserAndDateRange(
      userId,
      '1970-01-01',
      todayIso,
    )) as unknown as AnalysisRow[];
    if (all.length === 0) return emptyAnalysis();

    const asOf = all.reduce((max, r) => (r.date > max ? r.date : max), all[0]!.date);
    const from = addDaysIso(asOf, -27);
    const rows = all.filter((r) => r.date >= from && r.date <= asOf);
    if (rows.length === 0) return emptyAnalysis();

    const hours = (r: AnalysisRow): number => (r.actualDurationSeconds ?? 0) / 3600;

    // 4 rolling 7-day buckets counting back from asOf; index 0 = oldest.
    const buckets: WeekBucket[] = [];
    for (let b = 3; b >= 0; b -= 1) {
      const end = addDaysIso(asOf, -7 * b);
      const start = addDaysIso(end, -6);
      const inBucket = rows.filter((r) => r.date >= start && r.date <= end);
      const byDiscipline: WeekBucket['byDiscipline'] = {};
      for (const d of DISCIPLINES) {
        const ds = inBucket.filter((r) => r.discipline === d);
        if (ds.length > 0) {
          byDiscipline[d] = { sessions: ds.length, hours: round1(ds.reduce((s, r) => s + hours(r), 0)) };
        }
      }
      const bikeTssRows = inBucket.filter((r) => r.discipline === 'bike' && r.actualTss != null);
      buckets.push({
        weekStart: start,
        sessions: inBucket.length,
        hours: round1(inBucket.reduce((s, r) => s + hours(r), 0)),
        byDiscipline,
        bikeTss: bikeTssRows.length > 0 ? round1(bikeTssRows.reduce((s, r) => s + parseFloat(r.actualTss as string), 0)) : null,
      });
    }

    const totalHours = rows.reduce((s, r) => s + hours(r), 0);
    const sportSplit = DISCIPLINES.map((d) => {
      const ds = rows.filter((r) => r.discipline === d);
      const h = ds.reduce((s, r) => s + hours(r), 0);
      return {
        discipline: d,
        sessions: ds.length,
        hours: round1(h),
        pctHours: totalHours > 0 ? Math.round((h / totalHours) * 100) : 0,
      };
    }).filter((s) => s.sessions > 0);

    const trainingDays = new Set(rows.map((r) => r.date)).size;

    const longestSessions = DISCIPLINES.flatMap((d) => {
      const ds = rows.filter((r) => r.discipline === d);
      if (ds.length === 0) return [];
      const longest = ds.reduce((max, r) =>
        (r.actualDurationSeconds ?? 0) > (max.actualDurationSeconds ?? 0) ? r : max,
      );
      return [{ discipline: d, date: longest.date, minutes: Math.round((longest.actualDurationSeconds ?? 0) / 60) }];
    });

    const recent = buckets[buckets.length - 1]!.hours;
    const prior = buckets.slice(0, -1).filter((b) => b.hours > 0);
    const priorMean = prior.length > 0 ? prior.reduce((s, b) => s + b.hours, 0) / prior.length : 0;
    let trend: TrendDirection = 'steady';
    if (priorMean > 0) {
      const ratio = recent / priorMean;
      trend = ratio > 1.1 ? 'building' : ratio < 0.9 ? 'tapering' : 'steady';
    }

    return {
      hasData: true,
      window: { from, asOf },
      overall: {
        totalSessions: rows.length,
        totalHours: round1(totalHours),
        trainingDays,
        avgSessionsPerWeek: round1(rows.length / 4),
        avgTrainingDaysPerWeek: round1(trainingDays / 4),
        sportSplit,
      },
      perWeek: buckets,
      trend,
      longestSessions,
      dataNote: { tssCoverage: 'bike_only', staleDays: Math.max(0, daysBetween(asOf, todayIso)) },
    };
  }
}
