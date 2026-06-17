import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type { PlanTree } from './plans.service.js';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeConfig(): ConfigService<Env, true> {
  return {
    get: (k: string) => (k === 'DEV_USER_ID' ? USER_ID : undefined),
  } as unknown as ConfigService<Env, true>;
}

function makeService(opts: { latest?: PlanTree | null; byId?: PlanTree | null }): PlansService {
  return {
    getLatestTreeForUser: vi.fn(async () => opts.latest ?? null),
    getTreeById: vi.fn(async () => opts.byId ?? null),
  } as unknown as PlansService;
}

const sampleTree = (): PlanTree => ({
  macroPlanId: 'macro-plan-id-1',
  athleteProfileId: 'profile-id-1',
  macroPlan: {
    athleteProfileId: 'profile-id-1',
    raceDate: '2026-09-21',
    generatedAt: '2026-06-17T12:00:00Z',
    totalWeeks: 0,
    weeks: [],
  },
  generatedAt: new Date('2026-06-17T12:00:00Z'),
  weeks: [],
});

describe('PlansController', () => {
  it('GET /me returns the latest tree', async () => {
    const tree = sampleTree();
    const ctrl = new PlansController(makeService({ latest: tree }), makeConfig());
    const out = await ctrl.getMe();
    expect(out).toBe(tree);
  });

  it('GET /me throws NotFoundException when no plan exists', async () => {
    const ctrl = new PlansController(makeService({ latest: null }), makeConfig());
    await expect(ctrl.getMe()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /:id returns the tree', async () => {
    const tree = sampleTree();
    const ctrl = new PlansController(makeService({ byId: tree }), makeConfig());
    const out = await ctrl.getById('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(out).toBe(tree);
  });

  it('GET /:id throws NotFoundException when not found', async () => {
    const ctrl = new PlansController(makeService({ byId: null }), makeConfig());
    await expect(ctrl.getById('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('GET /:id throws BadRequestException when id is not a uuid', async () => {
    const ctrl = new PlansController(makeService({}), makeConfig());
    await expect(ctrl.getById('not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
  });
});
