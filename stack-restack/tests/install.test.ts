import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { newRepo, addWorktree, cleanupRepos, git } from './sandbox.js';
import { installTrigger } from '../src/install.js';

const RESTACK_BIN = resolve(import.meta.dirname, '..', 'bin', 'restack');

describe('installTrigger', () => {
  afterEach(cleanupRepos);

  it('plain mode: symlinks the canonical hook into <common>/hooks/post-commit', () => {
    const dir = newRepo();

    const report = installTrigger(dir);

    expect(report.mode).toBe('plain');
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.action).toBe('installed');
    const hookPath = `${git(dir, 'rev-parse', '--path-format=absolute', '--git-common-dir')}/hooks/post-commit`;
    expect(lstatSync(hookPath).isSymbolicLink()).toBe(true);
    const target = readlinkSync(hookPath);

    const second = installTrigger(dir);

    expect(second.steps[0]?.action).toBe('already-installed');
    expect(readlinkSync(hookPath)).toBe(target);
  });

  it('husky mode: symlinks the hook into every worktree and stamps info/exclude once', () => {
    const dir = newRepo();
    git(dir, 'config', 'core.hooksPath', '.husky/_');
    mkdirSync(`${dir}/.husky`, { recursive: true });
    git(dir, 'branch', 'a');
    const wt = addWorktree(dir, 'a');

    installTrigger(dir);
    installTrigger(dir);

    expect(lstatSync(`${dir}/.husky/post-commit`).isSymbolicLink()).toBe(true);
    expect(lstatSync(`${wt}/.husky/post-commit`).isSymbolicLink()).toBe(true);

    const commonDir = git(dir, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    const exclude = readFileSync(`${commonDir}/info/exclude`, 'utf8');
    const occurrences = exclude.split('\n').filter((l) => l === '.husky/post-commit').length;
    expect(occurrences).toBe(1);
  });

  it('leaves a foreign hook (regular file) untouched and reports skipped-foreign', () => {
    const dir = newRepo();
    git(dir, 'config', 'core.hooksPath', '.husky/_');
    mkdirSync(`${dir}/.husky`, { recursive: true });
    writeFileSync(`${dir}/.husky/post-commit`, '#!/bin/sh\necho mine\n');

    const report = installTrigger(dir);

    expect(report.steps[0]?.action).toBe('skipped-foreign');
    expect(readFileSync(`${dir}/.husky/post-commit`, 'utf8')).toBe('#!/bin/sh\necho mine\n');
  });

  it('`restack install` (CLI) prints the formatted report', () => {
    const dir = newRepo();

    const output = execFileSync(RESTACK_BIN, ['install'], { cwd: dir, encoding: 'utf8' });

    expect(output).toContain('installed');
    expect(output).toContain('hooks/post-commit');
  });
});
