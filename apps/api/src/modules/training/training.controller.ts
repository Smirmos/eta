import { Controller, Get } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import type { TrainingAnalysisResponse } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TrainingAnalysisService } from './training-analysis.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TrainingNarrativeService } from './training-narrative.service.js';

@Controller('training')
export class TrainingController {
  constructor(
    private readonly analysis: TrainingAnalysisService,
    private readonly narrative: TrainingNarrativeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('analysis')
  async getAnalysis(): Promise<TrainingAnalysisResponse> {
    const userId = this.config.get('DEV_USER_ID', { infer: true });
    const analysis = await this.analysis.analyze(userId);
    const narrative = await this.narrative.summarize(analysis);
    return { ...analysis, narrative };
  }
}
