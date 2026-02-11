---
name: spec-slicing
description: "Use after brainstorming or when you have requirements/PRD. Transforms designs into vertical, independent slices with Given/When/Then acceptance criteria that become TDD test templates."
---

# Spec Slicing

## Overview

Transform designs and requirements into vertical, independent slices with Given/When/Then acceptance criteria. Each acceptance criterion becomes a TDD test template, creating direct traceability from business goal → acceptance criteria → test code.

**Core principle:** Vertical slices that can ship independently, with specs that become tests.

**Announce at start:** "I'm using the spec-slicing skill to create vertical slices with acceptance criteria."

## When to Use

```
User has design/requirements → spec-slicing → writing-plans → execution
```

Use this skill when:
- Brainstorming produced a design document
- User has a PRD, ticket, or requirements document
- Starting implementation and need to slice work vertically
- Need Given/When/Then acceptance criteria for TDD

## The Process

### Phase 1: Gather & Understand

**Step 1: Auto-detect existing artifacts**

```bash
# Check for brainstorming output
docs/plans/*-design.md

# Check for existing specs (to avoid duplication)
docs/specs/*-spec.md
```

**Step 2: Present findings**

If design docs found:
```
I found existing design documents:
1. `docs/plans/2024-01-15-user-auth-design.md` (from brainstorming)
2. `docs/plans/2024-01-10-payment-flow-design.md`

Which would you like to slice into specs?
Or provide a different document (PRD, ticket, etc.)?
```

If no design docs:
```
No design documents found in docs/plans/.

Please provide:
- A PRD or requirements document
- A JIRA/Linear ticket or epic
- Or describe what you want to build
```

**Step 3: Read additional context**

- Scan codebase for existing patterns and domain language
- Check for related specs in `docs/specs/`
- Identify test patterns already in use

**Step 4: Merge understanding**

Combine all inputs into unified understanding of:
- What we're building (features)
- Why we're building it (business goals)
- How it fits (existing system context)

### Phase 2: Extract Business Goals

**Step 1: Identify goals from inputs**

Extract explicit and implicit business goals:
```markdown
## Business Goals Identified

| ID | Goal | Source | Priority |
|----|------|--------|----------|
| G1 | Users can self-register | PRD section 2.1 | Must-have |
| G2 | Reduce support tickets for password reset | Stakeholder interview | Must-have |
| G3 | Admin can audit user activity | Compliance requirement | Must-have |
| G4 | Users can link social accounts | PRD section 2.3 | Nice-to-have |
```

**Step 2: Validate with user**

Present goals one section at a time (200-300 words max):
```
I identified these business goals from your design doc:

**Must-have:**
- G1: Users can self-register (from PRD section 2.1)
- G2: Reduce support tickets for password reset (stakeholder need)

Does this capture the core goals correctly?
Are there goals I missed or misunderstood?
```

**Step 3: Clarify and prioritize**

Ask clarifying questions ONE AT A TIME:
- "Is G4 (social accounts) required for MVP, or can it come later?"
- "For G2 (password reset), what's the current pain point?"

### Phase 3: Slice Vertically

**Vertical Slice Principles:**

1. **User-valuable**: Each slice delivers something a user can use
2. **Independent**: Can be developed and deployed without other slices
3. **Testable**: Has clear acceptance criteria
4. **Small**: Half-day to one day of work (not larger)

**Step 1: Propose slices**

For each business goal, create vertical slices:

```markdown
## Business Goal G1: Users can self-register

### Slice 1.1: Register with email and password
**User Story:** As a visitor, I can create an account with my email and password, so that I can access the platform.

**Independence check:** ✅ No dependencies on other slices

### Slice 1.2: Email verification
**User Story:** As a new user, I receive a verification email after registration, so that I can confirm my email address.

**Independence check:** ⚠️ Depends on Slice 1.1 (registration must exist)
**Resolution:** Can ship together as Slice 1.1+1.2, or 1.1 ships first with verification added later
```

**Step 2: Write Given/When/Then for each slice**

Each slice gets acceptance criteria in Given/When/Then format:

```markdown
### Slice 1.1: Register with email and password

**AC1: Successful registration**
```gherkin
Given no user exists with email "test@example.com"
When a visitor submits registration with:
  | field    | value            |
  | email    | test@example.com |
  | password | SecurePass123!   |
Then a new user account is created
And the response status is 201
And the response contains the user ID
```

**AC2: Duplicate email rejected**
```gherkin
Given a user exists with email "existing@example.com"
When a visitor submits registration with email "existing@example.com"
Then no new account is created
And the response status is 409
And the error message indicates email is taken
```

**AC3: Invalid password rejected**
```gherkin
Given no user exists with email "test@example.com"
When a visitor submits registration with:
  | field    | value    |
  | email    | test@example.com |
  | password | weak     |
Then no account is created
And the response status is 400
And the error message indicates password requirements
```
```

**Step 3: Validate each slice with user**

Present ONE slice at a time:
```
Here's the first slice for user registration:

**Slice 1.1: Register with email and password**

User Story: As a visitor, I can create an account...

Acceptance Criteria:
- AC1: Successful registration (happy path)
- AC2: Duplicate email rejected
- AC3: Invalid password rejected

Does this slice look right? Any acceptance criteria missing?
```

**Step 4: Verify independence**

For each slice, explicitly check:
```markdown
### Independence Verification

| Slice | Can Ship Alone? | Dependencies | Resolution |
|-------|-----------------|--------------|------------|
| 1.1 Register | ✅ Yes | None | - |
| 1.2 Email verify | ⚠️ Needs 1.1 | Registration | Ship with 1.1 or after |
| 2.1 Password reset | ✅ Yes | None | Uses existing user lookup |
```

### Phase 4: Generate TDD Templates

**The key innovation:** Each Given/When/Then becomes a test template.

```markdown
### Slice 1.1: TDD Test Template

```typescript
describe('User Registration', () => {
  describe('AC1: Successful registration', () => {
    it('creates account when email is new and password is valid', async () => {
      // Given: no user exists with email "test@example.com"
      await ensureUserDoesNotExist('test@example.com');

      // When: visitor submits registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!'
        });

      // Then: new user account is created
      expect(response.status).toBe(201);
      expect(response.body.userId).toBeDefined();

      const user = await findUserByEmail('test@example.com');
      expect(user).not.toBeNull();
    });
  });

  describe('AC2: Duplicate email rejected', () => {
    it('returns 409 when email already exists', async () => {
      // Given: user exists with email
      await createUser({ email: 'existing@example.com', password: 'any' });

      // When: visitor submits registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'SecurePass123!'
        });

      // Then: rejected with 409
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email.*taken/i);
    });
  });

  describe('AC3: Invalid password rejected', () => {
    it('returns 400 when password does not meet requirements', async () => {
      // Given: no user exists
      await ensureUserDoesNotExist('test@example.com');

      // When: visitor submits with weak password
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      // Then: rejected with 400
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password/i);
    });
  });
});
```
```

### Phase 5: Output Spec Document

**Save to:** `docs/specs/YYYY-MM-DD-<feature>-spec.md`

```markdown
# [Feature Name] Specification

> **For Claude:** Use superpowers:writing-plans to create implementation plan for each slice.

**Business Goals:**
[Traceability matrix from Phase 2]

**Slices:**
[Ordered list with dependencies noted]

---

## Slice 1: [Name]

**User Story:** [As a... I can... so that...]

**Business Goal:** [G1, G2, etc.]

**Acceptance Criteria:**

### AC1: [Name]
```gherkin
Given ...
When ...
Then ...
```

### TDD Template
```typescript
// Auto-generated test template
```

**Files likely affected:**
- `src/path/to/file.ts`
- `src/path/to/test.ts`

---

## Slice 2: [Name]
...
```

## Handoff to writing-plans

After spec document is complete:

```
Spec document saved to `docs/specs/YYYY-MM-DD-<feature>-spec.md`.

**Next steps:**

1. **Sequential execution:** Pick a slice and use `superpowers:writing-plans` to create detailed implementation tasks

2. **Review first:** Review the spec document and let me know if any slices need refinement

Which slice would you like to implement first? I recommend starting with [slice with fewest dependencies].
```

## Spec Document Header Template

Every spec MUST start with:

```markdown
# [Feature Name] Specification

> **For Claude:** Use superpowers:writing-plans to create implementation plan for each slice.

**Created:** YYYY-MM-DD
**Status:** Draft | Ready | In Progress | Complete
**Source:** [Link to design doc, PRD, or ticket]

## Business Goals

| ID | Goal | Priority | Slices |
|----|------|----------|--------|
| G1 | [Goal description] | Must-have | 1.1, 1.2 |

## Slice Summary

| Slice | Name | Status | Dependencies |
|-------|------|--------|--------------|
| 1.1 | [Name] | Not started | None |
| 1.2 | [Name] | Not started | 1.1 |

---
```

## Remember

- **One question at a time** (like brainstorming)
- **Vertical slices deliver user value** (not horizontal layers)
- **Given/When/Then → TDD templates** (direct traceability)
- **Independence verification** for each slice
- **Small slices** (half-day to one day, not larger)
- **Validate incrementally** (present 200-300 words, check, continue)
- **YAGNI** - remove nice-to-haves from MVP slices
