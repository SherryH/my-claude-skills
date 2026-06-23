import { describe, it, expect } from 'vitest';
import { planCascade, formatPlan, type CascadeAction } from '../src/cascade.js';
import type { StatusNode } from '../src/status.js';

/** Helper: build a StatusNode with sensible defaults. */
function node(branch: string, parent: string | null, over: Partial<StatusNode> = {}): StatusNode {
  return { branch, parent, worktree: `/wt/${branch}`, dirty: false, children: [], ...over };
}

describe('planCascade (dry-run)', () => {
  it('plans a merge for a clean child whose parent has commits it lacks', () => {
    const a = node('a', 'main', { children: [node('b', 'a')] });

    const plan = planCascade(a, () => false); // nothing merged into anyone yet

    expect(plan).toEqual<CascadeAction[]>([{ branch: 'b', parent: 'a', status: 'merge' }]);
  });

  it('plans up-to-date for a clean child whose parent is already merged in', () => {
    const a = node('a', 'main', { children: [node('b', 'a')] });

    const plan = planCascade(a, () => true); // parent already contained in child

    expect(plan).toEqual<CascadeAction[]>([{ branch: 'b', parent: 'a', status: 'up-to-date' }]);
  });

  it('skips a dirty child (skip-dirty) even when the parent has new commits', () => {
    const a = node('a', 'main', { children: [node('b', 'a', { dirty: true })] });

    const plan = planCascade(a, () => false);

    expect(plan).toEqual<CascadeAction[]>([{ branch: 'b', parent: 'a', status: 'skip-dirty' }]);
  });

  it('cascades through a deep chain top-down, each child merging its own parent', () => {
    const a = node('a', 'main', {
      children: [node('b', 'a', { children: [node('c', 'b')] })],
    });

    const plan = planCascade(a, () => false);

    expect(plan).toEqual<CascadeAction[]>([
      { branch: 'b', parent: 'a', status: 'merge' },
      { branch: 'c', parent: 'b', status: 'merge' },
    ]);
  });

  it('blocks descendants below a skipped dirty branch', () => {
    const a = node('a', 'main', {
      children: [node('b', 'a', { dirty: true, children: [node('c', 'b')] })],
    });

    const plan = planCascade(a, () => false);

    expect(plan).toEqual<CascadeAction[]>([
      { branch: 'b', parent: 'a', status: 'skip-dirty' },
      { branch: 'c', parent: 'b', status: 'blocked' },
    ]);
  });

  it('keeps cascading clean siblings even when one subtree is blocked', () => {
    const a = node('a', 'main', {
      children: [
        node('b', 'a', { dirty: true, children: [node('c', 'b')] }),
        node('d', 'a'),
      ],
    });

    const plan = planCascade(a, () => false);

    expect(plan).toEqual<CascadeAction[]>([
      { branch: 'b', parent: 'a', status: 'skip-dirty' },
      { branch: 'c', parent: 'b', status: 'blocked' },
      { branch: 'd', parent: 'a', status: 'merge' },
    ]);
  });
});

describe('formatPlan', () => {
  it('renders each action as "parent -> branch" with its status', () => {
    const out = formatPlan([
      { branch: 'b', parent: 'a', status: 'merge' },
      { branch: 'c', parent: 'b', status: 'blocked' },
    ]);

    expect(out).toMatch(/a -> b.*merge/);
    expect(out).toMatch(/b -> c.*blocked/);
  });

  it('reports an empty plan as nothing to do', () => {
    expect(formatPlan([])).toMatch(/nothing/i);
  });
});
