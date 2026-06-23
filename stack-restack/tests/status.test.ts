import { describe, it, expect, afterEach } from 'vitest';
import { formatStatus, collectStatus, type StatusNode } from '../src/status.js';
import { newRepo, addWorktree, cleanupRepos, git } from './sandbox.js';

describe('formatStatus', () => {
  it('renders a depth-indented tree with per-branch clean/dirty + worktree', () => {
    const roots: StatusNode[] = [
      {
        branch: 'a',
        parent: 'main',
        worktree: '/wt/a',
        dirty: false,
        children: [
          { branch: 'b', parent: 'a', worktree: '/wt/b', dirty: true, children: [] },
          { branch: 'c', parent: 'a', worktree: null, dirty: false, children: [] },
        ],
      },
    ];

    const out = formatStatus(roots);
    const lineOf = (name: string) =>
      out.split('\n').find((l) => l.trimStart().startsWith(`${name} `))!;

    expect(lineOf('a')).toMatch(/a.*clean/);
    expect(lineOf('b')).toMatch(/b.*dirty/);
    expect(lineOf('c')).toMatch(/c.*no worktree/i);
    // children indented deeper than their parent
    const indent = (l: string) => l.length - l.trimStart().length;
    expect(indent(lineOf('b'))).toBeGreaterThan(indent(lineOf('a')));
  });
});

describe('collectStatus', () => {
  afterEach(cleanupRepos);

  it('annotates the resolved stack with worktree + dirty state from a real repo', () => {
    const dir = newRepo();
    git(dir, 'branch', 'a');
    git(dir, 'config', 'branch.a.restackParent', 'main');
    const wtA = addWorktree(dir, 'a');

    const roots = collectStatus(dir);
    const a = roots.flatMap((r) => [r, ...r.children]).find((n) => n.branch === 'a')!;

    expect(a.parent).toBe('main');
    expect(a.worktree).toBe(wtA);
    expect(a.dirty).toBe(false);
  });
});
