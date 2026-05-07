import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { KnowledgeBaseLoader } from './knowledge-base.loader.js';
import { PlanGenerationService } from './plan-generation.service.js';

@Module({
  providers: [
    KnowledgeBaseLoader,
    {
      provide: PlanGenerationService,
      inject: [ConfigService, KnowledgeBaseLoader],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
      ): PlanGenerationService => new PlanGenerationService(config, kbLoader),
    },
  ],
  exports: [PlanGenerationService],
})
export class PlanGenerationModule {}
