import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newRepo, cleanupRepos } from './sandbox.js';
import { isDirty } from '../src/adapter.js';

afterEach(cleanupRepos);

describe('isDirty', () => {
  it('is false for a clean worktree', () => {
    const dir = newRepo();
    expect(isDirty(dir)).toBe(false);
  });

  it('is true when there are uncommitted changes', () => {
    const dir = newRepo();
    writeFileSync(join(dir, 'scratch.txt'), 'wip');
    expect(isDirty(dir)).toBe(true);
  });
});
