import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { DbModule } from '../../db/db.module.js';
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { KnowledgeBaseLoader } from './knowledge-base.loader.js';
import { Pass2GenerationService } from './pass2/pass2.service.js';
import { Pass3GenerationService } from './pass3/pass3.service.js';
import { PlanGenerationService } from './plan-generation.service.js';

// Both providers use useFactory rather than relying on TS decorator metadata
// for constructor injection — this lets the corresponding source files keep
// type-only imports of ConfigService / KnowledgeBaseLoader without breaking
// Nest's design:paramtypes-based DI.
@Module({
  imports: [DbModule],
  providers: [
    MacroPlansRepository,
    WeeklyDetailsRepository,
    AdaptationsRepository,
    {
      provide: KnowledgeBaseLoader,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): KnowledgeBaseLoader =>
        new KnowledgeBaseLoader(config),
    },
    {
      provide: PlanGenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, MacroPlansRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        macroPlansRepo: MacroPlansRepository,
      ): PlanGenerationService => new PlanGenerationService(config, kbLoader, macroPlansRepo),
    },
    {
      provide: Pass2GenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, WeeklyDetailsRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        weeklyRepo: WeeklyDetailsRepository,
      ): Pass2GenerationService => new Pass2GenerationService(config, kbLoader, weeklyRepo),
    },
    {
      provide: Pass3GenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, AdaptationsRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        adaptationsRepo: AdaptationsRepository,
      ): Pass3GenerationService => new Pass3GenerationService(config, kbLoader, adaptationsRepo),
    },
  ],
  exports: [PlanGenerationService, Pass2GenerationService, Pass3GenerationService],
})
export class PlanGenerationModule {}
