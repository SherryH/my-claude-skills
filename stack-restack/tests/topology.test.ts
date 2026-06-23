import { describe, it, expect } from 'vitest';
import { buildStacks, type StackNode } from '../src/topology.js';

describe('buildStacks', () => {
  it('turns a linear chain of edges into a nested forest', () => {
    // a (rooted on main) <- b <- c
    const forest = buildStacks([
      { branch: 'a', parent: 'main' },
      { branch: 'b', parent: 'a' },
      { branch: 'c', parent: 'b' },
    ]);

    expect(forest).toHaveLength(1);
    const a = forest[0]!;
    expect(a.branch).toBe('a');
    expect(a.parent).toBe('main');
    expect(a.children.map((n) => n.branch)).toEqual(['b']);

    const b = a.children[0]!;
    expect(b.children.map((n) => n.branch)).toEqual(['c']);
    expect(b.children[0]!.children).toEqual([]);
  });

  it('never produces a cyclic structure when parents form a cycle', () => {
    // a <- b <- a (corrupt restackParent config); status must not infinite-loop
    const forest = buildStacks([
      { branch: 'a', parent: 'b' },
      { branch: 'b', parent: 'a' },
    ]);

    const seen = new Set<string>();
    const visit = (n: StackNode) => {
      if (seen.has(n.branch)) throw new Error(`cycle revisited ${n.branch}`);
      seen.add(n.branch);
      n.children.forEach(visit);
    };
    forest.forEach(visit);

    expect(seen).toEqual(new Set(['a', 'b']));
  });
});
