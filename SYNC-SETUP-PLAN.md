# Claude Code Skills Sync Implementation Plan (Option 2: Direct Git)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable syncing Claude Code personal skills between multiple laptops via Git repository directly in ~/.claude/skills

**Architecture:** Initialize git repo in existing skills directory, push to GitHub, clone on other machines

**Tech Stack:** Git, GitHub (SSH)

---

## Prerequisites & Permissions

### User Prerequisites (Manual Steps)

| Requirement | Why Needed | How to Verify |
|-------------|------------|---------------|
| GitHub account | Repository hosting | Can log into github.com |
| SSH key configured | Passwordless git push/pull | `ssh -T git@github.com` returns "Hi username!" |
| Git installed | Version control | `git --version` returns version |

### Claude Code Permissions Needed

| Permission | Tool | Commands | Purpose |
|------------|------|----------|---------|
| Bash execution | Bash | `git init`, `git remote add`, `git add`, `git commit`, `git push` | Initialize and sync repo |
| Read files | Read | `~/.claude/skills/**` | Verify skill files exist |
| Network (via git) | Bash | `git push`, `git pull` | Sync with GitHub |

### User Actions Required During Execution

1. **Create GitHub repository manually** - Claude cannot create repos via API
2. **Approve Bash commands** - Each git command needs user approval
3. **Provide GitHub username** - For remote URL configuration

---

## Risk Mitigations Built Into Plan

| Risk | Mitigation | Plan Step |
|------|------------|-----------|
| Data loss | Git history preserves all versions | Task 3 |
| Overwrite existing | Verify files before init | Task 2, Step 1 |
| Auth failure | Test SSH before pushing | Task 1, Step 3 |
| Wrong remote | Verify remote URL | Task 2, Step 4 |

---

## Implementation Tasks

### Task 1: Verify Prerequisites

**Step 1: Verify git is installed**

Run:
```bash
git --version
```

Expected: `git version 2.x.x`

**Step 2: Verify skills directory exists with files**

Run:
```bash
ls -la ~/.claude/skills/
```

Expected: Shows `pr-analyze/` and `pr-review/` directories

**Step 3: Test GitHub SSH authentication**

Run:
```bash
ssh -T git@github.com
```

Expected: `Hi <username>! You've successfully authenticated...`

If fails: User must configure SSH key first (https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

### Task 2: Create GitHub Repository (USER ACTION)

**Step 1: User creates repo manually**

Instructions for user:
1. Go to https://github.com/new
2. Repository name: `claude-skills`
3. Visibility: Private (recommended) or Public
4. **DO NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

**Step 2: User provides GitHub username**

Claude will ask: "What is your GitHub username?"

---

### Task 3: Initialize Git Repository

**Files:**
- Modify: `~/.claude/skills/.git/` (created)

**Step 1: Check no existing git repo**

Run:
```bash
test -d ~/.claude/skills/.git && echo "Git already initialized" || echo "Ready to initialize"
```

Expected: `Ready to initialize`

**Step 2: Initialize git repository**

Run:
```bash
cd ~/.claude/skills && git init
```

Expected:
```
Initialized empty Git repository in /Users/sherryhsu/.claude/skills/.git/
```

**Step 3: Add remote origin**

Run:
```bash
cd ~/.claude/skills && git remote add origin git@github.com:<USERNAME>/claude-skills.git
```

**Step 4: Verify remote configured**

Run:
```bash
cd ~/.claude/skills && git remote -v
```

Expected:
```
origin  git@github.com:<USERNAME>/claude-skills.git (fetch)
origin  git@github.com:<USERNAME>/claude-skills.git (push)
```

---

### Task 4: Initial Commit and Push

**Step 1: Stage all files**

Run:
```bash
cd ~/.claude/skills && git add .
```

**Step 2: Verify staged files**

Run:
```bash
cd ~/.claude/skills && git status
```

Expected: Shows new files in `pr-analyze/` and `pr-review/`

**Step 3: Create initial commit**

Run:
```bash
cd ~/.claude/skills && git commit -m "Initial commit: Claude Code personal skills

- pr-review: Code quality review for TS/React/Node/CSS
- pr-analyze: Architectural analysis for PRs"
```

**Step 4: Push to GitHub**

Run:
```bash
cd ~/.claude/skills && git branch -M main && git push -u origin main
```

Expected: Files uploaded successfully

**Step 5: Verify on GitHub**

User action: Visit https://github.com/<USERNAME>/claude-skills

Expected: See `pr-analyze/` and `pr-review/` directories with SKILL.md files

---

### Task 5: Create Sync Helper Scripts (Optional)

**Files:**
- Create: `~/.claude/skills/.sync-pull.sh`
- Create: `~/.claude/skills/.sync-push.sh`

**Step 1: Create pull script**

```bash
#!/bin/bash
# Pull latest skills from GitHub
cd ~/.claude/skills && git pull origin main
```

**Step 2: Create push script**

```bash
#!/bin/bash
# Push skill changes to GitHub
cd ~/.claude/skills && git add . && git commit -m "Update skills $(date +%Y-%m-%d)" && git push origin main
```

**Step 3: Make scripts executable**

Run:
```bash
chmod +x ~/.claude/skills/.sync-pull.sh ~/.claude/skills/.sync-push.sh
```

---

### Task 6: Add README for Future Reference

**Step 1: Create README**

Create `~/.claude/skills/README.md`:

```markdown
# Claude Code Personal Skills

Personal skills synced via Git.

## Setup on New Machine

\`\`\`bash
# Backup existing skills (if any)
mv ~/.claude/skills ~/.claude/skills.backup 2>/dev/null

# Clone this repo
git clone git@github.com:<USERNAME>/claude-skills.git ~/.claude/skills

# Verify
ls ~/.claude/skills/
\`\`\`

## Daily Sync

\`\`\`bash
# Pull latest
cd ~/.claude/skills && git pull

# Push changes
cd ~/.claude/skills && git add . && git commit -m "update" && git push
\`\`\`
```

**Step 2: Commit and push README**

Run:
```bash
cd ~/.claude/skills && git add README.md && git commit -m "docs: add setup instructions" && git push
```

---

## Verification Checklist

After completion, verify:

- [ ] `git remote -v` shows correct GitHub URL
- [ ] `git log` shows commits
- [ ] GitHub repo shows all skill files
- [ ] `/pr-review` skill still works in Claude Code
- [ ] `/pr-analyze` skill still works in Claude Code

---

## Ongoing Maintenance

### Daily Workflow

| Action | Command |
|--------|---------|
| Start of session | `cd ~/.claude/skills && git pull` |
| After editing skills | `cd ~/.claude/skills && git add . && git commit -m "description" && git push` |

### Adding New Skills

1. Create skill in `~/.claude/skills/<skill-name>/SKILL.md`
2. Test with `/<skill-name>` in Claude Code
3. Commit: `git add . && git commit -m "feat: add <skill-name> skill" && git push`

### Setup New Machine

```bash
git clone git@github.com:<USERNAME>/claude-skills.git ~/.claude/skills
```

---

## Rollback Procedure

If something goes wrong:

```bash
# View history
cd ~/.claude/skills && git log --oneline

# Revert to previous commit
git revert HEAD

# Or reset to specific commit (destructive)
git reset --hard <commit-hash>
```
