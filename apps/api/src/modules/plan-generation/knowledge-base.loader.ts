import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';

export interface KnowledgeBase {
  zones: string;
  atpStructure: string;
  workouts: string;
  weeklyTemplates: string;
  recovery: string;
  totalChars: number;
  loadedFrom: string;
}

const KB_FILES = [
  { key: 'zones', file: '01-zones.md' },
  { key: 'atpStructure', file: '02-atp-structure.md' },
  { key: 'workouts', file: '03-workouts.md' },
  { key: 'weeklyTemplates', file: '04-weekly-templates.md' },
  { key: 'recovery', file: '05-recovery.md' },
] as const;

@Injectable()
export class KnowledgeBaseLoader implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeBaseLoader.name);
  private cached: KnowledgeBase | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.cached = this.load();
    this.logger.log(
      `Loaded KB: ${this.cached.totalChars} chars from ${this.cached.loadedFrom} ` +
        `(files: ${KB_FILES.map((f) => f.file).join(', ')})`,
    );
  }

  get(): KnowledgeBase {
    if (!this.cached) {
      this.cached = this.load();
    }
    return this.cached;
  }

  private load(): KnowledgeBase {
    const root = this.resolveKbRoot();
    const contents: Record<string, string> = {};
    let totalChars = 0;

    for (const { key, file } of KB_FILES) {
      const path = join(root, file);
      if (!existsSync(path)) {
        throw new Error(`KB file missing: ${path}`);
      }
      const text = readFileSync(path, 'utf8');
      if (text.trim().length === 0) {
        throw new Error(`KB file empty: ${path}`);
      }
      contents[key] = text;
      totalChars += text.length;
    }

    return {
      zones: contents.zones as string,
      atpStructure: contents.atpStructure as string,
      workouts: contents.workouts as string,
      weeklyTemplates: contents.weeklyTemplates as string,
      recovery: contents.recovery as string,
      totalChars,
      loadedFrom: root,
    };
  }

  private resolveKbRoot(): string {
    const override = this.config.get('ETA_KB_ROOT', { infer: true });
    if (override !== undefined && override.length > 0) {
      const abs = isAbsolute(override) ? override : resolve(process.cwd(), override);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) {
        throw new Error(`ETA_KB_ROOT does not point to a directory: ${abs}`);
      }
      return abs;
    }
    return findKbRootByWalkUp(process.cwd());
  }
}

export function findKbRootByWalkUp(startDir: string): string {
  let current = resolve(startDir);
  // Filesystem depth bound — prevents pathological infinite loop if dirname/resolve ever misbehave.
  for (let depth = 0; depth < 64; depth++) {
    const candidate = join(current, 'knowledge-base');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(
    `Could not find a "knowledge-base" directory walking up from ${startDir}. ` +
      `Set ETA_KB_ROOT to override.`,
  );
}
