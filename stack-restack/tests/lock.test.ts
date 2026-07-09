import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { newRepo, cleanupRepos } from './sandbox.js';
import { withLock, lockPath, LockHeldError } from '../src/lock.js';

describe('withLock', () => {
  afterEach(cleanupRepos);

  it('runs the body under the lock and releases it afterward', () => {
    const dir = newRepo();
    let heldDuringBody = false;

    const result = withLock(dir, () => {
      heldDuringBody = existsSync(lockPath(dir));
      return 42;
    });

    expect(result).toBe(42);
    expect(heldDuringBody).toBe(true); // lock present while the body runs
    expect(existsSync(lockPath(dir))).toBe(false); // released afterward
  });

  it('refuses a second cascade while the lock is held', () => {
    const dir = newRepo();

    expect(() =>
      withLock(dir, () => withLock(dir, () => 'inner-should-not-run')),
    ).toThrow(LockHeldError);
    expect(existsSync(lockPath(dir))).toBe(false); // outer still released the lock
  });

  it('releases the lock even when the body throws, so a later cascade can run', () => {
    const dir = newRepo();

    expect(() =>
      withLock(dir, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(existsSync(lockPath(dir))).toBe(false);
    expect(withLock(dir, () => 'ok')).toBe('ok'); // lock is re-acquirable
  });

  it('reclaims a lock left by a dead PID (stale) instead of refusing', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    // A real dead PID: spawn a trivial child and use its pid after it has exited.
    const dead = spawnSync('true', [], {});
    writeFileSync(path, String(dead.pid));

    expect(withLock(dir, () => 'reclaimed')).toBe('reclaimed');
  });

  it('refuses when the lock file holds our own (live) PID', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, String(process.pid));

    expect(() => withLock(dir, () => 'should-not-run')).toThrow(LockHeldError);
    expect(readFileSync(path, 'utf8')).toBe(String(process.pid)); // untouched, not our lock to remove
  });

  it('reclaims a lock file with unparsable garbage content', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, 'not-a-pid');

    expect(withLock(dir, () => 'reclaimed')).toBe('reclaimed');
  });

  it('with waitMs, polls and throws only after the deadline elapses for a live-held lock', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, String(process.pid)); // live (our own pid) — never frees during this test

    const start = Date.now();
    expect(() => withLock(dir, () => 'should-not-run', { waitMs: 600 })).toThrow(LockHeldError);
    expect(Date.now() - start).toBeGreaterThanOrEqual(600);
  });

  it('with waitMs, acquires promptly when the held lock is actually stale', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    const dead = spawnSync('true', [], {});
    writeFileSync(path, String(dead.pid));

    const start = Date.now();
    expect(withLock(dir, () => 'reclaimed', { waitMs: 60_000 })).toBe('reclaimed');
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('reclaims an empty lock file (ours are never visible without a PID — link() lands it atomically)', () => {
    const dir = newRepo();
    const path = lockPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');

    expect(withLock(dir, () => 'reclaimed')).toBe('reclaimed');
  });
});
