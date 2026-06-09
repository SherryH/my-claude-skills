---
name: create-pr
description: Use when creating a pull request with auto-generated description based on branch changes. Handles shell escaping issues by writing the body to a temp file via the Write tool, detects stacked-PR bases, and pulls in Linear/GitHub issue context.
allowed-tools: Bash(gh:*)
---

# Create PR with Auto-Generated Description

Opens a GitHub PR with a structured description generated from the branch's changes.

`allowed-tools: Bash(gh:*)` auto-grants `gh` (including writes like `gh pr create` / `gh api` PATCH) **only while this skill runs** — prompt-free here, still gated everywhere else (least privilege). Do not add `gh` writes to global `settings.json`.

> Shell is zsh under scm_breeze: `&&` / compound commands and `cat` / `echo` can fail with `_safe_eval` errors, and shell file writes (heredoc / `cat` / `echo`) silently produce **0-byte files**. Write the PR body with the **Write tool**, never the shell. See [REFERENCE.md](REFERENCE.md) for the why behind each guardrail.

## Step 1: Preflight — one bash block, not five

One block gives branch, repo, base, push-state, and any existing PR in a single round-trip. Adjust `DEFAULT_BASE` only if the repo's default branch isn't `main`.

```bash
BRANCH=$(git branch --show-current); DEFAULT_BASE=main
echo "branch: $BRANCH"
echo "repo:   $(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "default-base: $(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)"
echo "vs $DEFAULT_BASE (behind ahead): $(git rev-list --left-right --count $DEFAULT_BASE...HEAD)"
echo "pushed: $(git ls-remote --heads origin "$BRANCH" | wc -l | tr -d ' ')"  # 0 = needs push
echo "existing PR:"; gh pr list --head "$BRANCH" --json number,baseRefName,url --jq '.[]'
echo "open PRs (stacked-base detection):"; gh pr list --state open --json number,headRefName,baseRefName --jq '.[] | "\(.number) \(.headRefName) -> \(.baseRefName)"'
```

- `existing PR` non-empty → **stop**; update that PR instead of creating a duplicate.
- `pushed: 0` → push first: `git push -u origin "$BRANCH"`.

## Step 2: Pick the base (don't assume `main`)

Stacked branches need their **parent** as the base. Detect it:

```bash
for b in $(gh pr list --state open --json headRefName --jq '.[].headRefName'); do
  [ "$b" = "$BRANCH" ] && continue
  if git merge-base --is-ancestor "origin/$b" HEAD 2>/dev/null; then echo "STACKED on: $b — use this as --base"; fi
done
```

- No "STACKED on" line → `BASE=$DEFAULT_BASE`.
- "STACKED on `<branch>`" → `BASE=<branch>`, and diff with `git diff <branch>...HEAD` when analyzing.

## Step 3: Fetch issue context (if the arg is an issue URL)

If invoked with an issue URL, fetch it to seed real **Background** and **Related Links** instead of inventing them:

- **Linear** (`linear.app/.../issue/ABC-123/...`): Linear MCP `get_issue` with the `ABC-123` identifier.
- **GitHub** (`github.com/owner/repo/issues/N`): `gh issue view N --json title,body`.

## Step 4: Analyze branch changes

Use `$BASE` from Step 2:

```bash
git log $BASE..HEAD --oneline
git diff $BASE...HEAD --stat
git log $BASE..HEAD --pretty=format:"%s%n%b"
```

## Step 5: Generate the description

Prefer a project template if one exists (`.github/PULL_REQUEST_TEMPLATE/feature.md`, `.github/PULL_REQUEST_TEMPLATE.md`, or `…/bugfix.md`). Otherwise use this:

```markdown
## Background (Why)

[Problem being solved. Seed from the fetched issue if present.]

## Implementation Approach (How)

[Technical approach and key architectural decisions.]

## Changes Made

- [x] Change 1
- [x] Change 2

### Screenshots or Video References

[N/A or add references]

### Testing Verification

- [x] Test scenario 1

## Additional Notes

[Known limitations, future work, deferred scope.]

## Related Links

- [Issue URL, related PRs]
```

## Step 6: Write the body — delete first, then Write

```bash
rm -f /tmp/pr-body.md
```

`rm -f` **before** the Write: a leftover file from a prior PR forces a Read-before-overwrite (Write refuses to overwrite an unread file) and risks pasting the old PR's description. Deleting first makes every Write a fresh create.

Then write `/tmp/pr-body.md` with the **Write tool** — **never** shell heredoc / `cat` / `echo` (silent 0-byte file). Verify:

```bash
wc -c /tmp/pr-body.md   # must be > 0
```

## Step 7: Create the PR

```bash
gh pr create --base "$BASE" --head "$BRANCH" --title "PR Title" --body-file /tmp/pr-body.md
```

## Step 8: Verify body — one call, conditional fallback

```bash
gh api repos/{owner}/{repo}/pulls/{number} --jq '.body | length'   # expect > 0
```

- **> 0** → done.
- **0 or error** → body didn't attach; run the Python urllib PATCH fallback (handles encoding `gh api -F body=@file` mishandles). See [REFERENCE.md](REFERENCE.md#python-urllib-fallback).

## Step 9: Clean up

```bash
rm -f /tmp/pr-body.md   # next PR starts clean (no Read-before-Write)
```

Return the PR URL.
