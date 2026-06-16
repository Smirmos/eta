import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';
import { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';
import { AthleteProfileController } from './athlete-profile.controller.js';
import { AthleteProfileService } from './athlete-profile.service.js';

@Module({
  imports: [DbModule],
  controllers: [AthleteProfileController],
  providers: [
    AthleteProfileRepository,
    WorkoutsCompletedRepository,
    StravaRenormalizeService,
    AthleteProfileService,
  ],
  exports: [AthleteProfileService, StravaRenormalizeService],
})
export class AthleteProfileModule {}
