#!/usr/bin/env bash
# Create a git worktree with conventional-commit branch naming, current-branch
# default base ref, and auto-symlinked shared files (env + untracked planning docs).
#
# Usage:   create-worktree.sh <branch> [--base <ref>]
# Exit:    0 success | 2 invalid input | 3 environment error

set -euo pipefail

ALLOWED='feat|fix|chore|refactor|docs|test|perf'
BRANCH_RE="^(${ALLOWED})/[a-z0-9][a-z0-9-]+$"

usage() {
  cat <<EOF
Usage: $(basename "$0") <branch> [--base <ref>]

Branch must match: $BRANCH_RE
Defaults base to current branch (stacked-PR friendly). Pass --base to override.
EOF
}

BRANCH=""
BASE_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_OVERRIDE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) if [[ -z "$BRANCH" ]]; then BRANCH="$1"; shift; else echo "Extra arg: $1" >&2; exit 2; fi ;;
  esac
done

[[ -z "$BRANCH" ]] && { usage >&2; exit 2; }

if [[ ! "$BRANCH" =~ $BRANCH_RE ]]; then
  echo "Invalid branch name: $BRANCH" >&2
  echo "Must match: $BRANCH_RE" >&2
  exit 2
fi

# Resolve the MAIN worktree, not the current one. `rev-parse --show-toplevel` returns
# the *current* linked worktree when invoked from inside one, which nests new worktrees
# under it. `git worktree list` always prints the main working tree on its first line.
MAIN=$(/usr/bin/git worktree list --porcelain 2>/dev/null | sed -n 's#^worktree ##p' | head -n1 || true)
[[ -z "$MAIN" ]] && { echo "Not in a git repo (could not determine main worktree)" >&2; exit 3; }

CURRENT=$(/usr/bin/git -C "$MAIN" branch --show-current)
BASE_REF="${BASE_OVERRIDE:-$CURRENT}"
[[ -z "$BASE_REF" ]] && { echo "Could not determine base ref. Pass --base." >&2; exit 2; }

/usr/bin/git -C "$MAIN" rev-parse --verify "${BASE_REF}^{commit}" >/dev/null 2>&1 \
  || { echo "Base ref does not resolve: $BASE_REF" >&2; exit 2; }

# Check the actual worktree parent, not .claude itself: projects that track files
# under .claude/ (CLAUDE.md, memory, etc.) can never have `.claude` reported as
# ignored (git won't ignore a dir with tracked descendants), but `.claude/worktrees`
# can still be ignored — which is the condition we actually care about.
/usr/bin/git -C "$MAIN" check-ignore -q .claude/worktrees 2>/dev/null \
  || { echo ".claude/worktrees/ not gitignored — refusing to create (worktree files would be committable)" >&2; exit 3; }

ENCODED="${BRANCH/\//+}"
WORKTREE="$MAIN/.claude/worktrees/$ENCODED"
[[ -e "$WORKTREE" ]] && { echo "Worktree path already exists: $WORKTREE" >&2; exit 2; }

echo "Creating worktree:"
echo "  branch: $BRANCH"
echo "  base:   $BASE_REF"
echo "  path:   $WORKTREE"
/usr/bin/git -C "$MAIN" worktree add "$WORKTREE" -b "$BRANCH" "$BASE_REF"

# Run project setup-worktree.js if present (handles .env.local / .claude / CLAUDE.local.md)
if [[ -f "$MAIN/scripts/setup-worktree.js" ]]; then
  /usr/bin/env -C "$WORKTREE" node "$MAIN/scripts/setup-worktree.js" || true
fi

# Symlink untracked planning docs (idempotent)
link_if_missing() {
  local src="$1" lnk="$2"
  [[ -e "$src" ]] || return 0
  [[ -e "$lnk" || -L "$lnk" ]] && { echo "  skip (exists): $(basename "$lnk")"; return 0; }
  /bin/mkdir -p "$(dirname "$lnk")"
  /bin/ln -s "$src" "$lnk" && echo "  linked $(basename "$src") → main"
}

shopt -s nullglob
for src in "$MAIN"/ADR-*.md; do
  link_if_missing "$src" "$WORKTREE/$(basename "$src")"
done
shopt -u nullglob
link_if_missing "$MAIN/docs/superpowers" "$WORKTREE/docs/superpowers"

# Symlink shared .claude/ planning docs + config into the worktree's own .claude/.
#
# Why per-file instead of a whole-dir `.claude` symlink: when .claude/ contains any
# tracked file (e.g. a project that tracks .claude/.gitignore or .claude/memory/*),
# `git worktree add` checks those out and materialises a REAL .claude/ dir in the
# worktree — so a whole-dir symlink is impossible, and a project's
# scripts/setup-worktree.js `.claude` entry silently skips for the same reason
# ("skip if the link path already exists"). Linking each top-level entry lands the
# shared docs INSIDE that real dir. Idempotent, and safe whether .claude ends up a
# real dir or a whole-dir symlink (link_if_missing skips paths that already resolve).
#
# Excluded entries (per-worktree, git-managed, or recursive):
#   worktrees          — would point back at <main>/.claude/worktrees (infinite recursion)
#   memory             — git-tracked; checked out per worktree
#   settings.local.json — Claude Code's per-worktree local config (it writes here)
#   .gitignore         — git-tracked; provided per worktree
CLAUDE_SKIP_RE='^(worktrees|memory|settings\.local\.json|\.gitignore)$'
if [[ -d "$MAIN/.claude" && ! -L "$WORKTREE/.claude" ]]; then
  /bin/mkdir -p "$WORKTREE/.claude"
  shopt -s nullglob
  for src in "$MAIN"/.claude/*; do
    name=$(basename "$src")
    [[ "$name" =~ $CLAUDE_SKIP_RE ]] && { echo "  skip (excluded): .claude/$name"; continue; }
    link_if_missing "$src" "$WORKTREE/.claude/$name"
  done
  shopt -u nullglob
fi

# Verify expected symlinks resolve
echo ""
echo "=== Symlink check ==="
check_path() {
  local path="$1" rel="${1#"$WORKTREE"/}"
  if [[ -L "$path" ]]; then
    local target; target=$(/usr/bin/readlink "$path")
    if [[ -e "$path" ]]; then
      echo "  ok        $rel → $target"
    else
      echo "  BROKEN    $rel → $target (target missing)"
    fi
  elif [[ -e "$path" ]]; then
    echo "  file      $rel (regular file, not symlink — OK if project copies it)"
  else
    echo "  missing   $rel"
  fi
}
check_path "$WORKTREE/.env.local"
# .claude/ is a real dir holding per-file symlinks (see the .claude loop above);
# report each shared doc/config link rather than .claude itself.
shopt -s nullglob
claude_links=("$WORKTREE"/.claude/*)
shopt -u nullglob
for path in "${claude_links[@]}"; do
  [[ -L "$path" ]] && check_path "$path"
done
check_path "$WORKTREE/docs/superpowers"

# Pre-generate Next.js type declarations so the first commit's `tsc --noEmit`
# (pre-commit hook) doesn't fail on the gitignored next-env.d.ts, which declares
# static-asset imports (*.png, etc.) and typed routes. Fresh worktrees lack it.
# Next.js-only; needs deps present (this script doesn't install); never fatal.
if grep -Eq '"next":' "$WORKTREE/package.json" 2>/dev/null; then
  echo ""
  echo "=== Next.js typegen ==="
  if [[ -x "$WORKTREE/node_modules/.bin/next" ]]; then
    if /usr/bin/env -C "$WORKTREE" "$WORKTREE/node_modules/.bin/next" typegen >/dev/null 2>&1; then
      echo "  ok        next-env.d.ts + route types generated"
    else
      echo "  skip      'next typegen' failed (unsupported Next?) — run 'yarn next typegen' after install"
    fi
  else
    echo "  deferred  node_modules absent — run 'yarn next typegen' after 'yarn install'"
  fi
fi

echo ""
echo "Worktree ready: $WORKTREE"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE"
echo "  yarn install --frozen-lockfile   # (or your pkg manager)"
echo "  yarn test                         # baseline"
