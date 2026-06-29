import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { PlansService, type PlanTree } from './plans.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('plans')
export class PlansController {
  constructor(
    private readonly service: PlansService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // NOTE: /plans/me must be declared BEFORE /plans/:id in source order so the
  // literal route wins over the param route in Nest+Fastify's matcher.
  @Get('me')
  async getMe(): Promise<PlanTree> {
    const userId = this.getCurrentUserId();
    const tree = await this.service.getLatestTreeForUser(userId);
    if (!tree) throw new NotFoundException({ error: 'no_plan_for_user', userId });
    return tree;
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<PlanTree> {
    if (!UUID_RE.test(id)) throw new BadRequestException({ error: 'invalid_id', id });
    const tree = await this.service.getTreeById(id);
    if (!tree) throw new NotFoundException({ error: 'plan_not_found', id });
    return tree;
  }

  private getCurrentUserId(): string {
    return this.config.get('DEV_USER_ID', { infer: true });
  }
}
