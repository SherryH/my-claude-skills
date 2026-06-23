import { git } from './git.js';

/** Record `branch`'s parent in git config (`branch.<branch>.restackParent`). */
export function setParent(repoDir: string, branch: string, parent: string): void {
  git(repoDir, 'config', `branch.${branch}.restackParent`, parent);
}

/** Re-parent a branch onto `main` — i.e. make it an independent stack root. */
export function detach(repoDir: string, branch: string): void {
  setParent(repoDir, branch, 'main');
}
