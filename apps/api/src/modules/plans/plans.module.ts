import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [DbModule],
  controllers: [PlansController],
  providers: [
    MacroPlansRepository,
    WeeklyDetailsRepository,
    AdaptationsRepository,
    PlansService,
  ],
  exports: [PlansService, MacroPlansRepository, WeeklyDetailsRepository, AdaptationsRepository],
})
export class PlansModule {}
