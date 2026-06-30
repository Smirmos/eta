import { Controller, Get } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import type { NextWeekResponse, TrainingAnalysisResponse } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TrainingAnalysisService } from './training-analysis.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TrainingNarrativeService } from './training-narrative.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NextWeekGenerationService } from './next-week-generation.service.js';

@Controller('training')
export class TrainingController {
  constructor(
    private readonly analysis: TrainingAnalysisService,
    private readonly narrative: TrainingNarrativeService,
    private readonly config: ConfigService<Env, true>,
    private readonly nextWeek: NextWeekGenerationService,
    private readonly profileRepo: AthleteProfileRepository,
  ) {}

  @Get('analysis')
  async getAnalysis(): Promise<TrainingAnalysisResponse> {
    const userId = this.config.get('DEV_USER_ID', { infer: true });
    const analysis = await this.analysis.analyze(userId);
    const narrative = await this.narrative.summarize(analysis);
    return { ...analysis, narrative };
  }

  @Get('next-week')
  async getNextWeek(): Promise<NextWeekResponse> {
    const userId = this.config.get('DEV_USER_ID', { infer: true });
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return { status: 'needs_profile' };
    const analysis = await this.analysis.analyze(userId);
    if (!analysis.hasData || !analysis.window) return { status: 'needs_history' };
    try {
      const { frame, weeklyDetail } = await this.nextWeek.generate({ profile, analysis });
      return { status: 'ok', frame, weeklyDetail };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  }
}
