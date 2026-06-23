import { collectStatus, formatStatus } from './status.js';
import { setParent, detach } from './commands.js';

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
      fail(`unknown command: ${cmd ?? '(none)'}\ncommands: status, set-parent <b> <p>, detach <b>`);
  }
}

main();
