import { collectStatus, formatStatus } from './status.js';
import { setParent, detach } from './commands.js';
import { planCascadeForRepo, formatPlan } from './cascade.js';
import { git } from './git.js';

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
      fail(`unknown command: ${cmd ?? '(none)'}\ncommands: status, plan [branch], set-parent <b> <p>, detach <b>`);
  }
}

main();
