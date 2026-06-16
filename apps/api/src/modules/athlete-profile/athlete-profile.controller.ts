import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AthleteProfile, athleteProfileSchema } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';
import { AthleteProfileService } from './athlete-profile.service.js';

interface CreateProfileResponse {
  id: string;
  userId: string;
  generatedAt: string;
  updatedAt: string;
}

@Controller('athlete-profiles')
export class AthleteProfileController {
  constructor(
    private readonly service: AthleteProfileService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown): Promise<CreateProfileResponse> {
    const parsed = athleteProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_profile',
        issues: parsed.error.issues,
      });
    }
    const userId = this.getCurrentUserId();
    const record = await this.service.create({ userId, profile: parsed.data });
    return {
      id: record.id,
      userId: record.userId,
      generatedAt: record.generatedAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  @Get('me')
  async getMe(): Promise<AthleteProfile> {
    const userId = this.getCurrentUserId();
    const profile = await this.service.getLatestFor(userId);
    if (!profile) {
      throw new NotFoundException({ error: 'no_profile_for_user', userId });
    }
    return profile;
  }

  private getCurrentUserId(): string {
    return this.config.get('DEV_USER_ID', { infer: true });
  }
}
