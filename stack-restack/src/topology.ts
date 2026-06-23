export interface BranchEdge {
  branch: string;
  /** The branch/ref this branch is stacked on (`restackParent`). `main`/external = stack root. */
  parent: string | null;
}

export interface StackNode {
  branch: string;
  parent: string | null;
  children: StackNode[];
}

/**
 * Resolve flat parent edges into a forest of stacks. A branch is a root when its
 * parent is not itself a managed branch (e.g. `main` or any external base).
 */
export function buildStacks(edges: BranchEdge[]): StackNode[] {
  const managed = new Set(edges.map((e) => e.branch));
  const nodes = new Map<string, StackNode>(
    edges.map((e) => [e.branch, { branch: e.branch, parent: e.parent, children: [] }]),
  );

  const parentOf = new Map<string, string | null>(edges.map((e) => [e.branch, e.parent]));

  // Attaching `branch` under `parent` closes a cycle if `branch` is already an
  // ancestor of `parent`. Walk up from `parent`; a corrupt config can't loop us forever.
  const wouldCycle = (branch: string, parent: string): boolean => {
    const seen = new Set<string>();
    let cur: string | null = parent;
    while (cur !== null && managed.has(cur)) {
      if (cur === branch || seen.has(cur)) return true;
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return false;
  };

  const roots: StackNode[] = [];
  for (const e of edges) {
    const node = nodes.get(e.branch)!;
    if (e.parent !== null && managed.has(e.parent) && !wouldCycle(e.branch, e.parent)) {
      nodes.get(e.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
