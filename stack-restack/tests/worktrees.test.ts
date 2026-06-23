import { describe, it, expect, afterEach } from 'vitest';
import { newRepo, addWorktree, cleanupRepos, git } from './sandbox.js';
import { readWorktrees } from '../src/adapter.js';

afterEach(cleanupRepos);

describe('readWorktrees', () => {
  it('maps each checked-out branch to its worktree path', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    const wtA = addWorktree(dir, 'a');

    const byBranch = Object.fromEntries(readWorktrees(dir).map((w) => [w.branch, w.path]));

    expect(byBranch.main).toBe(dir);
    expect(byBranch.a).toBe(wtA);
  });

  it('reports a null branch for a detached worktree', () => {
    const dir = newRepo();
    const sha = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'branch', 'a');
    const wtA = addWorktree(dir, 'a');
    git(wtA, 'checkout', '--detach', sha);

    const detached = readWorktrees(dir).find((w) => w.path === wtA);

    expect(detached?.branch).toBeNull();
  });
});
