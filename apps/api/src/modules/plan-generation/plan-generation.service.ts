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
import type { KnowledgeBaseLoader } from './knowledge-base.loader.js';
import { buildMacroPlanPrompt } from './prompts/macro-plan.prompt.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export interface GenerateMacroPlanResult {
  plan: MacroPlan;
  rawResponse: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
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

// Heuristic: workout codes that represent breakthrough endurance sessions
// (long ride, long run, long aerobic brick). These MUST land on a
// longSessionDay per the athlete's profile. Add codes here as the KB
// taxonomy grows; refine in a follow-up if the heuristic produces false
// positives/negatives in real plans.
const LONG_SESSION_CODE_PREFIXES: readonly string[] = [
  'B/E2',
  'C/E2',
  'D/E2',
  'C/AE2',
  'D/AE2',
  'E/AE',
];

export function isLongSessionWorkout(workoutCode: string, rationale = ''): boolean {
  if (LONG_SESSION_CODE_PREFIXES.some((p) => workoutCode.startsWith(p))) return true;
  // Catch LLM rationale phrasing for explicitly "long" sessions even if the
  // code prefix list misses them.
  return /\blong\b/i.test(rationale);
}

export function validateDayConstraints(plan: MacroPlan, profile: AthleteProfile): void {
  const violations: string[] = [];

  for (const week of plan.weeks) {
    for (const session of week.keySessions) {
      if (
        isLongSessionWorkout(session.workoutCode, session.rationale) &&
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

export type AnthropicLike = Pick<Anthropic, 'messages'>;
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
  ): Promise<GenerateMacroPlanResult> {
    const profile = this.validateProfile(rawProfile);
    const kb = this.kbLoader.get();
    const { system, user } = buildMacroPlanPrompt({
      profile,
      athleteProfileId,
      kb,
    });

    this.logger.log(`Calling Anthropic API (model=${this.model}, max_tokens=${this.maxTokens})...`);

    const start = Date.now();
    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
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

    return {
      plan: result.data,
      rawResponse,
      usage,
      durationMs,
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

function extractTextFromResponse(response: Anthropic.Messages.Message): string {
  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return text;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
