import { collectStatus, type StatusNode } from './status.js';
import { isMerged, mergeInto } from './adapter.js';
import { withLock } from './lock.js';

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

/** Outcome of actually attempting to merge a parent into one child. */
export interface MergeEffectResult {
  outcome: 'merged' | 'up-to-date' | 'conflict' | 'error';
  detail?: string;
}

/** What the executor did to one descendant branch (a superset of {@link CascadeAction}'s statuses). */
export interface CascadeStep {
  branch: string;
  parent: string;
  outcome: 'merged' | 'up-to-date' | 'skip-dirty' | 'blocked' | 'conflict' | 'error';
  detail?: string;
}

/**
 * Execute the cascade from `from`, performing each clean child's merge via the injected
 * `merge` effect (kept out so this stays pure/unit-testable). Mirrors {@link planCascade}'s
 * top-down walk, but propagates `blocked` off the *real* outcome: a child that is dirty,
 * conflicts, or errors never receives the parent's commits, so nothing below it can cascade
 * until it heals on its own commit. Only `merged`/`up-to-date` let the subtree continue.
 */
export function executeCascade(
  from: StatusNode,
  merge: (parent: string, child: StatusNode) => MergeEffectResult,
): CascadeStep[] {
  const steps: CascadeStep[] = [];
  const walk = (parent: StatusNode, blocked: boolean): void => {
    for (const child of parent.children) {
      let outcome: CascadeStep['outcome'];
      let detail: string | undefined;
      if (blocked) {
        outcome = 'blocked';
      } else if (child.dirty) {
        outcome = 'skip-dirty';
      } else {
        ({ outcome, detail } = merge(parent.branch, child));
      }
      const step: CascadeStep = { branch: child.branch, parent: parent.branch, outcome };
      if (detail !== undefined) step.detail = detail;
      steps.push(step);
      const advanced = outcome === 'merged' || outcome === 'up-to-date';
      walk(child, !advanced);
    }
  };
  walk(from, false);
  return steps;
}

/** Render an executed cascade as one `parent -> branch  outcome [(detail)]` line per step. */
export function formatExec(steps: CascadeStep[]): string {
  if (steps.length === 0) return 'Nothing to cascade.';
  return steps
    .map((s) => `${s.parent} -> ${s.branch}  ${s.outcome}${s.detail ? `  (${s.detail})` : ''}`)
    .join('\n');
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

/**
 * Run the real cascade from `from`: read the live stack, then merge each clean descendant's
 * parent in (top-down) via {@link mergeInto}. Serialised under the per-repo lock so two
 * cascades can't race. Local-only — nothing is pushed (see `restack push`).
 */
export function executeCascadeForRepo(
  repoDir: string,
  from: string,
  opts?: { waitMs?: number },
): CascadeStep[] {
  // Child git processes (merge/commit) inherit this env var, so a merge-triggered
  // post-commit hook firing in another worktree sees it and no-ops — the engine-level
  // recursion guard; the hook's own `RESTACK_CASCADE` check is the trigger-level twin.
  process.env.RESTACK_CASCADE = '1';
  return withLock(
    repoDir,
    () => {
      const node = findNode(collectStatus(repoDir), from);
      if (!node) throw new Error(`branch not in any stack: ${from}`);
      return executeCascade(node, (parent, child) => mergeInto(repoDir, parent, child));
    },
    opts,
  );
}
