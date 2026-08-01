---
name: ship-slice
description: Run one implementation slice through the repo's full pipeline (risk-audit pre → tdd → reviews → create-pr) with a fresh subagent per stage, two approval gates, and resume support.
disable-model-invocation: true
---

# Ship Slice

One invocation = one ticket = one worktree. The main session is a thin orchestrator: it spawns a **fresh** subagent for every stage, reads each report, and decides go/halt. Stage detail (prompts, models, completion criteria, report templates) lives in [`STAGES.md`](STAGES.md) — read it before spawning the first stage.

## 1. Preconditions — verify, then proceed

1. **In the target worktree.** Session cwd sits under `.claude/worktrees/` of the repo. Elsewhere → stop and point the user at `/create-worktree` (it auto-enters).
2. **Scoped slice.** The argument names a ticket (`EZTP-NNN`) or a short description tied to one. Fetch the issue (Linear MCP `get_issue`) for title, acceptance criteria, labels, and any Figma link. A slice with no ticket or no acceptance criteria is unscoped → stop and send the user to grilling / `/to-tickets`. The pipeline builds scoped slices only.
3. **Resume check.** If `<worktree>/.claude/pipeline/<TICKET>.md` exists, read it and continue from the first incomplete stage (a halted stage resumes at its repair cycle). Completion: you can state which stage runs next and why.

## 2. Pipeline file — the run's single source of truth

`<worktree>/.claude/pipeline/<TICKET>.md`. One `## Stage: <name>` section per completed stage: status (`green` / `halted`), key outputs, findings→commit table where relevant. Append after every stage; write the halt state **before** reporting a halt. It is worktree-local (dies with the worktree, never committed).

## 3. Run the stages

Fixed order: `risk-audit pre` → **GATE 1** → `tdd` → [`figma-parity`] → `risk-audit post` → `pr-review` → [`code-review`] → **GATE 2** → `create-pr`.

For each stage:

1. Spawn a fresh subagent (Agent tool) with the stage prompt from `STAGES.md`: the common preamble + the stage's skill invocation + only the pipeline-file sections that stage's Inputs column lists. Reviewers receive the diff and the risk list — the implementer's reasoning stays out of their context.
2. Apply the model column; check the Opus escalation markers before spawning an execution stage, and log any escalation (one-line reason) in the pipeline file.
3. On the agent's report: verify the stage's completion criterion, append its section to the pipeline file, post a one-line transition to the user ("risk-audit post: green, 2 findings fixed"). Completion: criterion met and section written — then the next stage may spawn.

**Conditional stages:**
- `figma-parity` runs when the ticket carries a Figma link. Announce the verdict *and the specific link* at Gate 1 — a link can point at a sticky note, so name it and let the user veto.
- `code-review` is decided after tdd from the actual diff: include it when exported service/repo signatures, API routes, or schemas/DTOs changed; when ambiguous, include it. Log the decision + reason.

## 4. Gates — the two places the user speaks

**GATE 1** (after `risk-audit pre`): present the risk list + prescribed red-first tests, the conditional-stage verdicts, and any model escalations, then AskUserQuestion (approve / adjust). Proceed on approval only.

**GATE 2** (before `create-pr`): present the run report per the `STAGES.md` template — what was built, **every** finding enumerated with its resolving commit, runtime-gate evidence, draft PR title/body. Approval here is the user's push approval; `create-pr` fires only after it.

## 5. Red stage → one repair cycle → halt

A stage that fails its criterion gets exactly one repair cycle: a fresh fixer agent applies the enumerated findings, then the **same check re-runs on the final diff**. Red again → halt: write state to the pipeline file, report the evidence and the resume command (`/ship-slice <TICKET>`), and end the turn. A red check is never advanced past. Infra failures (dev server down, MCP auth lapsed) halt immediately with diagnosis — repair cycles are for code.

## Out of scope

Worktree creation (`/create-worktree`), cross-worktree orchestration (one session per worktree — parallel slices means parallel sessions), and post-merge work (stacked-branch sync, Linear close) which happens after merge, outside this skill.
