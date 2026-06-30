import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  weeklyDetailSchema, type AthleteProfile, type NextWeekFrame, type TrainingAnalysis, type WeeklyDetail,
} from '@eta/shared-types';
import type { ZodIssue } from 'zod';
import type { Env } from '../../config/env.schema.js';
import type { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { buildKbSlice } from '../plan-generation/pass2/pass2-context-builder.js';
import {
  WeeklyDetailConstraintError, annotateWithComputedFields, computeWeeklySummary,
  extractAppliedSources, validateWeeklyDetailConstraints,
} from '../plan-generation/pass2/pass2-postprocess.js';
import { buildNextWeekFrame, frameToMacroPlanWeek } from './next-week-frame.builder.js';
import { NextWeekGuardError, validateNextWeekVolume } from './next-week-postprocess.js';
import { buildNextWeekPrompt } from './next-week-prompt.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class NextWeekGenerationError extends Error {
  readonly violations?: string[];
  readonly validationIssues?: ZodIssue[];
  constructor(message: string, options: { cause?: unknown; violations?: string[]; validationIssues?: ZodIssue[] } = {}) {
    super(message, { cause: options.cause });
    this.name = 'NextWeekGenerationError';
    this.violations = options.violations;
    this.validationIssues = options.validationIssues;
  }
}

type AnthropicLike = Pick<Anthropic, 'messages'>;
type AnthropicFactory = (apiKey: string) => AnthropicLike;
const defaultAnthropicFactory: AnthropicFactory = (apiKey) => new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

export class NextWeekGenerationService {
  private readonly logger = new Logger(NextWeekGenerationService.name);
  private readonly client: AnthropicLike;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    this.client = anthropicFactory(config.get('ANTHROPIC_API_KEY', { infer: true }));
    this.model = config.get('ANTHROPIC_MODEL', { infer: true });
    this.maxTokens = config.get('ANTHROPIC_MAX_TOKENS', { infer: true });
  }

  async generate(input: { profile: AthleteProfile; analysis: TrainingAnalysis; asOf?: Date }): Promise<{
    frame: NextWeekFrame; weeklyDetail: WeeklyDetail; appliedSources: string[];
  }> {
    const frame = buildNextWeekFrame(input.profile, input.analysis, input.asOf ?? new Date());
    const macroWeek = frameToMacroPlanWeek(frame);
    const kb = buildKbSlice({ week: macroWeek, kb: this.kbLoader.get() });
    const { system, user } = buildNextWeekPrompt({ frame, analysis: input.analysis, profile: input.profile, kb });

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model, max_tokens: this.maxTokens, system, messages: [{ role: 'user', content: user }],
      });
    } catch (err) {
      throw new NextWeekGenerationError(`Anthropic API call failed: ${describe(err)}`, { cause: err });
    }

    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new NextWeekGenerationError(`LLM response is not valid JSON: ${describe(err)}`, { cause: err });
    }

    const schema = weeklyDetailSchema.safeParse(parsed);
    if (!schema.success) {
      throw new NextWeekGenerationError(
        `WeeklyDetail schema validation failed (${schema.error.issues.length} issue(s))`,
        { validationIssues: schema.error.issues },
      );
    }
    const weeklyDetail: WeeklyDetail = schema.data;

    try {
      validateWeeklyDetailConstraints({ weeklyDetail, macroWeek, athleteProfile: input.profile });
      validateNextWeekVolume(weeklyDetail, frame);
    } catch (err) {
      if (err instanceof WeeklyDetailConstraintError || err instanceof NextWeekGuardError) {
        throw new NextWeekGenerationError(err.message, { violations: err.violations });
      }
      throw err;
    }

    const summary = computeWeeklySummary({ weeklyDetail, macroWeek });
    const annotated = annotateWithComputedFields({ weeklyDetail, summary });
    this.logger.log(`Next-week generated: ${frame.phase}, ${summary.totalWeeklyHours}h, ${weeklyDetail.workouts.length} workouts.`);
    return { frame, weeklyDetail: annotated, appliedSources: extractAppliedSources(annotated) };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
