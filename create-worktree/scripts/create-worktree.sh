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

MAIN=$(/usr/bin/git rev-parse --show-toplevel 2>/dev/null) \
  || { echo "Not in a git repo" >&2; exit 3; }

CURRENT=$(/usr/bin/git -C "$MAIN" branch --show-current)
BASE_REF="${BASE_OVERRIDE:-$CURRENT}"
[[ -z "$BASE_REF" ]] && { echo "Could not determine base ref. Pass --base." >&2; exit 2; }

/usr/bin/git -C "$MAIN" rev-parse --verify "${BASE_REF}^{commit}" >/dev/null 2>&1 \
  || { echo "Base ref does not resolve: $BASE_REF" >&2; exit 2; }

/usr/bin/git -C "$MAIN" check-ignore -q .claude 2>/dev/null \
  || { echo ".claude/ not gitignored — refusing to create at .claude/worktrees/" >&2; exit 3; }

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

# Verify each expected symlink resolves
echo ""
echo "=== Symlink check ==="
for path in "$WORKTREE/.env.local" "$WORKTREE/.claude" "$WORKTREE/docs/superpowers"; do
  if [[ -L "$path" ]]; then
    target=$(/usr/bin/readlink "$path")
    if [[ -e "$path" ]]; then
      echo "  ok        $(basename "$path") → $target"
    else
      echo "  BROKEN    $(basename "$path") → $target (target missing)"
    fi
  elif [[ -e "$path" ]]; then
    echo "  file      $(basename "$path") (regular file, not symlink — OK if project copies it)"
  else
    echo "  missing   $(basename "$path")"
  fi
done

echo ""
echo "Worktree ready: $WORKTREE"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE"
echo "  yarn install --frozen-lockfile   # (or your pkg manager)"
echo "  yarn test                         # baseline"
