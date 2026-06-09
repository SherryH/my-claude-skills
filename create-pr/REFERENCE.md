# create-pr — Reference

Rationale and the rare-path fallback. The happy path lives in [SKILL.md](SKILL.md); read this only when a guardrail trips or the body-length verify returns 0.

## Why each guardrail exists

- **Delete before Write, not just after.** A crashed prior run leaves a stale `/tmp/pr-body.md`. Deleting *before* writing makes Write a fresh create every time — no Read round-trip, and no risk of pasting a previous PR's description.
- **Shell file writes fail silently.** Under scm_breeze, `_safe_eval` / `scmb` intercept `cat` / `echo` / heredocs and emit a **0-byte file with no error**. Always use the Write tool for the body. The same wrapper makes `&&` and compound commands flaky — keep bash blocks simple.
- **`gh` is skill-scoped, not global.** The `allowed-tools: Bash(gh:*)` frontmatter (kebab-case — the documented field; `allowedTools:` / `allowedPrompts:` are inert) elevates `gh`, including writes, **only while this skill runs**, then normal prompting resumes. This keeps `gh pr create` / `gh api` PATCH gated in ordinary sessions (least privilege). Do **not** add `gh` writes to global `settings.json`.
- **Base ≠ always main.** Stacked PRs misattribute their whole diff if based on `main`. Detect the parent branch by open-PR ancestry (SKILL.md Step 2) and diff `git diff <parent>...HEAD`.
- **Conditional fallback only.** The Python PATCH is for the rare case where `gh api -F body=@file` mishandles content; running it unconditionally wastes a call. Only run it when the Step 8 verify returns 0.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Read-then-overwrite of stale `/tmp/pr-body.md` | `rm -f` BEFORE Write — fresh create, no Read needed |
| Assuming `main` as base on a stacked branch | Detect parent via open-PR ancestry (Step 2) |
| Writing body via heredoc / `cat` / `echo` | Always the Write tool — shell aliases produce 0-byte files |
| Five separate preflight calls | One bash block (Step 1) |
| Always running the Python fallback | Only when the Step 8 verify returns 0 |
| Duplicate PR | Check `gh pr list --head "$BRANCH"` in preflight; update instead |

## Python urllib fallback

Run **only** if the Step 8 body-length verify returned 0 (or errored). `urllib.request` with `json.dumps({'body': content})` encodes the body correctly where `gh api -F body=@file` does not. Replace `{owner}`, `{repo}`, `{number}`.

```bash
python3 -c "
import json, urllib.request, subprocess
token = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True).stdout.strip()
with open('/tmp/pr-body.md') as f: body = f.read()
data = json.dumps({'body': body}).encode('utf-8')
req = urllib.request.Request(
    'https://api.github.com/repos/{owner}/{repo}/pulls/{number}',
    data=data, method='PATCH',
    headers={'Authorization': f'token {token}', 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json; charset=utf-8'}
)
print('Body length:', len(json.loads(urllib.request.urlopen(req).read()).get('body', '')))
"
```
