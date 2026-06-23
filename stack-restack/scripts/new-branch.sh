#!/usr/bin/env bash
# Create a branch in the CURRENT worktree and stamp its stack parent (restackParent),
# so stack-restack knows the topology. The in-worktree twin of create-worktree.sh.
#
# Usage:   new-branch.sh <branch> [--base <ref>]
# Default base = the branch currently checked out here (stacked-PR friendly).
# Exit:    0 success | 2 invalid input | 3 environment error

set -euo pipefail

ALLOWED='feat|fix|chore|refactor|docs|test|perf'
BRANCH_RE="^(${ALLOWED})/[a-z0-9][a-z0-9-]+$"

usage() {
  echo "Usage: $(basename "$0") <branch> [--base <ref>]" >&2
  echo "Branch must match: $BRANCH_RE" >&2
}

BRANCH="" BASE_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_OVERRIDE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) if [[ -z "$BRANCH" ]]; then BRANCH="$1"; shift; else echo "Extra arg: $1" >&2; exit 2; fi ;;
  esac
done

[[ -z "$BRANCH" ]] && { usage; exit 2; }
[[ "$BRANCH" =~ $BRANCH_RE ]] || { echo "Invalid branch name: $BRANCH" >&2; usage; exit 2; }

/usr/bin/git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || { echo "Not inside a git worktree" >&2; exit 3; }

CURRENT=$(/usr/bin/git symbolic-ref --short HEAD 2>/dev/null || true)
BASE_REF="${BASE_OVERRIDE:-$CURRENT}"
[[ -z "$BASE_REF" ]] && { echo "Could not determine base ref (detached HEAD?). Pass --base." >&2; exit 2; }

/usr/bin/git rev-parse --verify "${BASE_REF}^{commit}" >/dev/null 2>&1 \
  || { echo "Base ref does not resolve: $BASE_REF" >&2; exit 2; }

/usr/bin/git show-ref --verify --quiet "refs/heads/$BRANCH" \
  && { echo "Branch already exists: $BRANCH" >&2; exit 2; }

/usr/bin/git checkout -b "$BRANCH" "$BASE_REF"
/usr/bin/git config "branch.$BRANCH.restackParent" "$BASE_REF"
echo "Created $BRANCH (stacked on $BASE_REF)"
