import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { DbModule } from '../../db/db.module.js';
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';
import { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { NextWeekGenerationService } from './next-week-generation.service.js';
import { TrainingAnalysisService } from './training-analysis.service.js';
import { TrainingNarrativeService } from './training-narrative.service.js';
import { TrainingController } from './training.controller.js';

@Module({
  imports: [DbModule],
  controllers: [TrainingController],
  providers: [
    WorkoutsCompletedRepository,
    AthleteProfileRepository,
    KnowledgeBaseLoader,
    {
      provide: TrainingAnalysisService,
      inject: [WorkoutsCompletedRepository],
      useFactory: (workoutsRepo: WorkoutsCompletedRepository): TrainingAnalysisService =>
        new TrainingAnalysisService(workoutsRepo),
    },
    {
      provide: TrainingNarrativeService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): TrainingNarrativeService =>
        new TrainingNarrativeService(config),
    },
    {
      provide: NextWeekGenerationService,
      inject: [ConfigService, KnowledgeBaseLoader],
      useFactory: (config: ConfigService<Env, true>, kb: KnowledgeBaseLoader): NextWeekGenerationService =>
        new NextWeekGenerationService(config, kb),
    },
  ],
})
export class TrainingModule {}
