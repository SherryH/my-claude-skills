# Baseline Behavior Analysis

Analysis of what current pr-review skill catches vs misses, based on skill definition and PR #337 experience.

## Current Skill Review Criteria (from SKILL.md)

```
- Code quality and adherence to TS, Node.js, React, CSS best practices
- Potential bugs or unhandled edge cases
- Performance optimizations
- Readability and maintainability
- Security vulnerabilities
```

## What Current Skill CATCHES ✅

### Bug Detection
- Stale closures in useCallback/useEffect
- Missing null checks
- Missing dependency array items
- Race conditions in async code
- Memory leaks (missing cleanup)

### Performance
- Unnecessary re-renders from inline functions
- Missing memoization for expensive computations

### Code Quality
- TypeScript type errors
- Missing error handling
- CLAUDE.md violations

## What Current Skill MISSES ❌

### Structural Design Patterns
The skill focuses on **fixing bugs where they occur** rather than **identifying design patterns that would prevent the bug class entirely**.

| Scenario | Bug Found | Fix Suggested | Structural Alternative MISSED |
|----------|-----------|---------------|------------------------------|
| Multiple useState for related state | Stale closure | useState callback | `useReducer` for atomic updates |
| Derived state stored separately | State sync bugs | Add sync logic | Compute from source state |
| Complex boolean flag management | Invalid states | More conditionals | State machine pattern |
| Prop drilling callbacks | Individual callback bugs | Fix each callback | Custom hook extraction |

### Why This Matters

**Immediate fix**: Patches the symptom
```typescript
// Fix: Use callback form
setIsDirty(true);  // Bug: stale closure possible

// Immediate fix suggestion:
setIsDirty(() => true);  // Technically correct but misses the point
```

**Structural fix**: Eliminates the bug class
```typescript
// Structural fix: useReducer
dispatch({ type: 'UPDATE_PAGE', index, config });
// Now isDirty, selectedPageIndex, and pages update atomically
// Stale closure IMPOSSIBLE by design
```

## Gap Analysis for Scenario 1 (PR #337)

**Code:**
```typescript
const [pages, setPages] = useState(initialPages);
const [selectedPageIndex, setSelectedPageIndex] = useState(0);
const [isDirty, setIsDirty] = useState(false);

const removePage = useCallback((index: number) => {
  setPages(prev => prev.filter((_, i) => i !== index));
  if (selectedPageIndex >= pages.length - 1) {  // BUG: stale
    setSelectedPageIndex(Math.max(0, pages.length - 2));
  }
  setIsDirty(true);
}, [selectedPageIndex, pages.length]);
```

**Current skill would catch:**
- ✅ Stale `pages.length` in the conditional
- ✅ Suggest adding functional update or fixing dependencies

**Current skill would miss:**
- ❌ These three states are **conceptually one unit** (page builder state)
- ❌ `useReducer` would make this entire bug class impossible
- ❌ The pattern of "update A, then conditionally update B based on A" is a design smell

## Root Cause of the Gap

The current skill's instructions say:
> "Potential bugs or unhandled edge cases"

This frames review as **bug hunting** not **design review**.

Missing instruction:
> "When fixing a bug, consider whether a structural change would prevent the entire bug class"

## Expected Baseline Output for Scenario 1

```markdown
## File: usePageBuilder.ts

### Issues Found
- **Line 23**: [Bug] - Stale closure: `pages.length` may not reflect current state
  - **Why it matters**: removePage could calculate wrong index
  - **Suggested fix**: Use functional update pattern
    ```typescript
    setPages(prev => {
      const newPages = prev.filter((_, i) => i !== index);
      // Calculate new selected index based on newPages
      return newPages;
    });
    ```
```

## Expected IMPROVED Output for Scenario 1

```markdown
## File: usePageBuilder.ts

### Issues Found
- **Line 23**: [Bug] - Stale closure in removePage callback
  - **Why it matters**: State updates to pages, selectedPageIndex, and isDirty can become inconsistent
  - **Immediate fix**: Use functional update pattern for all setState calls
  - **Structural improvement**: These states are conceptually linked. Consider `useReducer`:
    ```typescript
    // Better: useReducer for atomic state transitions
    const [state, dispatch] = useReducer(pageBuilderReducer, {
      pages: initialPages,
      selectedPageIndex: 0,
      isDirty: false,
    });

    const removePage = useCallback((index: number) => {
      dispatch({ type: 'REMOVE_PAGE', index });
    }, []);
    ```
    **Why this is better**: Eliminates stale closure bugs by design. All related state updates atomically in the reducer.

### Design Pattern Observations
- **Pattern detected**: Multiple `useState` calls for conceptually related state
- **Recommendation**: When state transitions involve updating multiple values together, `useReducer` provides:
  - Atomic updates (no intermediate invalid states)
  - Centralized state logic (easier to test and reason about)
  - No stale closure issues in dispatch callbacks
```

## Verification Checklist

After skill improvement, re-run against scenarios and verify:

- [x] Scenario 1: Recommends useReducer for multiple related useState ✅ VERIFIED 2025-01-23
- [x] Scenario 2: Identifies derived state that should be computed ✅ VERIFIED 2025-01-23
- [x] Scenario 3: Suggests state machine for complex transitions ✅ VERIFIED 2025-01-23
- [x] Scenario 4: Recommends custom hook extraction for prop drilling ✅ VERIFIED 2025-01-23
- [x] All tested scenarios: Explains WHY structural change is better than immediate fix ✅

## Test Results Summary

**Scenario 1 (usePageBuilder)**: PASS
- Caught stale closure bug
- Identified "multiple useState for related state" pattern
- Recommended useReducer with full code example
- Explained atomic state transitions benefit

**Scenario 2 (useShoppingCart)**: PASS
- Caught stale closure in removeItem
- Identified "derived state stored separately" pattern
- Recommended useMemo for total/itemCount
- Explained single source of truth principle

**Scenario 3 (useWizardForm)**: PASS
- Identified "complex boolean flags for UI state" pattern
- Recommended state machine with discriminated union types
- Explained "impossible states become impossible" principle
- ALSO caught "derived state" pattern (canGoBack/canGoForward)
- Provided full WizardState type + reducer implementation

**Scenario 4 (Parent/Child/GrandChild)**: PASS
- Identified "prop drilling callbacks > 2 levels" pattern
- Recommended TWO alternatives: custom hook AND Context
- Explained reduction in maintenance burden and coupling
- BONUS: Caught type safety issues (missing imports, unsafe assertions)
- BONUS: Caught accessibility issues (unlabeled inputs)

**Scenario 5 (Fat API Route - PR #332)**: PASS ✅ VERIFIED 2025-01-23
- Detected "fat route" pattern (100+ lines of business logic)
- Identified multiple service orchestration (brandService + surveyService)
- Caught helper function (`extractCategoryFromResponse`) in route file
- Flagged cross-layer import (frontend JSON in backend route)
- Gave PROJECT-AWARE recommendation using existing `src/backend/applications/` pattern
- Provided concrete before/after code showing thin route delegation
- Explained WHY thin routes are better (testable, reusable, single source of truth)
