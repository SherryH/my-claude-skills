import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
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
});
