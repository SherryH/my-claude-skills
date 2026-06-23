import { collectStatus, type StatusNode } from './status.js';
import { isMerged } from './adapter.js';

/** What the cascade would do to one descendant branch. */
export interface CascadeAction {
  branch: string;
  parent: string;
  status: 'merge' | 'up-to-date' | 'skip-dirty' | 'blocked';
}

/**
 * Dry-run planner: walk `from`'s descendant subtree and decide, per branch, what
 * the cascade would do. `isMerged(parent, child)` reports whether `parent` is
 * already contained in `child` (injected so this stays pure/unit-testable).
 */
export function planCascade(
  from: StatusNode,
  isMerged: (parent: string, child: string) => boolean,
): CascadeAction[] {
  const actions: CascadeAction[] = [];
  // `blocked` propagates down once an ancestor was skipped: its parent never got the
  // merge, so nothing below it can cascade until that branch heals on its own commit.
  const walk = (parent: StatusNode, blocked: boolean): void => {
    for (const child of parent.children) {
      const status: CascadeAction['status'] = blocked
        ? 'blocked'
        : child.dirty
          ? 'skip-dirty'
          : isMerged(parent.branch, child.branch)
            ? 'up-to-date'
            : 'merge';
      actions.push({ branch: child.branch, parent: parent.branch, status });
      walk(child, status === 'skip-dirty' || status === 'blocked');
    }
  };
  walk(from, false);
  return actions;
}

/** Render a cascade plan as one `parent -> branch  status` line per action. */
export function formatPlan(actions: CascadeAction[]): string {
  if (actions.length === 0) return 'Nothing to cascade.';
  return actions.map((a) => `${a.parent} -> ${a.branch}  ${a.status}`).join('\n');
}

/** Find a branch's node anywhere in a status forest. */
function findNode(roots: StatusNode[], branch: string): StatusNode | null {
  for (const root of roots) {
    if (root.branch === branch) return root;
    const found = findNode(root.children, branch);
    if (found) return found;
  }
  return null;
}

/**
 * Repo-level dry-run: read the live stack forest and plan the cascade starting from
 * `from`, using real git ancestry to decide merge vs up-to-date.
 */
export function planCascadeForRepo(repoDir: string, from: string): CascadeAction[] {
  const node = findNode(collectStatus(repoDir), from);
  if (!node) throw new Error(`branch not in any stack: ${from}`);
  return planCascade(node, (parent, child) => isMerged(repoDir, parent, child));
}
