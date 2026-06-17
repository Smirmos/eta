import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { DbModule } from '../../db/db.module.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
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
      inject: [ConfigService, KnowledgeBaseLoader],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
      ): Pass2GenerationService => new Pass2GenerationService(config, kbLoader),
    },
    {
      provide: Pass3GenerationService,
      inject: [ConfigService, KnowledgeBaseLoader],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
      ): Pass3GenerationService => new Pass3GenerationService(config, kbLoader),
    },
  ],
  exports: [PlanGenerationService, Pass2GenerationService, Pass3GenerationService],
})
export class PlanGenerationModule {}
