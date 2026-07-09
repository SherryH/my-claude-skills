import { closeSync, linkSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
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

/** True when `pid` names a live process (a hook-spawned cascade that crashed leaves a dead one). */
function isLivePid(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

/** A lock file is stale when its content isn't a PID, or names a process that's gone. */
function isStale(path: string): boolean {
  let content: string;
  try {
    content = readFileSync(path, 'utf8').trim();
  } catch {
    return true; // vanished since the EEXIST — the holder released; retry the acquire
  }
  return !isLivePid(Number(content));
}

/**
 * Stage the PID in a sibling file, then hard-link it into place. link() is an atomic
 * create-if-absent, so a lock file, once visible, always carries its holder's PID — a
 * concurrent isStale() can never observe a created-but-unwritten (empty) lock and
 * wrongly reclaim a live one.
 */
function linkStagedPid(path: string): boolean {
  const staging = `${path}.${process.pid}.staging`;
  const fd = openSync(staging, 'w');
  writeSync(fd, String(process.pid));
  closeSync(fd);
  try {
    linkSync(staging, path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    return false;
  } finally {
    rmSync(staging, { force: true });
  }
}

function tryAcquire(path: string): boolean {
  for (;;) {
    if (linkStagedPid(path)) return true;
    if (!isStale(path)) return false;
    rmSync(path, { force: true });
  }
}

/** Sleep synchronously — safe on Node's main thread, and this is a CLI, never a server. */
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Serialise cascades: hold the per-repo lock for the duration of `fn`. Throws
 * {@link LockHeldError} if another cascade already holds it (unless `waitMs` is given, in
 * which case this polls until the lock frees up or the deadline passes). A lock file whose
 * PID is dead (crashed cascade) is reclaimed rather than treated as held. The lock is always
 * released, even when `fn` throws — automation must never leave a stale lock behind.
 */
export function withLock<T>(repoDir: string, fn: () => T, opts?: { waitMs?: number }): T {
  const path = lockPath(repoDir);
  mkdirSync(dirname(path), { recursive: true });

  const deadline = Date.now() + (opts?.waitMs ?? 0);
  let acquired = tryAcquire(path);
  while (!acquired && opts?.waitMs !== undefined && Date.now() < deadline) {
    sleepMs(250);
    acquired = tryAcquire(path);
  }
  if (!acquired) throw new LockHeldError(path);

  try {
    return fn();
  } finally {
    rmSync(path, { force: true });
  }
}
