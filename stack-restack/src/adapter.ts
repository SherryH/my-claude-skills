import { git, gitOrNull } from './git.js';
import type { BranchEdge } from './topology.js';

/** True when the worktree has uncommitted changes (tracked or untracked). */
export function isDirty(worktreeDir: string): boolean {
  return git(worktreeDir, 'status', '--porcelain').length > 0;
}

/** True when `parent` is already contained in `child` (i.e. no merge needed). */
export function isMerged(repoDir: string, parent: string, child: string): boolean {
  // `merge-base --is-ancestor` exits 0 when parent is an ancestor of child, non-zero otherwise.
  return gitOrNull(repoDir, 'merge-base', '--is-ancestor', parent, child) !== null;
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
