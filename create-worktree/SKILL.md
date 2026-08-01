---
name: create-worktree
description: Creates a git worktree with conventional-commit branch naming, current-branch as the default base ref (stacked-PR friendly), and auto-symlinked shared files (env config + the shared contents of `.claude/` — CLAUDE.md, CONTEXT.md, decisions.md, ADR-*.md, agents/, plans/, etc. — plus root-level `ADR-*.md`/`docs/superpowers/`). Accepts either a branch name or a bare issue-tracker ticket ID (e.g. `EZTP-442`) — for a ticket ID it fetches the issue and derives a sensible branch name. Finishes by switching the session into the new worktree via harness `EnterWorktree {path}`. Use when the user wants a worktree for parallel development, sets up a stacked PR, or says "create a worktree for X based on this branch". Not for when the user explicitly asks for the harness `EnterWorktree` tool alone — that creates its own worktree with a different `baseRef` default.
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
- `/create-worktree EZTP-442` — a bare ticket ID (derive the branch name from the issue; see step 1)
- triggers `using-git-worktrees` but asks to be done manually (not via harness `EnterWorktree`)

**Skip this skill** when the user explicitly says "use `EnterWorktree`" or "use the native worktree tool" — in that case follow `superpowers:using-git-worktrees` and use the native tool.

## How to run

1. Resolve the branch name:
   - **User gave a branch name** — must match `^(feat|fix|hotfix|chore|refactor|docs|test|perf)/[a-z0-9][a-z0-9/-]*[a-z0-9]$` (ticket-scoped names like `hotfix/eztp-443/desc` allowed). If invalid, surface the error from the script and ask the user to pick a conforming name — do not "fix" their name silently.
   - **User gave a bare ticket ID** (matches `^[A-Za-z]+-\d+$`, e.g. `EZTP-442`): fetch the issue from the project's issue tracker (this repo: Linear MCP `get_issue`; config in `.claude/agents/issue-tracker.md`). Derive the branch as `<type>/<ticket-lowercase>-<slug>`:
     - `<type>`: `fix` for Bug-labeled issues, `refactor`/`chore`/`docs`/`test` when the title clearly says so, otherwise `feat`.
     - `<slug>`: the issue title, kebab-cased, trimmed to ≤5 meaningful words (drop filler like "the/a/for"), conforming to the regex above. E.g. EZTP-442 "Drop legacy v1 pages columns" → `refactor/eztp-442-drop-v1-pages-columns`.
     - Don't ask for confirmation — state the derived branch name in the final report. Remember one-ticket-per-worktree.
     - If the issue fetch fails (e.g. Linear MCP token lapsed — re-auth via `/mcp`), say so and ask the user for a 2–5 word description instead. Never invent a slug blind, and never silently fall back to a bare `feat/eztp-442`.
2. Run the script via Bash tool: `~/.claude/skills/create-worktree/scripts/create-worktree.sh <branch>` (add `--base <ref>` only if user explicitly says so).
3. Read the `=== Symlink check ===` block at the end of stdout. Every line should start with `ok` (or `file` if the project copies an env file rather than symlinking — also acceptable). If any line starts with `BROKEN` or `missing`, stop and report.
4. Report the worktree path + branch + base to the user, plus the next-step hints already printed by the script (`cd …`, `yarn install --frozen-lockfile`, baseline test).
5. **Enter the worktree.** Switch the session into it with the harness `EnterWorktree` tool, passing the new worktree's **absolute path** as `path` (never `name` — that would create a second, unrelated worktree). This moves the session's working directory, file tools included, into the worktree. Skip only if the user explicitly asked to stay put, or when batch-creating several worktrees (then enter the one the user wants to work in, or none). Notes: `path` entry requires the worktree to live under `.claude/worktrees/` of this repo (the script guarantees that); `ExitWorktree` never deletes a worktree entered via `path` — `action:"keep"` just returns to the original directory.
6. **Next.js projects** — read the `=== Next.js typegen ===` block if present. The script auto-runs `next typegen` when `node_modules` is already there, pre-generating the gitignored `next-env.d.ts` (+ route types) so the first commit's `tsc --noEmit` pre-commit hook doesn't fail on `*.png`/typed-route imports in files you didn't touch. If it prints `deferred` (deps not installed yet), tell the user to run `yarn next typegen` after `yarn install`. Non-Next projects print nothing.

Worked example for `create a worktree feat/foo-bar based on this branch`:

```bash
~/.claude/skills/create-worktree/scripts/create-worktree.sh feat/foo-bar
# → .claude/worktrees/feat+foo-bar/ created on branch feat/foo-bar
# → base = current branch's HEAD
# → symlinks: .env.local, shared .claude/* (CLAUDE.md, CONTEXT.md, decisions.md,
#             ADR-*.md, agents/, plans/, settings.json, …), root ADR-*.md,
#             docs/superpowers (whichever exist in main)
```

## How `.claude/` sharing works

The shared contents of `<main>/.claude/` are symlinked **per-file** into the worktree's own `.claude/` — not as a single whole-dir `.claude` symlink. This is deliberate: any project that tracks a file under `.claude/` (this repo tracks `.claude/.gitignore` + `.claude/memory/*`) makes `git worktree add` check those out, materialising a **real** `.claude/` dir in the worktree, so a whole-dir symlink is impossible. (A project's `scripts/setup-worktree.js` that lists `.claude` in its shared-files array silently skips for exactly this reason — its "skip if the link path already exists" guard fires.) Per-file linking lands the shared docs inside that real dir regardless.

Excluded from sharing (edit `CLAUDE_SKIP_RE` in the script to change): `worktrees` (would recurse back into `<main>/.claude/worktrees`), `memory` (git-tracked, per-worktree), `settings.local.json` (Claude Code's per-worktree local config), `.gitignore` (git-tracked). Everything else under `.claude/` — including `settings.json` and `skills/` — is shared, so edits in any worktree hit the single source of truth in main.

## Pitfalls

- **VS Code shows `??` for symlinked untracked docs.** Not a failure — those docs are untracked in the main checkout too (by design). Tell the user the state matches main; symlinks resolve.
- **`.env.local` may appear as a regular file, not a symlink.** Happens when project setup ran a copy step before our symlink loop. Functionally fine — the script's `file` status reports this honestly.
- **`cd` via Bash tool.** scm_breeze shell breakage was fixed 2026-07-07 (guarded in `~/.zshrc`); no special command shapes needed. If `_safe_eval` errors appear, the session predates the fix — restart it. The script uses `git -C` and `env -C` to avoid `cd` regardless — just run the script.
- **User says "based on this branch" — that means current, not main.** The script's default already matches this. Only pass `--base` if the user names a different ref.
- **`.claude/` is a real dir in the worktree, with per-file symlinks inside it** (not a whole-dir symlink — see "How `.claude/` sharing works"). VS Code/git show its symlinked docs as `??`; that's expected. The worktree's own `settings.local.json` / `memory/` stay real (not shared).
- **No recursion**, because `worktrees` is excluded from `.claude/` sharing. If you ever widen `CLAUDE_SKIP_RE`, never let `worktrees` through — `<wt>/.claude/worktrees → <main>/.claude/worktrees` (which contains the worktree) is an infinite loop.

## What this skill does NOT do

- Does not run `yarn install` (slow; user may want to defer)
- Does not run baseline tests
- Does not commit or push anything
- Does not rename existing worktrees that violate the convention (historical; out of scope)

## Anti-patterns

- Don't auto-fix invalid branch names. Reject with the regex, ask user to pick.
- Don't add a `scripts/create-worktree.js` or a `yarn worktree:create` entry to the project repo — this is a personal skill, kept out of project source.
- Don't hardcode project-specific doc names in the script. The `.claude/` loop already shares *everything* under `.claude/` except the `CLAUDE_SKIP_RE` blocklist, so new planning docs are picked up automatically — no per-project edits needed.
- Don't edit a project's committed `scripts/setup-worktree.js` to fix `.claude` sharing. That's tracked source (a commit + teammate impact); this personal skill handles it without touching the repo.

## Related

- `superpowers:using-git-worktrees` — umbrella skill. This is its manual-creation alternative for the stacked-PR case where harness `EnterWorktree`'s `baseRef=fresh` default is wrong.
