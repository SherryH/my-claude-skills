---
name: handover
description: Generate a HANDOVER.md session shift-change report. Use at any point during a session to capture what was done, decisions made, lessons learned, and next steps so nothing gets lost between sessions or after context compaction.
---

# Session Handover Document Generator

## Purpose

Generate a comprehensive HANDOVER.md file in the current project directory. Think of it as a shift-change report - it tells the next Claude exactly where things stand so nothing gets lost between sessions or after context compaction.

## Workflow

### Step 1: Review Session Context

Look back through the entire conversation and gather:

1. **Tasks & Accomplishments**: What was the user working on? What got done? What's still in progress?
2. **Problems & Solutions**: What bugs or issues were encountered? How were they resolved? What didn't work?
3. **Key Decisions**: What architectural, design, or implementation decisions were made and why?
4. **Lessons & Gotchas**: What unexpected issues came up? What workarounds were needed? What should the next session watch out for?
5. **Next Steps**: What remains to be done? What's the priority order?
6. **Important Files**: Which files were created, modified, or are central to the work?

### Step 2: Check for Existing Handover

- Read the existing `HANDOVER.md` in the project root if it exists
- Preserve any still-relevant information from previous handovers
- Update with current session information

### Step 3: Write HANDOVER.md

Write the file to the **current project root directory** using this structure:

```markdown
# Session Handover

**Last updated**: [timestamp]
**Branch**: [current git branch]
**Session focus**: [1-line summary of what this session was about]

## What Was Done

- [Completed task 1]
- [Completed task 2]
- ...

## In Progress

- [Unfinished task 1 - current state and what remains]
- ...

## What Worked and What Didn't

### Worked
- [Approach/solution that succeeded]

### Didn't Work (and how it was fixed)
- [Problem] -> [Fix/workaround applied]

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| [Decision 1] | [Why this choice was made] |

## Lessons Learned & Gotchas

- [Lesson 1]
- [Gotcha that future sessions should know about]

## Next Steps

1. [Priority 1 - most important next task]
2. [Priority 2]
3. ...

## Important Files Map

| File | Role | Notes |
|------|------|-------|
| [path/to/file] | [What it does] | [Any special notes] |
```

### Step 4: Confirm

After writing, display a brief summary to the user:
- Number of completed items captured
- Number of next steps identified
- Location of the HANDOVER.md file

## Constraints

- Keep the document concise but complete - aim for scanability
- Use concrete details, not vague descriptions
- Include file paths and line numbers where relevant
- Do NOT include sensitive information (API keys, secrets, credentials)
- If this is an auto-compaction handover, note that in the document header
- Always overwrite the existing HANDOVER.md (it captures the latest state)
