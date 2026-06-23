import { describe, it, expect, afterEach } from 'vitest';
import { newRepo, cleanupRepos, git } from './sandbox.js';
import { setParent, detach } from '../src/commands.js';
import { readBranchEdges } from '../src/adapter.js';

afterEach(cleanupRepos);

const parentOf = (dir: string, branch: string) =>
  Object.fromEntries(readBranchEdges(dir).map((e) => [e.branch, e.parent]))[branch];

describe('setParent', () => {
  it('records restackParent for a branch', () => {
    const dir = newRepo();
    git(dir, 'branch', 'b');

    setParent(dir, 'b', 'a');

    expect(parentOf(dir, 'b')).toBe('a');
  });
});

describe('detach', () => {
  it('re-parents a branch onto main (makes it an independent root)', () => {
    const dir = newRepo();
    git(dir, 'branch', 'b');
    setParent(dir, 'b', 'a');

    detach(dir, 'b');

    expect(parentOf(dir, 'b')).toBe('main');
  });
});
