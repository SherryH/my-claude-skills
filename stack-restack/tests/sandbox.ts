import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Run a git command in a sandbox repo, returning trimmed stdout. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const created: string[] = [];

/** Create a throwaway repo with one root commit on `main`. Auto-cleaned by `cleanupRepos`. */
export function newRepo(): string {
  // realpath so paths match git's canonical output (macOS /var -> /private/var).
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'restack-')));
  created.push(dir);
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'commit', '--allow-empty', '-m', 'root');
  return dir;
}

/** Add a linked worktree checked out to `branch`, at a tracked temp path. Returns its path. */
export function addWorktree(repoDir: string, branch: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'restack-wt-')));
  created.push(dir);
  // worktree add needs the target dir not to pre-exist, so use a child path.
  const wt = join(dir, branch.replace(/\//g, '-'));
  git(repoDir, 'worktree', 'add', wt, branch);
  return wt;
}

export function cleanupRepos(): void {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
}
