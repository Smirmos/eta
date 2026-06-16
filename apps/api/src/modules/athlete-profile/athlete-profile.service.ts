import { Injectable, Logger } from '@nestjs/common';
import type { AthleteProfile } from '@eta/shared-types';
import {
  AthleteProfileRepository,
  type AthleteProfileRecord,
} from '../../db/repositories/athlete-profile.repository.js';
import { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';

@Injectable()
export class AthleteProfileService {
  private readonly logger = new Logger(AthleteProfileService.name);

  constructor(
    private readonly repo: AthleteProfileRepository,
    private readonly renormalize: StravaRenormalizeService,
  ) {}

  async create(input: { userId: string; profile: AthleteProfile }): Promise<AthleteProfileRecord> {
    const record = await this.repo.create(input);
    setImmediate(() => {
      this.renormalize.run(input.userId).catch((err: unknown) => {
        const detail = err instanceof Error ? err.stack ?? err.message : String(err);
        this.logger.error(`Background renormalize failed for ${input.userId}: ${detail}`);
      });
    });
    return record;
  }

  async getLatestFor(userId: string): Promise<AthleteProfile | null> {
    return this.repo.findByUserId(userId);
  }
}
