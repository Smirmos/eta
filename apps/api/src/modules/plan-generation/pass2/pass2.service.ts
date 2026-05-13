import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { weeklyDetailSchema, type MacroPlanWeek, type WeeklyDetail } from '@eta/shared-types';
import type { ZodIssue } from 'zod';
import type { Env } from '../../../config/env.schema.js';
import type { KnowledgeBaseLoader } from '../knowledge-base.loader.js';
import { buildKbSlice } from './pass2-context-builder.js';
import { buildPass2Prompt } from './pass2-prompt.js';
import {
  WeeklyDetailConstraintError,
  annotateWithComputedFields,
  computeWeeklySummary,
  extractAppliedSources,
  validateWeeklyDetailConstraints,
} from './pass2-postprocess.js';
import type { Pass2Input, Pass2Output } from './types.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class Pass2GenerationError extends Error {
  readonly rawResponse?: string;
  readonly validationIssues?: ZodIssue[];
  readonly constraintViolations?: string[];

  constructor(
    message: string,
    options: {
      cause?: unknown;
      rawResponse?: string;
      validationIssues?: ZodIssue[];
      constraintViolations?: string[];
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'Pass2GenerationError';
    this.rawResponse = options.rawResponse;
    this.validationIssues = options.validationIssues;
    this.constraintViolations = options.constraintViolations;
  }
}

export interface GenerateWeeklyDetailResult {
  output: Pass2Output;
  rawResponse: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

type AnthropicLike = Pick<Anthropic, 'messages'>;
type AnthropicFactory = (apiKey: string) => AnthropicLike;

const defaultAnthropicFactory: AnthropicFactory = (apiKey) =>
  new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

@Injectable()
export class Pass2GenerationService {
  private readonly logger = new Logger(Pass2GenerationService.name);
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

  async generateWeeklyDetail(input: Pass2Input): Promise<GenerateWeeklyDetailResult> {
    const targetWeek = this.resolveTargetWeek(input);
    const kbFull = this.kbLoader.get();
    const kb = buildKbSlice({ week: targetWeek, kb: kbFull });

    this.logger.log(
      `Pass 2: week ${targetWeek.weekNumber} (${targetWeek.weekStartDate}, ${targetWeek.phase}). ` +
        `KB slice: ${kb.totalChars} chars (down from ${kbFull.totalChars}).`,
    );

    const { system, user } = buildPass2Prompt({
      macroPlan: input.macroPlan,
      targetWeek,
      athleteProfile: input.athleteProfile,
      recentWorkouts: input.recentWorkouts,
      kb,
    });

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
      throw new Pass2GenerationError(`Anthropic API call failed: ${describeError(err)}`, {
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
      throw new Pass2GenerationError(`LLM response is not valid JSON: ${describeError(err)}`, {
        cause: err,
        rawResponse,
      });
    }

    const schemaResult = weeklyDetailSchema.safeParse(parsed);
    if (!schemaResult.success) {
      const truncated = rawResponse.slice(0, 2048);
      const issuesSummary = schemaResult.error.issues
        .slice(0, 5)
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      this.logger.error(
        `WeeklyDetail schema validation failed (${schemaResult.error.issues.length}):\n${issuesSummary}\n` +
          `Raw response (first 2KB): ${truncated}`,
      );
      throw new Pass2GenerationError(
        `WeeklyDetail schema validation failed (${schemaResult.error.issues.length} issue(s))`,
        { rawResponse, validationIssues: schemaResult.error.issues },
      );
    }

    const weeklyDetail: WeeklyDetail = schemaResult.data;

    try {
      validateWeeklyDetailConstraints({
        weeklyDetail,
        macroWeek: targetWeek,
        athleteProfile: input.athleteProfile,
      });
    } catch (err) {
      if (err instanceof WeeklyDetailConstraintError) {
        const summary = err.violations
          .slice(0, 5)
          .map((v) => `  - ${v}`)
          .join('\n');
        this.logger.error(
          `WeeklyDetail constraint check failed (${err.violations.length}):\n${summary}`,
        );
        throw new Pass2GenerationError(err.message, {
          rawResponse,
          constraintViolations: err.violations,
        });
      }
      throw err;
    }

    const summary = computeWeeklySummary({ weeklyDetail, macroWeek: targetWeek });
    const annotated = annotateWithComputedFields({ weeklyDetail, summary });
    const appliedSources = extractAppliedSources(annotated);

    return {
      output: {
        weeklyDetail: annotated,
        computed: summary,
        appliedSources,
      },
      rawResponse,
      usage,
      durationMs,
    };
  }

  private resolveTargetWeek(input: Pass2Input): MacroPlanWeek {
    const { macroPlan, targetWeekIndex } = input;
    if (targetWeekIndex < 0 || targetWeekIndex >= macroPlan.weeks.length) {
      throw new Pass2GenerationError(
        `targetWeekIndex ${targetWeekIndex} out of range (0..${macroPlan.weeks.length - 1})`,
      );
    }
    return macroPlan.weeks[targetWeekIndex] as MacroPlanWeek;
  }
}

function extractTextFromResponse(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
