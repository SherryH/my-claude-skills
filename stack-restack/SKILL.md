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
- `restack set-parent <branch> <parent>` — fix/record a branch's parent.
- `restack detach <branch>` — re-parent onto `main` (make it independent).

`scripts/new-branch.sh <branch> [--base <ref>]` — create + stamp an in-worktree branch.

## Status

- ✅ **Slice 1** — topology (git-config) + `restack status` + set-parent/detach +
  create-worktree stamp + `new-branch`. (TS core, Vitest, 12 tests.)
- ⬜ Slice 2 — merge cascade engine (dry-run first).
- ⬜ Slice 3 — post-commit hook + detached spawn + `restack install`.
- ⬜ Slice 4 — AI conflict resolution (backup ref + `claude -p` + report).
- ⬜ Slice 5 — `restack review` (3-way merge editor) + `restack push`.

## Development

- `pnpm install`, `pnpm test` (Vitest), `pnpm type-check`.
- Tests run against throwaway repos in `mktemp -d` (`tests/sandbox.ts`) — **never**
  the real repo or live branches.
- Pure logic in `src/topology.ts` (unit-tested); git access in `src/adapter.ts`
  (sandbox integration tests).
