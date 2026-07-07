import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newRepo, addWorktree, cleanupRepos, git } from './sandbox.js';
import { mergeInto, isMerged, readWorktrees } from '../src/adapter.js';

/** Stack b-on-a-on-main, with `a` and `b` stamped. Returns the repo dir. */
function stackedRepo(): string {
  const dir = newRepo();
  git(dir, 'branch', 'a');
  git(dir, 'config', 'branch.a.restackParent', 'main');
  git(dir, 'branch', 'b', 'a');
  git(dir, 'config', 'branch.b.restackParent', 'a');
  return dir;
}

describe('mergeInto', () => {
  afterEach(cleanupRepos);

  it('merges an advanced parent into a clean child checked out in a worktree', () => {
    const dir = stackedRepo();
    const wtB = addWorktree(dir, 'b');
    git(dir, 'checkout', 'a');
    git(dir, 'commit', '--allow-empty', '-m', 'a1'); // a now ahead of b
    expect(isMerged(dir, 'a', 'b')).toBe(false);

    const result = mergeInto(dir, 'a', { branch: 'b', worktree: wtB });

    expect(result.outcome).toBe('merged');
    expect(isMerged(dir, 'a', 'b')).toBe(true);
  });

  it('reports up-to-date and creates no commit when the parent is already contained', () => {
    const dir = stackedRepo(); // a never advanced → already in b
    const wtB = addWorktree(dir, 'b');
    const before = git(wtB, 'rev-parse', 'HEAD');

    const result = mergeInto(dir, 'a', { branch: 'b', worktree: wtB });

    expect(result.outcome).toBe('up-to-date');
    expect(git(wtB, 'rev-parse', 'HEAD')).toBe(before); // no merge commit landed
  });

  it('aborts clean on conflict, leaving the child worktree untouched, and names the file', () => {
    const dir = newRepo();
    writeFileSync(join(dir, 'f.txt'), 'base\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-m', 'base');
    git(dir, 'branch', 'a');
    git(dir, 'config', 'branch.a.restackParent', 'main');
    git(dir, 'branch', 'b', 'a');
    git(dir, 'config', 'branch.b.restackParent', 'a');
    const wtB = addWorktree(dir, 'b');
    git(dir, 'checkout', 'a'); // diverging change on a
    writeFileSync(join(dir, 'f.txt'), 'from-a\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-m', 'a-change');
    writeFileSync(join(wtB, 'f.txt'), 'from-b\n'); // conflicting change on b
    git(wtB, 'add', '.');
    git(wtB, 'commit', '-m', 'b-change');
    const before = git(wtB, 'rev-parse', 'HEAD');

    const result = mergeInto(dir, 'a', { branch: 'b', worktree: wtB });

    expect(result.outcome).toBe('conflict');
    expect(result.detail).toContain('f.txt');
    expect(git(wtB, 'status', '--porcelain')).toBe(''); // no mid-merge residue
    expect(git(wtB, 'rev-parse', 'HEAD')).toBe(before); // b ref unchanged
  });

  it('merges a branch with no worktree via a temp worktree, leaving the main repo untouched', () => {
    const dir = stackedRepo(); // b has no worktree
    git(dir, 'checkout', 'a');
    git(dir, 'commit', '--allow-empty', '-m', 'a1');
    const headBefore = git(dir, 'rev-parse', 'HEAD');
    const branchBefore = git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');

    const result = mergeInto(dir, 'a', { branch: 'b', worktree: null });

    expect(result.outcome).toBe('merged');
    expect(isMerged(dir, 'a', 'b')).toBe(true);
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(branchBefore); // still on 'a'
    expect(git(dir, 'rev-parse', 'HEAD')).toBe(headBefore); // main repo HEAD untouched
    expect(readWorktrees(dir)).toHaveLength(1); // temp worktree cleaned up
  });
});
