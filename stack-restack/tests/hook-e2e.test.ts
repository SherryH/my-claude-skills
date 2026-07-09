import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { newRepo, cleanupRepos, git } from './sandbox.js';
import { installTrigger } from '../src/install.js';
import { isMerged } from '../src/adapter.js';

/** Stamp `child`'s restackParent. */
function stamp(dir: string, child: string, parent: string): void {
  git(dir, 'config', `branch.${child}.restackParent`, parent);
}

async function pollUntil(check: () => boolean, timeoutMs: number, intervalMs = 250): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('poll timed out');
}

describe('post-commit hook end-to-end cascade', () => {
  afterEach(cleanupRepos);

  it(
    'a real commit spawns a detached cascade that reaches the leaf, without recursing on its own merges',
    async () => {
      const dir = newRepo();
      git(dir, 'branch', 'a');
      stamp(dir, 'a', 'main');
      git(dir, 'branch', 'b', 'a');
      stamp(dir, 'b', 'a');
      git(dir, 'branch', 'c', 'b');
      stamp(dir, 'c', 'b');

      // Diverge b before installing the hook: the cascade's a→b merge must then be a REAL
      // merge commit, which fires post-commit in the temp worktree — the recursion-guard
      // assertion below is only meaningful if that firing actually happens (an all-FF
      // cascade creates no commits and would pass it vacuously).
      git(dir, 'checkout', 'b');
      writeFileSync(`${dir}/file-b.txt`, 'b change\n');
      git(dir, 'add', 'file-b.txt');
      git(dir, 'commit', '-m', 'b1');
      git(dir, 'checkout', 'a');

      installTrigger(dir);

      writeFileSync(`${dir}/file.txt`, 'change\n');
      git(dir, 'add', 'file.txt');
      git(dir, 'commit', '-m', 'a1'); // fires the installed post-commit hook

      await pollUntil(() => isMerged(dir, 'a', 'b'), 20_000);
      await pollUntil(() => isMerged(dir, 'a', 'c'), 20_000);

      // Prove the non-FF path really happened: b must carry a merge commit.
      expect(git(dir, 'rev-list', '--merges', 'b')).not.toBe('');

      const commonDir = git(dir, 'rev-parse', '--path-format=absolute', '--git-common-dir');
      const logPath = `${commonDir}/restack/cascade.log`;
      expect(existsSync(logPath)).toBe(true);

      // Quiet period: give any wrongly-recursed cascade a chance to show up before asserting.
      await new Promise((r) => setTimeout(r, 2_000));
      const log = readFileSync(logPath, 'utf8');
      const headerCount = log.split('\n').filter((l) => l.includes('restack run: cascading from')).length;
      expect(headerCount).toBe(1);
    },
    30_000,
  );
});
