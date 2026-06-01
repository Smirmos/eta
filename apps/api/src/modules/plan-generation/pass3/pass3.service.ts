import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { adaptationSuggestionSchema, type AdaptationSuggestion } from '@eta/shared-types';
import type { ZodIssue } from 'zod';
import type { Env } from '../../../config/env.schema.js';
import type { KnowledgeBaseLoader } from '../knowledge-base.loader.js';
import { buildPass3KbSlice, computePass3Inputs } from './pass3-context-builder.js';
import { buildPass3Prompt } from './pass3-prompt.js';
import {
  Pass3ConstraintError,
  extractAppliedSources,
  reconcileComputedInputs,
  validatePass3Suggestion,
} from './pass3-postprocess.js';
import type { Pass3Input, Pass3Output } from './types.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class Pass3GenerationError extends Error {
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
    this.name = 'Pass3GenerationError';
    this.rawResponse = options.rawResponse;
    this.validationIssues = options.validationIssues;
    this.constraintViolations = options.constraintViolations;
  }
}

export interface GenerateAdaptationResult {
  output: Pass3Output;
  rawResponse: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  durationMs: number;
}

export type AnthropicLike = Pick<Anthropic, 'beta'>;
export type AnthropicFactory = (apiKey: string) => AnthropicLike;

const defaultAnthropicFactory: AnthropicFactory = (apiKey) =>
  new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

@Injectable()
export class Pass3GenerationService {
  private readonly logger = new Logger(Pass3GenerationService.name);
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

  async generateAdaptation(input: Pass3Input): Promise<GenerateAdaptationResult> {
    const kbFull = this.kbLoader.get();
    const kb = buildPass3KbSlice({ phase: input.weeklyDraft.phase, kb: kbFull });

    const computed = computePass3Inputs({
      upcomingWeekStartDate: input.weeklyDraft.weekStartDate,
      completedLastWeek: input.completedLastWeek,
      readinessHistory: input.readinessHistory,
      seedDailyTss: input.seedDailyTss,
    });

    this.logger.log(
      `Pass 3: week starting ${input.weeklyDraft.weekStartDate} (${input.weeklyDraft.phase}). ` +
        `Inputs: lastWeekTss=${computed.lastWeekTss.toFixed(0)}, ctl=${computed.currentCtl.toFixed(1)}, ` +
        `atl=${computed.currentAtl.toFixed(1)}, tsb=${computed.currentTsb.toFixed(1)}, ` +
        `readiness=${computed.avgReadinessLast7d}. KB slice: ${kb.totalChars} chars.`,
    );

    const { system, userStatic, userDynamic } = buildPass3Prompt({
      weeklyDraft: input.weeklyDraft,
      completedLastWeek: input.completedLastWeek,
      computed,
      hardRuleOutput: input.hardRuleOutput,
      athleteProfile: input.athleteProfile,
      kb,
    });

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
      throw new Pass3GenerationError(`Anthropic API call failed: ${describeError(err)}`, {
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
      throw new Pass3GenerationError(`LLM response is not valid JSON: ${describeError(err)}`, {
        cause: err,
        rawResponse,
      });
    }

    const schemaResult = adaptationSuggestionSchema.safeParse(parsed);
    if (!schemaResult.success) {
      const truncated = rawResponse.slice(0, 2048);
      const issuesSummary = schemaResult.error.issues
        .slice(0, 5)
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n');
      this.logger.error(
        `AdaptationSuggestion schema validation failed (${schemaResult.error.issues.length}):\n${issuesSummary}\n` +
          `Raw response (first 2KB): ${truncated}`,
      );
      throw new Pass3GenerationError(
        `AdaptationSuggestion schema validation failed (${schemaResult.error.issues.length} issue(s))`,
        { rawResponse, validationIssues: schemaResult.error.issues },
      );
    }

    let suggestion: AdaptationSuggestion = schemaResult.data;

    try {
      validatePass3Suggestion({
        suggestion,
        weeklyDraft: input.weeklyDraft,
        athleteProfile: input.athleteProfile,
      });
    } catch (err) {
      if (err instanceof Pass3ConstraintError) {
        const summary = err.violations
          .slice(0, 5)
          .map((v) => `  - ${v}`)
          .join('\n');
        this.logger.error(
          `Pass 3 constraint check failed (${err.violations.length}):\n${summary}`,
        );
        throw new Pass3GenerationError(err.message, {
          rawResponse,
          constraintViolations: err.violations,
        });
      }
      throw err;
    }

    const reconciled = reconcileComputedInputs({ suggestion, computed });
    suggestion = reconciled.suggestion;
    if (reconciled.driftedFields.length > 0) {
      this.logger.warn(
        `Pass 3 echoed inputs drifted from computed (${reconciled.driftedFields.length} field(s)) — overwriting with computed values:\n  - ${reconciled.driftedFields.join('\n  - ')}`,
      );
    }

    const appliedSources = extractAppliedSources(suggestion);

    return {
      output: {
        suggestion,
        computed,
        appliedSources,
      },
      rawResponse,
      usage,
      durationMs,
    };
  }
}

function extractTextFromResponse(response: Anthropic.Beta.Messages.BetaMessage): string {
  return response.content
    .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
