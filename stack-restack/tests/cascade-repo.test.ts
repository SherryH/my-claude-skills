import { describe, it, expect, afterEach } from 'vitest';
import { newRepo, cleanupRepos, git } from './sandbox.js';
import { planCascadeForRepo } from '../src/cascade.js';

describe('planCascadeForRepo', () => {
  afterEach(cleanupRepos);

  it('plans a merge for a clean stacked child whose parent has advanced', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    git(dir, 'branch', 'b');
    git(dir, 'config', 'branch.a.restackParent', 'main');
    git(dir, 'config', 'branch.b.restackParent', 'a');
    git(dir, 'checkout', 'a');
    git(dir, 'commit', '--allow-empty', '-m', 'a1'); // a now ahead of b

    const plan = planCascadeForRepo(dir, 'a');

    expect(plan).toEqual([{ branch: 'b', parent: 'a', status: 'merge' }]);
  });

  it('throws when the starting branch is not in any stack', () => {
    const dir = newRepo();

    expect(() => planCascadeForRepo(dir, 'nope')).toThrow(/nope/);
  });
});
