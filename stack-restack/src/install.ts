import { appendFileSync, existsSync, mkdirSync, readFileSync, readlinkSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { git, gitOrNull } from './git.js';
import { readWorktrees } from './adapter.js';

const CANONICAL_SCRIPT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'post-commit-hook.sh'));

export interface InstallStep {
  location: string;
  action: 'installed' | 'already-installed' | 'skipped-foreign';
  detail?: string;
}

export interface InstallReport {
  mode: 'husky' | 'plain';
  steps: InstallStep[];
  excludeUpdated: boolean;
}

/** Symlink the canonical hook at `hookPath`, leaving foreign files/symlinks untouched. */
function installAt(hookPath: string): InstallStep {
  if (isSymlink(hookPath)) {
    const target = readlinkSync(hookPath);
    return target === CANONICAL_SCRIPT
      ? { location: hookPath, action: 'already-installed' }
      : { location: hookPath, action: 'skipped-foreign', detail: target };
  }
  if (existsSync(hookPath)) {
    return { location: hookPath, action: 'skipped-foreign', detail: 'regular file' };
  }
  mkdirSync(dirname(hookPath), { recursive: true });
  symlinkSync(CANONICAL_SCRIPT, hookPath);
  return { location: hookPath, action: 'installed' };
}

function isSymlink(path: string): boolean {
  try {
    readlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Ensure `info/exclude` (shared across all worktrees) ignores the husky hook file we symlink. */
function ensureExcluded(commonDir: string, line: string): boolean {
  const excludePath = join(commonDir, 'info', 'exclude');
  mkdirSync(dirname(excludePath), { recursive: true });
  const existing = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : '';
  if (existing.split('\n').includes(line)) return false;
  appendFileSync(excludePath, `${existing.endsWith('\n') || existing === '' ? '' : '\n'}${line}\n`);
  return true;
}

/**
 * Install the post-commit trigger: a symlink to the canonical hook script, placed
 * wherever git will actually run it — depends on `core.hooksPath`.
 */
export function installTrigger(repoDir: string): InstallReport {
  const commonDir = git(repoDir, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const hooksPath = gitOrNull(repoDir, 'config', '--get', 'core.hooksPath');

  if (!hooksPath) {
    const hookPath = join(commonDir, 'hooks', 'post-commit');
    return { mode: 'plain', steps: [installAt(hookPath)], excludeUpdated: false };
  }

  if (hooksPath !== '.husky/_') {
    throw new Error(`unsupported core.hooksPath: ${hooksPath}`);
  }

  const worktrees = readWorktrees(repoDir);
  const steps = worktrees.map((wt) => installAt(join(wt.path, '.husky', 'post-commit')));
  const excludeUpdated = ensureExcluded(commonDir, '.husky/post-commit');
  return { mode: 'husky', steps, excludeUpdated };
}

/** Render an install report as one `<action>  <location>` line per step. */
export function formatInstall(report: InstallReport): string {
  const lines = report.steps.map((s) => `${s.action}  ${s.location}${s.detail ? `  (${s.detail})` : ''}`);
  if (report.mode === 'husky') {
    lines.push(
      report.excludeUpdated
        ? 'info/exclude updated: .husky/post-commit'
        : 'info/exclude already contains: .husky/post-commit',
    );
  }
  return lines.join('\n');
}
