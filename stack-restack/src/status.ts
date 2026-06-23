import { readBranchEdges, readWorktrees, isDirty } from './adapter.js';
import { buildStacks, type StackNode } from './topology.js';

export interface StatusNode {
  branch: string;
  parent: string | null;
  /** Worktree path the branch is checked out in, or null if not checked out. */
  worktree: string | null;
  dirty: boolean;
  children: StatusNode[];
}

/** Build the stack forest for a repo, annotated with each branch's worktree + dirty state. */
export function collectStatus(repoDir: string): StatusNode[] {
  const worktreeOf = new Map<string, string>();
  for (const w of readWorktrees(repoDir)) {
    if (w.branch) worktreeOf.set(w.branch, w.path);
  }

  const annotate = (node: StackNode): StatusNode => {
    const worktree = worktreeOf.get(node.branch) ?? null;
    return {
      branch: node.branch,
      parent: node.parent,
      worktree,
      dirty: worktree ? isDirty(worktree) : false,
      children: node.children.map(annotate),
    };
  };

  return buildStacks(readBranchEdges(repoDir)).map(annotate);
}

/** Render the annotated forest as a depth-indented text tree. */
export function formatStatus(roots: StatusNode[]): string {
  const lines: string[] = [];
  const walk = (node: StatusNode, depth: number): void => {
    const indent = '  '.repeat(depth);
    const location = node.worktree === null ? 'no worktree' : `${node.dirty ? 'dirty' : 'clean'}  ${node.worktree}`;
    lines.push(`${indent}${node.branch}  ${location}`);
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  return lines.join('\n');
}
