import { git, gitOrNull } from './git.js';
import type { BranchEdge } from './topology.js';

/** True when the worktree has uncommitted changes (tracked or untracked). */
export function isDirty(worktreeDir: string): boolean {
  return git(worktreeDir, 'status', '--porcelain').length > 0;
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
