import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';
import type { TrainingAnalysis } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';

interface AnthropicLike {
  messages: { create: (args: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> };
}

@Injectable()
export class TrainingNarrativeService {
  private readonly client: AnthropicLike;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>, client?: AnthropicLike) {
    this.model = config.get('ANTHROPIC_MODEL', { infer: true });
    this.client =
      client ?? (new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }) }) as unknown as AnthropicLike);
  }

  async summarize(analysis: TrainingAnalysis): Promise<string | null> {
    if (!analysis.hasData) return null;
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content:
              'Write ONE short paragraph (<=4 sentences) summarizing this endurance athlete’s last 4 weeks for the athlete to read. ' +
              'Cover consistency, sport balance, and the load trend. Be concrete and encouraging, no markdown. Data:\n' +
              JSON.stringify(analysis),
          },
        ],
      });
      const text = res.content.find((c) => c.type === 'text')?.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }
}
