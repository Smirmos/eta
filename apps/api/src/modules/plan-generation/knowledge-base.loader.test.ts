import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import { KnowledgeBaseLoader, findKbRootByWalkUp } from './knowledge-base.loader.js';

const ALL_FILES = [
  '01-zones.md',
  '02-atp-structure.md',
  '03-workouts.md',
  '04-weekly-templates.md',
  '05-recovery.md',
];

function makeKbDir(opts: { skip?: string[]; empty?: string[] } = {}): string {
  const tmp = mkdtempSync(join(tmpdir(), 'eta-kb-'));
  const kb = join(tmp, 'knowledge-base');
  mkdirSync(kb, { recursive: true });
  for (const f of ALL_FILES) {
    if (opts.skip?.includes(f)) continue;
    const text = opts.empty?.includes(f) ? '' : `# ${f}\n\nFixture content for ${f}.\n`;
    writeFileSync(join(kb, f), text);
  }
  return tmp;
}

function configWithKbRoot(kbRoot: string | undefined): ConfigService<Env, true> {
  return {
    get: (_key: string) => kbRoot,
  } as unknown as ConfigService<Env, true>;
}

describe('KnowledgeBaseLoader', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs.length = 0;
  });

  afterEach(() => {
    for (const d of tempDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('loads all 5 KB files when ETA_KB_ROOT points at a complete kb dir', () => {
    const tmp = makeKbDir();
    tempDirs.push(tmp);
    const loader = new KnowledgeBaseLoader(configWithKbRoot(join(tmp, 'knowledge-base')));
    loader.onModuleInit();
    const kb = loader.get();

    expect(kb.zones).toContain('01-zones.md');
    expect(kb.atpStructure).toContain('02-atp-structure.md');
    expect(kb.workouts).toContain('03-workouts.md');
    expect(kb.weeklyTemplates).toContain('04-weekly-templates.md');
    expect(kb.recovery).toContain('05-recovery.md');
    expect(kb.totalChars).toBeGreaterThan(0);
    expect(kb.loadedFrom).toBe(join(tmp, 'knowledge-base'));
  });

  it('throws when a KB file is missing', () => {
    const tmp = makeKbDir({ skip: ['03-workouts.md'] });
    tempDirs.push(tmp);
    const loader = new KnowledgeBaseLoader(configWithKbRoot(join(tmp, 'knowledge-base')));
    expect(() => loader.onModuleInit()).toThrow(/KB file missing.*03-workouts\.md/);
  });

  it('throws when a KB file is empty', () => {
    const tmp = makeKbDir({ empty: ['05-recovery.md'] });
    tempDirs.push(tmp);
    const loader = new KnowledgeBaseLoader(configWithKbRoot(join(tmp, 'knowledge-base')));
    expect(() => loader.onModuleInit()).toThrow(/KB file empty.*05-recovery\.md/);
  });

  it('throws when ETA_KB_ROOT does not exist', () => {
    const loader = new KnowledgeBaseLoader(configWithKbRoot('/nonexistent/path/kb'));
    expect(() => loader.onModuleInit()).toThrow(/ETA_KB_ROOT does not point to a directory/);
  });

  it('walks up from cwd to find knowledge-base when ETA_KB_ROOT is unset (real repo)', () => {
    // No isolated fixture — verifies the production fallback finds the real KB
    // when called from anywhere inside the repo.
    const found = findKbRootByWalkUp(process.cwd());
    expect(found).toMatch(/knowledge-base$/);
  });
});
