---
name: writing-plans-custom
description: Use when writing implementation plans that include UI components or database/repository methods, to ensure Playwright MCP verification for UI tasks and migration schema verification for DB tasks
---

# Writing Plans - Custom Extensions

## Overview

Extension to `superpowers:writing-plans` that adds project-specific verification steps. This skill auto-applies when generating plans with UI file changes or database/repository methods.

**REQUIRED BACKGROUND:** Use alongside `superpowers:writing-plans`. This skill adds verification layers — it does not replace the base planning skill.

---

## Extension 1: UI Visual Verification (Playwright MCP)

### When This Applies

A task is a **UI task** when its files include: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, or component directories.

### Plan Header Addition

```markdown
**MCP Servers:** [List required MCP servers. Include `Playwright` for any task with UI files]
```

### UI Task Structure

Mark UI tasks with `**Type:** UI` to trigger Playwright MCP auto-loading.

```markdown
### Task N: [UI Component Name]

**Type:** UI
**Files:**
- Create: `src/components/MyComponent.tsx`
- Test: `src/components/__tests__/MyComponent.test.tsx`
- Visual: `screenshots/my-component.png`

**Step 1-4: [Standard TDD - write failing test, verify fail, implement, verify pass]**

**Step 5: Visual verification (Playwright MCP - headless)**

Playwright MCP auto-loads for UI tasks. Runs headless — won't take over screen.

```typescript
await page.goto('http://localhost:3000/path-to-component');
await page.screenshot({ path: 'screenshots/component-name.png' });

// Assert spec requirements
await expect(page.locator('.option-text')).toHaveCSS('text-align', 'left');
await expect(page.locator('.mandatory-toggle')).toBeVisible();
```

Run: Playwright MCP (headless mode)
Expected: All visual assertions pass, screenshot saved

**Step 6: Commit**
```

### Playwright vs Unit Test Decision

| Requirement | Test With |
|-------------|-----------|
| Data transforms, logic, state | Unit test (Vitest) |
| CSS properties (alignment, sizing) | Playwright MCP |
| Image dimensions render correctly | Playwright MCP |
| Component renders without errors | Unit test |
| Interactive behavior (click, hover) | Playwright MCP |
| API response handling | Unit test |
| Responsive layout at breakpoints | Playwright MCP |

### Auto-Loading Rule

When generating a plan, if ANY task has `**Type:** UI`:
1. Add `Playwright` to plan header's **MCP Servers** list
2. Include visual verification step in that task
3. Include `screenshots/` path in task's **Files** section
4. Use headless mode — never launch visible browser during automated execution

---

## Extension 2: Database Schema Verification for Repository Methods

### When This Applies

A task involves **database/repository work** when it creates or modifies files in:
- `src/backend/modules/*/repository.ts`
- `src/backend/modules/*/*.repository.ts`
- Any file that queries Supabase (`.from('table_name')`)

### Mandatory Pre-Step: Read Migration Before Writing Queries

**BEFORE writing any repository query method**, the plan MUST include:

1. **Read the migration file** for the target table (`supabase/migrations/`)
2. **List the actual columns** that exist in the table
3. **Only reference columns that exist** in the migration — do NOT assume columns from other tables

### Why This Exists

Repository methods were written with `.is('deleted_at', null)` filters copied from a different table's repository pattern. The target table (`touchpoint_survey_responses`) had no `deleted_at` column. The mocked Supabase client in tests silently accepted the non-existent column, but real Postgres rejected it at runtime.

**Pattern-matching from other repositories is the #1 source of query bugs.** Each table has its own schema — verify it.

### Plan Task Structure for Repository Methods

```markdown
### Task N: [Repository Method Name]

**Files:**
- Modify: `src/backend/modules/<name>/<name>.repository.ts`
- Reference: `supabase/migrations/<timestamp>_create_<table>.sql`

**Step 0: Verify table schema (MANDATORY)**

Read `supabase/migrations/<timestamp>_create_<table>.sql` and confirm the columns:
- [list actual columns from migration]

Only use these columns in query filters.

**Step 1-5: [Standard TDD steps]**
```

### Common Mistakes

| Mistake | Prevention |
|---------|-----------|
| Copying `.is('deleted_at', null)` from another repo | Read the migration — not all tables have soft delete |
| Using `flow_id` when column is `session_id` | Column names differ between tables — verify |
| Filtering on `user_id` when it's nullable | Check migration for NULL constraints |
| Assuming JSONB structure from TypeScript types | Types may be aspirational — check actual stored data |

---

## Extension 3: Preview Parity Check (Touchpoint/LMA Features)

### When This Applies

A task involves **touchpoint/LMA work** when its files include:
- `src/frontend/components/brand/TouchpointWidget*`
- `src/frontend/components/touchpoint/modules/survey-question/*`
- `*Renderer*`, `*Preview*`, or `modules/shared/`
- Any component rendered inside the LMA public page

### When This Does NOT Apply

- Backend-only changes (API routes, services, repositories) with no rendering impact
- Admin dashboard pages that don't render touchpoint content
- Database migrations, i18n additions, or type-only changes

### The Rule

Every user-facing behavior on the public LMA page MUST also work in:
- **Mobile Preview** (TouchpointWidget with `isPreview=true`)
- **Admin Editor Preview** (PagePreview in page-builder)

### Plan Task Structure

For each task that adds/modifies user-facing behavior, include:

```markdown
**Preview Parity Checklist:**
- [ ] Works in Mobile Preview (`isPreview=true`)
- [ ] Works in Admin Editor Preview (PagePreview)
- [ ] API calls short-circuited in preview mode (no real submissions)
- [ ] UI feedback (modals, state, validation) functional without API
```

### Why This Exists

The `fix/preview-submit` branch (March 2025) fixed 5+ bugs where features worked on the public LMA but were broken in preview modes: submit button missing, modal not closing, submission state not shown, navigation dots overlapping, validation styling lost. All were caused by not considering preview modes during planning.

### Common Gaps

| Gap | Example |
|-----|---------|
| Submit button missing in preview | `isLastSurveyQuestion` not passed to PagePreview |
| Modal fires API in preview | `submitMutation` not short-circuited when `flowId` is null |
| State not updated in preview | `onSubmitted` callback skipped in preview path |
| Props not forwarded | New prop added to Renderer but PagePreview doesn't pass it |

### Rationalization Counters

| Excuse | Reality |
|--------|---------|
| "Preview doesn't need this feature" | Users test in preview before publishing. Broken preview = broken workflow. |
| "I'll add preview support later" | 5 of 5 preview bugs in March 2025 were "add later" that never happened. |
| "It's just cosmetic, preview can skip it" | Submit button "cosmetic" skip caused users to think submission was broken. |
| "The API call won't hurt in preview" | Preview has no flowId — ungated API calls throw errors or create orphan data. |

---

## Re-Applying After Plugin Upgrade

If `superpowers:writing-plans` is updated and loses customizations, this skill survives because it lives in `~/.claude/skills/writing-plans-custom/` (not in the plugin cache). The base skill loads first, then this extension applies on top.
