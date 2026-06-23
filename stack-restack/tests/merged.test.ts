import { describe, it, expect, afterEach } from 'vitest';
import { newRepo, cleanupRepos, git } from './sandbox.js';
import { isMerged } from '../src/adapter.js';

describe('isMerged', () => {
  afterEach(cleanupRepos);

  it('is true when the parent is already contained in the child, false once the parent advances', () => {
    const dir = newRepo(); // main @ root
    git(dir, 'branch', 'b'); // b starts at main's tip → contains main

    expect(isMerged(dir, 'main', 'b')).toBe(true);

    git(dir, 'checkout', 'main');
    git(dir, 'commit', '--allow-empty', '-m', 'new on main'); // main now ahead of b

    expect(isMerged(dir, 'main', 'b')).toBe(false);
  });
});
