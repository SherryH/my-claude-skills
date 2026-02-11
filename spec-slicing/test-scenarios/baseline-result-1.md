# Baseline Test Result #1: Survey Export Feature

**Date:** 2025-02-11
**Skill loaded:** None (baseline)
**Test feature:** Survey Response Export

## Observed Behavior

### Slicing Pattern: HORIZONTAL (by layer)

Agent produced 10 tasks organized by architectural layer:

| Task | Layer | Type |
|------|-------|------|
| 1. CSV Export Utility | Backend utility | Infrastructure |
| 2. Service Method | Backend service | Infrastructure |
| 3. API Endpoint | Backend API | Infrastructure |
| 4. Frontend API Service | Frontend service | Infrastructure |
| 5. Export Modal | Frontend UI | Feature |
| 6. Progress Tracking | Backend + Frontend | Feature |
| 7. Download Hook | Frontend utility | Infrastructure |
| 8. Wire up UI | Frontend | Integration |
| 9. TanStack Query Hooks | Frontend | Infrastructure |
| 10. Performance Testing | Testing | Verification |

**Problem:** 6 of 10 tasks are infrastructure/utilities that deliver no user value alone.

### Dependency Chain: HIGHLY COUPLED

Agent explicitly stated recommended implementation order:

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 7 → Task 5 → Task 6 → Task 9 → Task 8 → Task 10
```

**Problem:** Task 8 (the first user-facing feature) can't start until 7 other tasks complete.

### Acceptance Criteria Format: CHECKBOX LISTS

Example from Task 3:
```markdown
- [ ] `POST /api/brand/surveys/[surveyId]/export` endpoint exists
- [ ] Accepts optional `startDate` and `endDate` in request body
- [ ] Returns CSV file with appropriate headers
- [ ] Filename includes survey name and export date
```

**Problems:**
- Not testable as-is (what does "exists" mean in a test?)
- No Given/When/Then structure
- Implementation-focused, not behavior-focused
- Can't be directly translated to test code

### Business Goal Traceability: NONE

The business goals G1, G2, G3 were mentioned in the PRD but:
- Not referenced in any task
- No traceability matrix
- No way to verify which tasks serve which goals
- If G2 (compliance) is deprioritized, unclear which tasks to cut

### Over-engineering Detected

- Task 6: Progress tracking with streaming/polling - complex for MVP
- Task 10: Performance testing as separate task - could be part of integration
- Separate response-count endpoint - could be avoided

### Rationalizations Used (verbatim)

1. **"foundation, no dependencies"** - Justifying Task 1 as starting point
2. **"Recommended sequence based on dependencies"** - Acknowledging the horizontal structure creates dependencies
3. **"depends on Tasks 1, 2"** - Treating dependencies as natural/expected

## Summary of Failures

| Failure Mode | Observed? | Evidence |
|--------------|-----------|----------|
| Horizontal slicing | ✅ YES | 10 tasks by layer, not by user value |
| Vague acceptance criteria | ✅ YES | Checkbox lists, no Given/When/Then |
| Dependent tasks | ✅ YES | Explicit dependency chain, Task 8 needs 7 prior |
| Missing business traceability | ✅ YES | G1, G2, G3 never referenced |
| Over-engineering | ✅ YES | Progress tracking, separate endpoints |

## What Good Would Look Like

**Slice 1: Export single survey to CSV (basic)**
- Delivers user value immediately
- Can ship alone
- Given/When/Then criteria
- Traced to G1, G3

**Slice 2: Filter by date range**
- Builds on Slice 1 but independently valuable
- Can be tested in isolation
- Traced to G1

**Slice 3: Progress indicator for large exports**
- Nice-to-have, can be deferred
- Traced to UX improvement (not core business goal)
