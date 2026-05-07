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

  constructor(
    message: string,
    options: {
      cause?: unknown;
      rawResponse?: string;
      validationIssues?: ZodIssue[];
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'PlanGenerationError';
    this.rawResponse = options.rawResponse;
    this.validationIssues = options.validationIssues;
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
