import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { newRepo, addWorktree, cleanupRepos, git } from './sandbox.js';
import { executeCascadeForRepo } from '../src/cascade.js';
import { isMerged } from '../src/adapter.js';
import { withLock, LockHeldError } from '../src/lock.js';

/** Stamp `child`'s restackParent. */
function stamp(dir: string, child: string, parent: string): void {
  git(dir, 'config', `branch.${child}.restackParent`, parent);
}

describe('executeCascadeForRepo', () => {
  afterEach(cleanupRepos);

  it('cascades an advanced parent down into a clean stacked child', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    stamp(dir, 'a', 'main');
    git(dir, 'branch', 'b', 'a');
    stamp(dir, 'b', 'a');
    addWorktree(dir, 'b');
    git(dir, 'checkout', 'a');
    git(dir, 'commit', '--allow-empty', '-m', 'a1'); // a ahead of b

    const steps = executeCascadeForRepo(dir, 'a');

    expect(steps).toEqual([{ branch: 'b', parent: 'a', outcome: 'merged' }]);
    expect(isMerged(dir, 'a', 'b')).toBe(true);
  });

  it('propagates an advanced root through a deep chain so the leaf gets it too', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    stamp(dir, 'a', 'main');
    git(dir, 'branch', 'b', 'a');
    stamp(dir, 'b', 'a');
    git(dir, 'branch', 'c', 'b');
    stamp(dir, 'c', 'b');
    addWorktree(dir, 'b');
    addWorktree(dir, 'c');
    git(dir, 'checkout', 'a');
    git(dir, 'commit', '--allow-empty', '-m', 'a1');

    const steps = executeCascadeForRepo(dir, 'a');

    expect(steps).toEqual([
      { branch: 'b', parent: 'a', outcome: 'merged' },
      { branch: 'c', parent: 'b', outcome: 'merged' },
    ]);
    expect(isMerged(dir, 'a', 'c')).toBe(true); // a's commit reached the leaf via b
  });

  it('refuses to run while another cascade holds the lock', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    stamp(dir, 'a', 'main');

    withLock(dir, () => {
      expect(() => executeCascadeForRepo(dir, 'a')).toThrow(LockHeldError);
    });
  });
});
