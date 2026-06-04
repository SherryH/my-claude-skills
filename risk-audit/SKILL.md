---
name: risk-audit
description: Bug-prevention audit for one feature/bugfix slice, run as two modes around TDD — pre (predict risks, prescribe red-first tests before coding) and post (verify the green diff handled them, fix what didn't). Use when implementing or reviewing a feature slice, before or after writing tests, or when asked to "risk audit", "pre-tdd / post-tdd check", or "review this slice for bugs". Pairs with /tdd.
---

# risk-audit

Bug-prevention audit for one feature/bugfix slice, run as two modes around TDD:
**pre** (predict risks → prescribe red-first tests before you code) and **post**
(verify the diff handled them, fix what didn't). The engine is a diverse-lens
fan-out — one fresh-context reviewer per bug cause-family — because one mind can't
audit its own blind spot.

## Quick start
- `risk-audit pre <files the slice will touch + acceptance criteria>`
- `risk-audit post <the working-tree diff>`

## What it loads
1. `references/catalog.md` — portable cause-families. **Band 1** = drop-in anywhere;
   **Band 2** = needs a one-line `mechanism:` binding. These entries ARE the lenses.
2. The **project adapter** `<repo>/.claude/risk-audit.md` — local mechanism bindings
   (Band 2) + Band-3 local rules + Tier-2 substrate pointers (bug log, learned-rule
   memories, convention sections). Read it at runtime.
3. **No adapter?** Run the Band-1 lenses, auto-detect the stack to bind Band-2
   mechanisms where possible, and offer `risk-audit setup` to scaffold one from
   `references/adapter-template.md`.

## The engine: diverse-lens fan-out
Dispatch one **read-only subagent per applicable cause-family** (parallel `Agent`
calls). Band-1 lenses always run; a Band-2 lens runs once its `mechanism:` is bound
(by the adapter or stack auto-detect). Each lens reads the real code + the adapter's
substrate and emits findings as
`shape → detect@file:line → red-first pin → root-cause fix + convention ptr`.
**Convergence is the confidence signal:** a risk flagged by ≥2 lenses is real.

## Mode: pre  (predict + prescribe — before /tdd)
1. Fan out over the files the slice will touch + the AC.
2. For each surfaced family, name the **red-first `pin` test to write FIRST**
   (preserves characterization-before-fork; catches parity/seam early).
3. Emit a lean risk register into the issue/AC so the executing TDD agent SEES it.
4. A spec gap a lens can't resolve (missing rule, ambiguous contract) → escalate to
   the user for sign-off. Plan-silence = OPEN question, never "by design".

## Mode: post  (verify + fix + clean — on the green diff)
1. Fan out over the real diff: did it handle each predicted family? Any NEW family
   only visible once written (coercion, casing leak, RLS-client mismatch)?
2. **Triage gate (advisory, not auto-block):** ≥2-lens convergence = confirmed;
   single-lens = surface to the user, don't hard-block (a lens can over-call).
3. **Fix loop** — for each confirmed finding: write its red `pin` test, apply the
   root-cause fix per the entry + the bound convention, re-run to green.
4. **Comment-hygiene cleanup** (a convention, NOT a lens): strip the plan/issue/doc
   provenance + restate-the-code comments that accreted while drafting, per the
   project's comment rule (from the adapter). Leave only succinct WHY-comments.

This post pass IS the relocated plan-critique — one fewer separate loop, not one more.

## Mode: setup  (first run in a new repo, no adapter yet)
Trigger: no `<repo>/.claude/risk-audit.md` exists. The skill still runs the Band-1
lenses without it — setup is what unlocks the Band-2 lenses for this stack.
1. Scan the repo to auto-detect the stack (test runner, ORM/migrations, type system,
   auth, component lib) and any convention docs / bug log / learned-rule memories.
2. Copy `references/adapter-template.md` → `<repo>/.claude/risk-audit.md`, filling each
   Band-2 `mechanism:` slot from what you detected; leave genuine unknowns as `TODO`.
3. Show the user the draft and confirm the slots you couldn't infer.
Keep it THIN — pointers to substrate, not copies. The template leads with a minimal
worked example.

## See also
- [references/catalog.md](references/catalog.md) — cause-families / lenses
- [references/adapter-template.md](references/adapter-template.md) — per-project config
