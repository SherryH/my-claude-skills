import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, gitOrNull } from './git.js';
import type { BranchEdge } from './topology.js';
import type { MergeEffectResult } from './cascade.js';

/** True when the worktree has uncommitted changes (tracked or untracked). */
export function isDirty(worktreeDir: string): boolean {
  return git(worktreeDir, 'status', '--porcelain').length > 0;
}

/** True when `parent` is already contained in `child` (i.e. no merge needed). */
export function isMerged(repoDir: string, parent: string, child: string): boolean {
  // `merge-base --is-ancestor` exits 0 when parent is an ancestor of child, non-zero otherwise.
  return gitOrNull(repoDir, 'merge-base', '--is-ancestor', parent, child) !== null;
}

/**
 * Merge `parent` into `child` **non-destructively** (merge, never rebase — preserves the
 * child's SHAs so the eventual push needs no force). Returns `up-to-date` when the parent is
 * already contained, otherwise performs the merge where the child is checked out. A branch
 * with no worktree is merged in a throwaway linked worktree so `repoDir`'s HEAD is untouched.
 * On conflict the merge is aborted (clean) and deferred — Slice 4 owns AI resolution.
 */
export function mergeInto(
  repoDir: string,
  parent: string,
  child: { branch: string; worktree: string | null },
): MergeEffectResult {
  if (isMerged(repoDir, parent, child.branch)) return { outcome: 'up-to-date' };
  if (child.worktree) return mergeInWorktree(child.worktree, parent);

  // git won't merge into a branch checked out nowhere; borrow a temp worktree, then drop it.
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'restack-merge-')));
  const wt = join(tmp, child.branch.replace(/\//g, '-'));
  try {
    git(repoDir, 'worktree', 'add', wt, child.branch);
    return mergeInWorktree(wt, parent);
  } finally {
    gitOrNull(repoDir, 'worktree', 'remove', '--force', wt);
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Run the merge in `worktreeDir`; on failure capture the conflicted files, then abort clean. */
function mergeInWorktree(worktreeDir: string, parent: string): MergeEffectResult {
  if (gitOrNull(worktreeDir, 'merge', '--no-edit', parent) !== null) return { outcome: 'merged' };

  const conflicted = (gitOrNull(worktreeDir, 'diff', '--name-only', '--diff-filter=U') ?? '')
    .split('\n')
    .filter(Boolean);
  // Never leave a worktree mid-merge — reset it to exactly how we found it.
  gitOrNull(worktreeDir, 'merge', '--abort');
  return conflicted.length > 0
    ? { outcome: 'conflict', detail: conflicted.join(', ') }
    : { outcome: 'error', detail: 'merge failed' };
}

export interface Worktree {
  path: string;
  /** Short branch name, or null when the worktree is detached. */
  branch: string | null;
}

/** List linked worktrees and the branch each has checked out (via `worktree list --porcelain`). */
export function readWorktrees(repoDir: string): Worktree[] {
  return git(repoDir, 'worktree', 'list', '--porcelain')
    .split('\n\n')
    .filter(Boolean)
    .map((record) => {
      const lines = record.split('\n');
      const path = lines.find((l) => l.startsWith('worktree '))!.slice('worktree '.length);
      const branchLine = lines.find((l) => l.startsWith('branch '));
      const branch = branchLine ? branchLine.slice('branch refs/heads/'.length) : null;
      return { path, branch };
    });
}

/** List local branches and read each one's `restackParent` config (null when unset). */
export function readBranchEdges(repoDir: string): BranchEdge[] {
  const branches = git(repoDir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/')
    .split('\n')
    .filter(Boolean);

  return branches.map((branch) => ({
    branch,
    parent: gitOrNull(repoDir, 'config', '--get', `branch.${branch}.restackParent`) || null,
  }));
}
