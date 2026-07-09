#!/bin/sh
# Canonical post-commit hook, symlinked into place by `restack install`. Every
# failure path here must exit 0 — a commit trigger must never break or slow a commit.
set -e

if [ -n "$RESTACK_CASCADE" ]; then
  # A cascade's own merge commits fire this hook in other worktrees; don't recurse.
  exit 0
fi

SRC="$0"
while [ -L "$SRC" ]; do SRC="$(readlink "$SRC")"; done
SKILL_DIR="$(dirname "$SRC")/.."
RESTACK="$SKILL_DIR/bin/restack"

if [ ! -x "$RESTACK" ]; then
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || exit 0
if [ -z "$BRANCH" ]; then
  exit 0
fi
if [ "$BRANCH" = "HEAD" ]; then
  exit 0
fi

LOG_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/restack" || exit 0
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0

# git exports these into hooks; left set, they'd hijack every git call the detached
# cascade makes once it borrows temp worktrees at OTHER paths (git prefers the env
# vars over cwd-based discovery), pointing them all back at this checkout's .git.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX

nohup "$RESTACK" run --wait "$BRANCH" >>"$LOG_DIR/cascade.log" 2>&1 &

exit 0
