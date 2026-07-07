import { describe, it, expect } from 'vitest';
import { executeCascade, formatExec, type CascadeStep, type MergeEffectResult } from '../src/cascade.js';
import type { StatusNode } from '../src/status.js';

/** Helper: build a StatusNode with sensible defaults. */
function node(branch: string, parent: string | null, over: Partial<StatusNode> = {}): StatusNode {
  return { branch, parent, worktree: `/wt/${branch}`, dirty: false, children: [], ...over };
}

/** A merge effect that returns a fixed outcome and records the (parent, child) pairs it ran. */
function recorder(outcome: MergeEffectResult['outcome'] = 'merged') {
  const calls: string[] = [];
  const merge = (parent: string, child: StatusNode): MergeEffectResult => {
    calls.push(`${parent}->${child.branch}`);
    return { outcome };
  };
  return { merge, calls };
}

describe('executeCascade', () => {
  it('runs the merge for a clean child and records its outcome', () => {
    const a = node('a', 'main', { children: [node('b', 'a')] });
    const { merge, calls } = recorder('merged');

    const steps = executeCascade(a, merge);

    expect(calls).toEqual(['a->b']);
    expect(steps).toEqual<CascadeStep[]>([{ branch: 'b', parent: 'a', outcome: 'merged' }]);
  });

  it('does not run a merge for a dirty child and blocks its subtree', () => {
    const a = node('a', 'main', {
      children: [node('b', 'a', { dirty: true, children: [node('c', 'b')] })],
    });
    const { merge, calls } = recorder('merged');

    const steps = executeCascade(a, merge);

    expect(calls).toEqual([]); // dirty child never reaches the merge effect
    expect(steps).toEqual<CascadeStep[]>([
      { branch: 'b', parent: 'a', outcome: 'skip-dirty' },
      { branch: 'c', parent: 'b', outcome: 'blocked' },
    ]);
  });

  it('keeps cascading through an up-to-date child (it advanced nothing, but is not blocked)', () => {
    const a = node('a', 'main', { children: [node('b', 'a', { children: [node('c', 'b')] })] });
    // b already contains a (up-to-date); c still needs b.
    const merge = (parent: string, child: StatusNode): MergeEffectResult =>
      child.branch === 'b' ? { outcome: 'up-to-date' } : { outcome: 'merged' };

    const steps = executeCascade(a, merge);

    expect(steps).toEqual<CascadeStep[]>([
      { branch: 'b', parent: 'a', outcome: 'up-to-date' },
      { branch: 'c', parent: 'b', outcome: 'merged' },
    ]);
  });

  it('records a conflict and blocks the subtree below the conflicted branch', () => {
    const a = node('a', 'main', { children: [node('b', 'a', { children: [node('c', 'b')] })] });
    const calls: string[] = [];
    const merge = (parent: string, child: StatusNode): MergeEffectResult => {
      calls.push(`${parent}->${child.branch}`);
      return child.branch === 'b' ? { outcome: 'conflict', detail: 'foo.ts' } : { outcome: 'merged' };
    };

    const steps = executeCascade(a, merge);

    expect(calls).toEqual(['a->b']); // c is blocked, never attempted
    expect(steps).toEqual<CascadeStep[]>([
      { branch: 'b', parent: 'a', outcome: 'conflict', detail: 'foo.ts' },
      { branch: 'c', parent: 'b', outcome: 'blocked' },
    ]);
  });

  it('merges a deep chain top-down, parent before child', () => {
    const a = node('a', 'main', { children: [node('b', 'a', { children: [node('c', 'b')] })] });
    const { merge, calls } = recorder('merged');

    executeCascade(a, merge);

    expect(calls).toEqual(['a->b', 'b->c']);
  });

  it('keeps cascading clean siblings even when one subtree is blocked', () => {
    const a = node('a', 'main', {
      children: [
        node('b', 'a', { dirty: true, children: [node('c', 'b')] }),
        node('d', 'a'),
      ],
    });
    const { merge } = recorder('merged');

    const steps = executeCascade(a, merge);

    expect(steps).toEqual<CascadeStep[]>([
      { branch: 'b', parent: 'a', outcome: 'skip-dirty' },
      { branch: 'c', parent: 'b', outcome: 'blocked' },
      { branch: 'd', parent: 'a', outcome: 'merged' },
    ]);
  });

  it('blocks the subtree when a merge errors', () => {
    const a = node('a', 'main', { children: [node('b', 'a', { children: [node('c', 'b')] })] });
    const merge = (parent: string, child: StatusNode): MergeEffectResult =>
      child.branch === 'b' ? { outcome: 'error', detail: 'no worktree' } : { outcome: 'merged' };

    const steps = executeCascade(a, merge);

    expect(steps).toEqual<CascadeStep[]>([
      { branch: 'b', parent: 'a', outcome: 'error', detail: 'no worktree' },
      { branch: 'c', parent: 'b', outcome: 'blocked' },
    ]);
  });
});

describe('formatExec', () => {
  it('renders each step, appending the detail for outcomes that carry one', () => {
    const out = formatExec([
      { branch: 'b', parent: 'a', outcome: 'merged' },
      { branch: 'c', parent: 'b', outcome: 'conflict', detail: 'f.txt' },
    ]);

    expect(out).toMatch(/a -> b\s+merged/);
    expect(out).toMatch(/b -> c\s+conflict\s+\(f\.txt\)/);
  });

  it('reports an empty cascade as nothing to do', () => {
    expect(formatExec([])).toMatch(/nothing/i);
  });
});
