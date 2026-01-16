---
name: pr-review
description: Use when reviewing pull requests for code quality, bugs, performance, and security issues in TS/React/Node/CSS codebases
---

# PR Review

## Overview

Comprehensive pull request code review focused on TypeScript, React, Node.js, and CSS best practices.

## Workflow

When invoked with a PR URL:

1. **Fetch PR details** using `gh pr view <URL> --json files,additions,deletions,title,body`
2. **Get the diff** using `gh pr diff <URL>`
3. **Review each changed file** against the criteria below

## Review Criteria

Evaluate code based on:

1. **Code quality** - Adherence to TS, Node.js, React, CSS best practices
2. **Potential bugs** - Unhandled edge cases, error scenarios
3. **Performance** - Optimization opportunities, unnecessary re-renders, memory leaks
4. **Readability** - Maintainability, naming, structure
5. **Security** - Vulnerabilities, injection risks, data exposure

## Output Format

```
## Summary
[Brief overall assessment of code quality]

## File: [filename]
### Issues Found
- **Line X**: [Category] - [Description]
- **Line Y**: [Category] - [Description]

### Suggestions
- [Improvement suggestion]

## File: [filename]
[No issues found - code meets best practices]

## Overall Verdict
[Pass/Needs Changes] - [Summary recommendation]
```

## Notes

- Line numbers start at 1, based on the code as presented in the diff
- If no issues found in a file, state that it meets best practices
- Focus on actionable feedback, not stylistic nitpicks
