import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { newRepo, cleanupRepos, git } from './sandbox.js';

const CANONICAL_SCRIPT = resolve(import.meta.dirname, '..', 'scripts', 'post-commit-hook.sh');

/** Symlink the canonical hook into `repoDir`'s hooks dir, as `restack install` would. */
function installedHookPath(repoDir: string): string {
  const commonDir = git(repoDir, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const hookPath = join(commonDir, 'hooks', 'post-commit');
  mkdirSync(join(commonDir, 'hooks'), { recursive: true });
  symlinkSync(CANONICAL_SCRIPT, hookPath);
  return hookPath;
}

function logDir(repoDir: string): string {
  return join(git(repoDir, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'restack');
}

describe('post-commit-hook.sh safety', () => {
  afterEach(cleanupRepos);

  it('exits 0 without doing anything when RESTACK_CASCADE is set (recursion guard)', () => {
    const dir = newRepo();
    const hookPath = installedHookPath(dir);

    execFileSync('sh', ['-e', hookPath], { cwd: dir, env: { ...process.env, RESTACK_CASCADE: '1' } });

    expect(existsSync(logDir(dir))).toBe(false);
  });

  it('exits 0 without doing anything on a detached HEAD', () => {
    const dir = newRepo();
    const hookPath = installedHookPath(dir);
    git(dir, 'checkout', '--detach');

    execFileSync('sh', ['-e', hookPath], { cwd: dir, env: { ...process.env, RESTACK_CASCADE: '' } });

    expect(existsSync(logDir(dir))).toBe(false);
  });

  it('exits 0 without doing anything when the skill layout is broken (no ../bin/restack)', () => {
    const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'restack-hook-')));
    const dir = newRepo();
    try {
      const scriptCopy = join(tmp, 'post-commit-hook.sh');
      copyFileSync(CANONICAL_SCRIPT, scriptCopy);
      chmodSync(scriptCopy, 0o755);

      execFileSync('sh', ['-e', scriptCopy], { cwd: dir, env: { ...process.env, RESTACK_CASCADE: '' } });

      expect(existsSync(logDir(dir))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
