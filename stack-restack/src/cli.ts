import { collectStatus, formatStatus } from './status.js';
import { setParent, detach } from './commands.js';
import { planCascadeForRepo, formatPlan, executeCascadeForRepo, formatExec } from './cascade.js';
import { LockHeldError } from './lock.js';
import { git } from './git.js';
import { installTrigger, formatInstall } from './install.js';

const WAIT_MS = 60_000;

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}

function main(): void {
  const [cmd, ...args] = process.argv.slice(2);
  const cwd = process.cwd();

  switch (cmd) {
    case 'status': {
      const roots = collectStatus(cwd);
      console.log(roots.length ? formatStatus(roots) : 'No branches.');
      return;
    }
    case 'plan': {
      // Dry-run: show what a cascade from <branch> (default: current branch) would do.
      const from = args[0] ?? git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
      console.log(formatPlan(planCascadeForRepo(cwd, from)));
      return;
    }
    case 'run': {
      // Perform the cascade from <branch> (default: current branch). Local-only, no push.
      // --wait: coalesce with a cascade already in flight instead of failing fast (the
      // post-commit hook uses this so a burst of commits doesn't drop later cascades).
      const wait = args.includes('--wait');
      const positional = args.filter((a) => a !== '--wait');
      const from = positional[0] ?? git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
      console.log(`restack run: cascading from ${from}`);
      try {
        const opts = wait ? { waitMs: WAIT_MS } : undefined;
        console.log(formatExec(executeCascadeForRepo(cwd, from, opts)));
      } catch (err) {
        if (err instanceof LockHeldError) fail(err.message);
        throw err;
      }
      return;
    }
    case 'install': {
      try {
        console.log(formatInstall(installTrigger(cwd)));
      } catch (err) {
        if (err instanceof Error) fail(err.message);
        throw err;
      }
      return;
    }
    case 'set-parent': {
      const [branch, parent] = args;
      if (!branch || !parent) fail('usage: restack set-parent <branch> <parent>');
      setParent(cwd, branch, parent);
      console.log(`${branch}: restackParent -> ${parent}`);
      return;
    }
    case 'detach': {
      const [branch] = args;
      if (!branch) fail('usage: restack detach <branch>');
      detach(cwd, branch);
      console.log(`${branch}: detached (restackParent -> main)`);
      return;
    }
    default:
      fail(
        `unknown command: ${cmd ?? '(none)'}\ncommands: status, plan [branch], run [branch] [--wait], install, set-parent <b> <p>, detach <b>`,
      );
  }
}

main();
