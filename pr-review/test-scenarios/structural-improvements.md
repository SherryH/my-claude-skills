# Pressure Test Scenarios: Structural Improvements

These scenarios test whether the pr-review skill catches **structural design improvements**, not just immediate bug fixes.

## Scenario 1: Multiple useState for Related State (from PR #337)

**Code Under Review:**
```typescript
// usePageBuilder.ts - BEFORE refactor
export function usePageBuilder({ initialPages }) {
  const [pages, setPages] = useState<TouchpointPage[]>(initialPages);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const updatePageConfig = useCallback(
    (index: number, config: Record<string, unknown>) => {
      setPages((prevPages) => {
        const newPages = [...prevPages];
        if (newPages[index]) {
          newPages[index] = { ...newPages[index], config };
        }
        return newPages;
      });
      setIsDirty(true);  // BUG: Could have stale closure issues
    },
    []
  );

  const removePage = useCallback((index: number) => {
    setPages(prev => prev.filter((_, i) => i !== index));
    // BUG: selectedPageIndex could be stale here
    if (selectedPageIndex >= pages.length - 1) {
      setSelectedPageIndex(Math.max(0, pages.length - 2));
    }
    setIsDirty(true);
  }, [selectedPageIndex, pages.length]);

  // ... more actions that manipulate multiple states
}
```

**Expected Immediate Fix (what current skill catches):**
- Use `useState` callback for `setIsDirty`
- Add missing dependencies to useCallback
- Use functional updates for all setState calls

**Expected Structural Improvement (what skill should ALSO catch):**
- Recommend `useReducer` when multiple related states need atomic updates
- These states (pages, selectedPageIndex, isDirty) are **conceptually linked** - changes to pages often require changes to selectedPageIndex and isDirty
- `useReducer` eliminates the entire class of stale closure bugs by design

---

## Scenario 2: Nested State Updates in Event Handlers

**Code Under Review:**
```typescript
function useShoppingCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => [...prev, item]);
    setTotal(prev => prev + item.price);  // Could be stale
    setItemCount(prev => prev + 1);
    setLastUpdated(new Date());
  }, []);

  const removeItem = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);  // Stale closure!
    if (item) {
      setItems(prev => prev.filter(i => i.id !== itemId));
      setTotal(prev => prev - item.price);
      setItemCount(prev => prev - 1);
      setLastUpdated(new Date());
    }
  }, [items]);  // Has dependency but still problematic pattern
}
```

**Expected Immediate Fix:**
- Fix stale closure in removeItem
- Ensure all state updates use functional form

**Expected Structural Improvement:**
- `total` and `itemCount` are **derived state** - should be computed from `items`, not stored separately
- Recommend: `const total = useMemo(() => items.reduce(...), [items])`
- Or use `useReducer` if state transitions are complex

---

## Scenario 3: Complex Conditional State Transitions

**Code Under Review:**
```typescript
function useWizardForm() {
  const [step, setStep] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToStep = useCallback((newStep: number) => {
    if (newStep < 0 || newStep > 3) return;

    setStep(newStep);
    setCanGoBack(newStep > 0);
    setCanGoForward(newStep < 3 && isValid);  // Stale isValid
    setError(null);
  }, [isValid]);

  const validate = useCallback((data: FormData) => {
    const valid = validateStep(step, data);  // Stale step
    setIsValid(valid);
    setCanGoForward(valid && step < 3);
  }, [step]);
}
```

**Expected Immediate Fix:**
- Fix dependency arrays
- Use functional updates

**Expected Structural Improvement:**
- This is a **state machine** - recommend XState or useReducer with explicit state transitions
- `canGoBack` and `canGoForward` are **derived** from `step` and `isValid`
- Multiple boolean flags managing UI state is a code smell

---

## Scenario 4: Prop Drilling with Callbacks

**Code Under Review:**
```typescript
// Parent.tsx
function Parent() {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<Prefs>({});

  const updateUserName = useCallback((name: string) => {
    setUser(prev => prev ? { ...prev, name } : null);
  }, []);

  const updateUserEmail = useCallback((email: string) => {
    setUser(prev => prev ? { ...prev, email } : null);
  }, []);

  const updateTheme = useCallback((theme: string) => {
    setPreferences(prev => ({ ...prev, theme }));
  }, []);

  return (
    <Child
      user={user}
      preferences={preferences}
      onUpdateName={updateUserName}
      onUpdateEmail={updateUserEmail}
      onUpdateTheme={updateTheme}
    />
  );
}

// Child.tsx - passes same props down
function Child({ user, preferences, onUpdateName, onUpdateEmail, onUpdateTheme }) {
  return (
    <GrandChild
      user={user}
      preferences={preferences}
      onUpdateName={onUpdateName}
      onUpdateEmail={onUpdateEmail}
      onUpdateTheme={onUpdateTheme}
    />
  );
}
```

**Expected Immediate Fix:**
- Individual callback fixes if any have bugs

**Expected Structural Improvement:**
- Extract to custom hook: `useUser()` and `usePreferences()`
- Consider Context for deep prop drilling
- Or combine into a single `useUserSettings` hook with unified API

---

## Success Criteria

The improved pr-review skill should:

1. **Catch immediate bugs** (existing behavior - KEEP)
2. **Identify structural patterns** that indicate design issues:
   - Multiple `useState` for related/coupled state → suggest `useReducer`
   - Derived state stored separately → suggest `useMemo` or computed values
   - Complex conditional state transitions → suggest state machine
   - Prop drilling > 2 levels → suggest custom hooks or Context
3. **Explain WHY structural change is better** than immediate fix
4. **Provide concrete refactoring direction** not just "consider refactoring"

## Test Protocol

1. Run current skill against each scenario
2. Document what it catches vs misses
3. Add structural review section to skill
4. Re-run against scenarios
5. Verify structural improvements are now flagged
