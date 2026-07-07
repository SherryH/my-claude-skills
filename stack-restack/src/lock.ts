import { closeSync, mkdirSync, openSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { git } from './git.js';

/** Path to the single per-repo cascade lock, in the shared git dir so every worktree sees it. */
export function lockPath(repoDir: string): string {
  // --git-common-dir resolves to the shared .git even from a linked worktree.
  return resolve(repoDir, git(repoDir, 'rev-parse', '--git-common-dir'), 'restack', 'lock');
}

export class LockHeldError extends Error {
  constructor(path: string) {
    super(`restack already running (lock held at ${path})`);
    this.name = 'LockHeldError';
  }
}

/**
 * Serialise cascades: hold the per-repo lock for the duration of `fn`. Throws
 * {@link LockHeldError} if another cascade already holds it. The lock is always released,
 * even when `fn` throws — automation must never leave a stale lock behind.
 */
export function withLock<T>(repoDir: string, fn: () => T): T {
  const path = lockPath(repoDir);
  mkdirSync(dirname(path), { recursive: true });

  let fd: number;
  try {
    fd = openSync(path, 'wx'); // exclusive create — fails if the lock already exists
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new LockHeldError(path);
    throw err;
  }

  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(path, { force: true });
  }
}
