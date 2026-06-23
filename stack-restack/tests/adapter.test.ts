import { describe, it, expect, afterEach } from 'vitest';
import { newRepo, cleanupRepos, git } from './sandbox.js';
import { readBranchEdges } from '../src/adapter.js';

afterEach(cleanupRepos);

describe('readBranchEdges', () => {
  it('reads restackParent config for each local branch', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    git(dir, 'branch', 'b');
    git(dir, 'config', 'branch.a.restackParent', 'main');
    git(dir, 'config', 'branch.b.restackParent', 'a');

    const byBranch = Object.fromEntries(readBranchEdges(dir).map((e) => [e.branch, e.parent]));

    expect(byBranch).toMatchObject({ a: 'main', b: 'a' });
  });

  it('reports a null parent for a branch with no restackParent set', () => {
    const dir = newRepo();
    git(dir, 'branch', 'loner');

    const byBranch = Object.fromEntries(readBranchEdges(dir).map((e) => [e.branch, e.parent]));

    expect(byBranch.loner).toBeNull();
  });
});
