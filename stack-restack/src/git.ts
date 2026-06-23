import { execFileSync } from 'node:child_process';

/**
 * Run git in `cwd` and return trimmed stdout. Throws on non-zero exit (caller catches
 * where a non-zero status is expected, e.g. `config --get` on a missing key).
 */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Like `git`, but returns null instead of throwing on non-zero exit. */
export function gitOrNull(cwd: string, ...args: string[]): string | null {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}
