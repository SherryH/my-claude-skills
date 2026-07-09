---
name: stack-restack
description: Auto-propagate (merge, not rebase) updates down a stack of dependent branches across git worktrees, triggered on commit. Use to view a stack (`restack status`), set/clear stack parents, and (later slices) cascade merges + AI-assisted conflict resolution.
---

# stack-restack

Keeps a stack of dependent feature branches up to date when an earlier branch
changes — by **merging** the parent into each child (preserves SHAs, no force-push,
review-safe), across multiple worktrees. Full design + rationale: the design doc in
the consuming repo's `.claude/stack-restack-DESIGN.md`.

## Topology model

The stack is recorded in git config: `branch.<name>.restackParent`. It's stamped
automatically at branch creation:

- **New worktree:** `create-worktree.sh` stamps `restackParent = <base ref>`.
- **In-place branch:** `scripts/new-branch.sh <branch> [--base <ref>]` (default base =
  current branch) creates the branch in the current worktree and stamps it.

A branch whose parent is `main` (or any non-managed ref) is a **stack root**.

## Commands (Slice 1 — shipped)

Run via `bin/restack` (put it on your PATH, or call by absolute path):

- `restack status` — print the stack forest: branch · clean/dirty · worktree.
- `restack plan [branch]` — **dry-run**: show what a cascade from `branch` (default: current
  branch) would do per descendant — `merge` · `up-to-date` · `skip-dirty` · `blocked`.
- `restack run [branch]` — **execute** the cascade from `branch` (default: current branch):
  merge each clean descendant's parent in, top-down. Local-only (no push); serialised under a
  per-repo lock; dirty branches are skipped and block their subtree; conflicts abort clean and
  are deferred to Slice 4. Per-step outcome: `merged` · `up-to-date` · `skip-dirty` · `blocked`
  · `conflict` · `error`.
- `restack set-parent <branch> <parent>` — fix/record a branch's parent.
- `restack detach <branch>` — re-parent onto `main` (make it independent).
- `restack install` — symlink the canonical post-commit hook (`scripts/post-commit-hook.sh`)
  into place: `<git-common-dir>/hooks/post-commit` in plain mode, or `.husky/post-commit`
  per worktree (plus an `info/exclude` entry) when `core.hooksPath` is `.husky/_`. Leaves any
  pre-existing foreign hook/symlink untouched (`skipped-foreign`). `create-worktree.sh` calls
  this automatically for every new worktree.
- `restack run [branch] [--wait]` — as above; `--wait` polls for up to 60s to join a cascade
  already in flight instead of failing fast (used by the post-commit hook so a burst of
  commits doesn't drop a run).

`scripts/new-branch.sh <branch> [--base <ref>]` — create + stamp an in-worktree branch.

## Status

- ✅ **Slice 1** — topology (git-config) + `restack status` + set-parent/detach +
  create-worktree stamp + `new-branch`. (TS core, Vitest, 12 tests.)
- ✅ **Slice 2** — merge cascade engine. **Dry-run** (`restack plan`): pure planner in
  `src/cascade.ts` + `isMerged` ancestry in `adapter.ts`. **Executor** (`restack run`):
  `executeCascade` (pure walk, block-propagation off real outcomes) + `mergeInto` in
  `adapter.ts` (up-to-date short-circuit, per-worktree merge, temp-worktree for un-checked-out
  branches, abort-clean on conflict) + per-repo `withLock` (`src/lock.ts`) + `executeCascadeForRepo`.
  Local-only, no force-push. 42 tests.
- ✅ **Slice 3** — commit-triggered cascade. `restack install` (`src/install.ts`) symlinks a
  canonical hook (`scripts/post-commit-hook.sh`) into plain `.git/hooks` or per-worktree
  `.husky/post-commit`; the hook spawns `restack run --wait` detached (`nohup … &`) so commits
  stay instant, and unsets the `GIT_DIR`/`GIT_WORK_TREE`/etc. env git injects into hooks (they'd
  hijack the cascade's git calls in other worktrees). Two-layer recursion guard so the cascade's
  own merge commits don't re-trigger: the hook checks `RESTACK_CASCADE` before spawning, and
  `executeCascadeForRepo` sets it so child git processes inherit it. Lock hardened with PID-stale
  detection (`withLock` reclaims a lock left by a dead PID) and `--wait` coalescing (poll until
  free or a deadline); acquisition stages the PID then hard-links it into place, so a visible
  lock always carries its holder's PID and a concurrent stale-check can't reclaim a live one.
  56 tests.
- ⬜ Slice 4 — AI conflict resolution (backup ref + `claude -p` + report).
- ⬜ Slice 5 — `restack review` (3-way merge editor) + `restack push`.

## Development

- `pnpm install`, `pnpm test` (Vitest), `pnpm type-check`.
- Tests run against throwaway repos in `mktemp -d` (`tests/sandbox.ts`) — **never**
  the real repo or live branches.
- Pure logic in `src/topology.ts` (unit-tested); git access in `src/adapter.ts`
  (sandbox integration tests).
