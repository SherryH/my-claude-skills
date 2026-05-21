---
name: create-worktree
description: Creates a git worktree with conventional-commit branch naming, current-branch as the default base ref (stacked-PR friendly), and auto-symlinked shared files (env config + `.claude/` + untracked planning docs like `ADR-*.md` and `docs/superpowers/`). Use when the user wants a worktree for parallel development, sets up a stacked PR, or says "create a worktree for X based on this branch". Not for when the user explicitly asks for the harness `EnterWorktree` tool — that has a different `baseRef` default.
---

# Create Worktree (personal)

## Quick start

```bash
~/.claude/skills/create-worktree/scripts/create-worktree.sh <branch> [--base <ref>]
```

Defaults base to the current branch's HEAD. Pass `--base origin/main` for a fresh start.

## When to invoke

User says any of:

- "create a worktree for `<branch>` (based on this branch)"
- "set up a worktree for PR2A.2 / `<next-PR>` / `<feature>`"
- triggers `using-git-worktrees` but asks to be done manually (not via harness `EnterWorktree`)

**Skip this skill** when the user explicitly says "use `EnterWorktree`" or "use the native worktree tool" — in that case follow `superpowers:using-git-worktrees` and use the native tool.

## How to run

1. Get the branch name from the user. Must match `^(feat|fix|chore|refactor|docs|test|perf)/[a-z0-9][a-z0-9-]+$`. If invalid, surface the error from the script and ask the user to pick a conforming name — do not "fix" their name silently.
2. Run the script via Bash tool: `~/.claude/skills/create-worktree/scripts/create-worktree.sh <branch>` (add `--base <ref>` only if user explicitly says so).
3. Read the `=== Symlink check ===` block at the end of stdout. Every line should start with `ok` (or `file` if the project copies an env file rather than symlinking — also acceptable). If any line starts with `BROKEN` or `missing`, stop and report.
4. Report the worktree path + branch + base to the user, plus the next-step hints already printed by the script (`cd …`, `yarn install --frozen-lockfile`, baseline test).

Worked example for `create a worktree feat/foo-bar based on this branch`:

```bash
~/.claude/skills/create-worktree/scripts/create-worktree.sh feat/foo-bar
# → .claude/worktrees/feat+foo-bar/ created on branch feat/foo-bar
# → base = current branch's HEAD
# → symlinks: .env.local, .claude/, ADR-*.md, docs/superpowers (if any exist in main)
```

## Pitfalls

- **VS Code shows `??` for symlinked untracked docs.** Not a failure — those docs are untracked in the main checkout too (by design). Tell the user the state matches main; symlinks resolve.
- **`.env.local` may appear as a regular file, not a symlink.** Happens when project setup ran a copy step before our symlink loop. Functionally fine — the script's `file` status reports this honestly.
- **`cd` via Bash tool fails on `_safe_eval` zsh setups.** The script uses `git -C` and `env -C` to avoid `cd`. Don't paste `cd` into Bash; just run the script.
- **User says "based on this branch" — that means current, not main.** The script's default already matches this. Only pass `--base` if the user names a different ref.
- **Symlinked `.claude/` looks like infinite recursion** (worktree lives at `<main>/.claude/worktrees/X` and has a `.claude` symlink back to main). Harmless — nothing traverses it; leave it.

## What this skill does NOT do

- Does not run `yarn install` (slow; user may want to defer)
- Does not run baseline tests
- Does not commit or push anything
- Does not rename existing worktrees that violate the convention (historical; out of scope)

## Anti-patterns

- Don't auto-fix invalid branch names. Reject with the regex, ask user to pick.
- Don't add a `scripts/create-worktree.js` or a `yarn worktree:create` entry to the project repo — this is a personal skill, kept out of project source.
- Don't extend the SHARED_UNTRACKED_DOCS list inside the script for every new project's pet docs. If a project has a different planning-doc pattern, the user can `ln -s` manually after the script runs.

## Related

- `superpowers:using-git-worktrees` — umbrella skill. This is its manual-creation alternative for the stacked-PR case where harness `EnterWorktree`'s `baseRef=fresh` default is wrong.
