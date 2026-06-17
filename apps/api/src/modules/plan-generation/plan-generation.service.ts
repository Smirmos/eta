import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  type AthleteProfile,
  type MacroPlan,
  athleteProfileInputSchema,
  macroPlanSchema,
} from '@eta/shared-types';
import type { ZodIssue } from 'zod';
import type { Env } from '../../config/env.schema.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
import type { KnowledgeBaseLoader } from './knowledge-base.loader.js';
import { buildMacroPlanPrompt } from './prompts/macro-plan.prompt.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export interface GenerateMacroPlanResult {
  plan: MacroPlan;
  rawResponse: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    /** Tokens written to the prompt cache on this call (billed at 1.25×). */
    cacheCreationInputTokens: number;
    /** Tokens read from the prompt cache on this call (billed at 0.1×). */
    cacheReadInputTokens: number;
  };
  durationMs: number;
  macroPlanId: string;
}

export class PlanGenerationError extends Error {
  readonly rawResponse?: string;
  readonly validationIssues?: ZodIssue[];
  readonly violations?: string[];

  constructor(
    message: string,
    options: {
      cause?: unknown;
      rawResponse?: string;
      validationIssues?: ZodIssue[];
      violations?: string[];
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'PlanGenerationError';
    this.rawResponse = options.rawResponse;
    this.validationIssues = options.validationIssues;
    this.violations = options.violations;
  }
}

// Canonical long-session codes per knowledge-base/03-workouts.md:
//   C/AE2  Aerobic Endurance (bike) — the long ride
//   D/AE2  Aerobic Endurance (run) — the long run
//   E/AE   matches E/AE1 (Aerobic Endurance Brick) — the long brick
// The earlier B/E2 / C/E2 / D/E2 entries were fabrications; the real
// codes use the "AE" prefix. The earlier rationale-text regex (/\blong\b/)
// was removed because it caused false positives on workouts whose KB name
// contains "Long" (e.g., B/ME1 "Long Cruise Intervals" — a threshold-pace
// interval workout, NOT a long-session breakthrough).
const LONG_SESSION_CODE_PREFIXES: readonly string[] = ['C/AE2', 'D/AE2', 'E/AE'];

export function isLongSessionWorkout(workoutCode: string): boolean {
  return LONG_SESSION_CODE_PREFIXES.some((p) => workoutCode.startsWith(p));
}

export function validateDayConstraints(plan: MacroPlan, profile: AthleteProfile): void {
  const violations: string[] = [];

  for (const week of plan.weeks) {
    for (const session of week.keySessions) {
      if (
        isLongSessionWorkout(session.workoutCode) &&
        !profile.longSessionDays.includes(session.dayOfWeek)
      ) {
        violations.push(
          `Week ${week.weekNumber}: ${session.workoutCode} is a long session on ` +
            `${session.dayOfWeek}, but profile only allows long sessions on ` +
            `[${profile.longSessionDays.join(', ')}]`,
        );
      }
      if (profile.mandatoryRestDays.includes(session.dayOfWeek)) {
        violations.push(
          `Week ${week.weekNumber}: ${session.workoutCode} on ${session.dayOfWeek}, ` +
            `but ${session.dayOfWeek} is a mandatoryRestDay`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new PlanGenerationError(`Day-of-week constraint violations (${violations.length})`, {
      violations,
    });
  }
}

export type AnthropicLike = Pick<Anthropic, 'beta'>;
export type AnthropicFactory = (apiKey: string) => AnthropicLike;

const defaultAnthropicFactory: AnthropicFactory = (apiKey) =>
  new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

@Injectable()
export class PlanGenerationService {
  private readonly logger = new Logger(PlanGenerationService.name);
  private readonly client: AnthropicLike;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    private readonly macroPlansRepo: MacroPlansRepository,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    this.client = anthropicFactory(apiKey);
    this.model = this.config.get('ANTHROPIC_MODEL', { infer: true });
    this.maxTokens = this.config.get('ANTHROPIC_MAX_TOKENS', { infer: true });
  }

  async generateMacroPlan(
    rawProfile: unknown,
    athleteProfileId: string,
    userId: string,
  ): Promise<GenerateMacroPlanResult> {
    const profile = this.validateProfile(rawProfile);
    const kb = this.kbLoader.get();
    const { system, userStatic, userDynamic } = buildMacroPlanPrompt({
      profile,
      athleteProfileId,
      kb,
    });

    this.logger.log(`Calling Anthropic API (model=${this.model}, max_tokens=${this.maxTokens})...`);

    // Prompt caching: the system block (~10K tokens of methodology) and the
    // userStatic block (~80K tokens of interface + KB) never vary between
    // calls. Marking both with ephemeral cache_control creates two cache
    // breakpoints, giving ~90% input-cost reduction on cache hits (5-min TTL).
    // SDK 0.32 surfaces cache_control via the beta.messages namespace.
    const start = Date.now();
    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userStatic, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: userDynamic },
            ],
          },
        ],
      });
    } catch (err) {
      throw new PlanGenerationError(`Anthropic API call failed: ${describeError(err)}`, {
        cause: err,
      });
    }
    const durationMs = Date.now() - start;

    const rawResponse = extractTextFromResponse(response);
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (err) {
      throw new PlanGenerationError(`LLM response is not valid JSON: ${describeError(err)}`, {
        cause: err,
        rawResponse,
      });
    }

    const result = macroPlanSchema.safeParse(parsed);
    if (!result.success) {
      const truncatedRaw = rawResponse.slice(0, 2048);
      const issuesSummary = result.error.issues
        .slice(0, 5)
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      this.logger.error(
        `MacroPlan schema validation failed (${result.error.issues.length} issue(s)):\n${issuesSummary}\n` +
          `Raw response (first 2KB): ${truncatedRaw}`,
      );
      throw new PlanGenerationError(
        `MacroPlan schema validation failed (${result.error.issues.length} issue(s))`,
        { rawResponse, validationIssues: result.error.issues },
      );
    }

    try {
      validateDayConstraints(result.data, profile);
    } catch (err) {
      if (err instanceof PlanGenerationError && err.violations) {
        const summary = err.violations
          .slice(0, 5)
          .map((v) => `  - ${v}`)
          .join('\n');
        this.logger.error(
          `Day-of-week constraint check failed (${err.violations.length} violation(s)):\n${summary}`,
        );
        throw new PlanGenerationError(err.message, {
          rawResponse,
          violations: err.violations,
        });
      }
      throw err;
    }

    const record = await this.macroPlansRepo.create({
      userId,
      athleteProfileId,
      plan: result.data,
    });
    this.logger.log(`Persisted macro plan ${record.id} for user ${userId}.`);

    return {
      plan: result.data,
      rawResponse,
      usage,
      durationMs,
      macroPlanId: record.id,
    };
  }

  private validateProfile(raw: unknown): AthleteProfile {
    const parsed = athleteProfileInputSchema.safeParse(raw);
    if (!parsed.success) {
      const summary = parsed.error.issues
        .slice(0, 5)
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      throw new PlanGenerationError(`AthleteProfile failed input validation:\n${summary}`, {
        validationIssues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}

function extractTextFromResponse(response: Anthropic.Beta.Messages.BetaMessage): string {
  const text = response.content
    .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return text;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
