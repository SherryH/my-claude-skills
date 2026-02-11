# Test Feature: Survey Response Export

## Purpose

This is a test feature document for baseline testing the spec-slicing skill. It's designed to expose common failure modes when agents slice work without proper guidance.

## Expected Failure Modes

| Failure Mode | What to Watch For |
|--------------|-------------------|
| **Horizontal slicing** | Tasks like "Create ExportService", "Create ExportController", "Create ExportButton" instead of user-valuable slices |
| **Vague acceptance criteria** | "Export should work", "Handle errors gracefully" instead of Given/When/Then |
| **Dependent tasks** | Task 2 can't start until Task 1 is complete, no independent deployability |
| **Missing business traceability** | No link between tasks and business goals |
| **Over-engineering** | Adding features not in requirements (e.g., scheduled exports, export templates) |

---

## The Feature (PRD-style)

### Overview

Brand admins need to export survey responses for analysis in external tools (Excel, Google Sheets, BI tools). Currently, they can only view responses in the dashboard.

### Business Goals

1. **G1: Enable data analysis outside the platform** - Brand admins want to analyze responses in their preferred tools
2. **G2: Support compliance reporting** - Some brands need to provide response data for audits
3. **G3: Reduce support tickets** - Currently admins email support asking for data exports

### User Stories

**US1:** As a brand admin, I can export all responses from a single survey to CSV, so that I can analyze them in Excel.

**US2:** As a brand admin, I can filter responses by date range before exporting, so that I only get the data I need.

**US3:** As a brand admin, I can see export progress for large surveys, so that I know the system is working.

### Requirements

#### Functional
- Export responses from a single survey
- CSV format (Excel-compatible)
- Include all response fields and metadata (timestamp, respondent ID if available)
- Filter by date range (optional)
- Download file directly to browser
- Show progress indicator for exports > 1000 responses

#### Non-Functional
- Export should complete within 30 seconds for up to 10,000 responses
- Export should not block other users or degrade dashboard performance

### UI Mockup Description

- "Export" button on survey results page (top right, next to filter controls)
- Clicking opens modal with:
  - Date range picker (optional, defaults to "All time")
  - "Export to CSV" button
  - Cancel button
- During export: progress bar with "Exporting X of Y responses..."
- On complete: browser download triggers, modal closes

### Technical Context

- Existing: `SurveyResponseService` has `getResponses(surveyId, filters)` method
- Existing: Response data is stored in PostgreSQL
- Existing: Frontend uses TanStack Query for data fetching
- Existing: File downloads use browser's native download mechanism

---

## Test Instructions

### Baseline Test (WITHOUT spec-slicing skill)

Prompt to use:
```
Here's a feature PRD for survey response export. Please break this down into implementation tasks with acceptance criteria.

[paste the feature section above]
```

### What to Document

1. **How did the agent slice the work?**
   - Horizontal (by layer) vs Vertical (by user value)?
   - Are slices independently deployable?

2. **What format are the acceptance criteria?**
   - Vague descriptions vs Given/When/Then?
   - Testable vs subjective?

3. **Are business goals traced?**
   - Can you trace each task back to G1, G2, or G3?

4. **What rationalizations did the agent use?**
   - "It's more efficient to build the service first"
   - "We need the infrastructure before the UI"
   - etc.

### Expected Baseline Behavior (Hypothesis)

Agent will likely produce something like:

```markdown
## Tasks

### Task 1: Create ExportService
- Add exportResponsesToCSV method
- Handle pagination for large datasets
- Return CSV string

### Task 2: Create Export API endpoint
- POST /api/brand/surveys/:id/export
- Call ExportService
- Return file download

### Task 3: Create Export UI
- Add Export button to survey results page
- Create export modal with date picker
- Show progress indicator

### Task 4: Add progress tracking
- Track export progress
- Send progress updates to frontend
```

**Problems with this baseline:**
- Horizontal slicing (Service → API → UI)
- Task 3 can't be tested without Task 1 and 2
- No Given/When/Then criteria
- No business goal traceability
- Vague acceptance criteria

### Good Slicing (What skill should produce)

```markdown
## Slice 1: Export single survey to CSV (basic)

**User Story:** As a brand admin, I can export all responses from a survey to CSV.

**Business Goal:** G1 (data analysis), G3 (reduce support tickets)

**AC1: Successful export**
Given I am a brand admin viewing survey "Customer Feedback"
And the survey has 50 responses
When I click "Export to CSV"
Then a CSV file downloads to my browser
And the file contains 50 data rows plus header
And each row contains response fields and timestamp

**AC2: Empty survey**
Given I am viewing a survey with 0 responses
When I click "Export to CSV"
Then I see message "No responses to export"
And no file downloads

**Independence:** ✅ Can ship alone - delivers immediate value
```

This slice is:
- Vertical (touches all layers but delivers user value)
- Independent (can ship without other slices)
- Testable (Given/When/Then)
- Traceable (linked to G1, G3)
