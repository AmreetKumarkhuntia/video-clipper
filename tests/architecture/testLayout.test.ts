import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TESTS_DIR = path.resolve(process.cwd(), 'tests');
const VITEST_ROOTS = new Set(['unit', 'integration', 'architecture']);
const SOURCE_ROOTS = new Set(['app', 'lib']);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relative(file: string): string {
  return path.relative(TESTS_DIR, file);
}

describe('test layout', () => {
  it('keeps Vitest files under a named test tier', () => {
    const misplaced = walk(TESTS_DIR)
      .filter((file) => file.endsWith('.test.ts'))
      .filter((file) => !VITEST_ROOTS.has(relative(file).split(path.sep)[0] ?? ''))
      .map(relative);

    expect(misplaced).toEqual([]);
  });

  it('keeps Playwright specs under the e2e tier', () => {
    const misplaced = walk(TESTS_DIR)
      .filter((file) => file.endsWith('.spec.ts'))
      .filter((file) => relative(file).split(path.sep)[0] !== 'e2e')
      .map(relative);

    expect(misplaced).toEqual([]);
  });

  it.each(['unit', 'integration'])('%s tests mirror an app or lib source root', (tier) => {
    const tierDir = path.join(TESTS_DIR, tier);
    const misplaced = walk(tierDir)
      .filter((file) => file.endsWith('.test.ts'))
      .filter((file) => !SOURCE_ROOTS.has(path.relative(tierDir, file).split(path.sep)[0] ?? ''))
      .map(relative);

    expect(misplaced).toEqual([]);
  });
});
