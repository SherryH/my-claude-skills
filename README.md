# Claude Code Personal Skills

Personal skills synced via Git.

## Skills Included

| Skill | Description |
|-------|-------------|
| `pr-review` | Code quality review for TS/React/Node/CSS PRs |
| `pr-analyze` | Architectural analysis for PRs (WHY/HOW/WHAT) |

## Setup on New Machine

```bash
# Backup existing skills (if any)
mv ~/.claude/skills ~/.claude/skills.backup 2>/dev/null

# Clone this repo
git clone git@github.com:SherryH/my-claude-skills.git ~/.claude/skills

# Verify
ls ~/.claude/skills/
```

## Daily Sync

```bash
# Pull latest
cd ~/.claude/skills && git pull

# Push changes
cd ~/.claude/skills && git add . && git commit -m "update" && git push
```

Or use the helper scripts:
```bash
~/.claude/skills/.sync-pull.sh   # Pull latest
~/.claude/skills/.sync-push.sh   # Push changes
```

## Adding New Skills

1. Create skill in `~/.claude/skills/<skill-name>/SKILL.md`
2. Test with `/<skill-name>` in Claude Code
3. Commit: `git add . && git commit -m "feat: add <skill-name> skill" && git push`
