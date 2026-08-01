# Stage reference

## Common subagent preamble (start every stage prompt with this, values filled in)

> You are one stage of a shipping pipeline for `<TICKET>` in the worktree `<ABS_WORKTREE_PATH>`. Work only inside that worktree. Your final message is consumed by an orchestrator — return your stage report as raw structured markdown, not conversation.
>
> Hard constraints (they hold in every form, including `git -C` / `env -C`): commit at green checkpoints under the user's own git profile with conventional-commit messages and no Co-Authored-By or agent trailers; pushing, history rewriting (`reset`/`rebase`/`clean`), `git stash`, and every `supabase db` / DB-destructive command are the user's alone.
>
> When done, append your section (`## Stage: <name>` — status, key outputs, findings→commit table if any) to `<ABS_WORKTREE_PATH>/.claude/pipeline/<TICKET>.md`, then return the same content.

## Stage table

| # | Stage | Invokes | Model | Inputs (pipeline sections + extras) | Completion criterion |
|---|-------|---------|-------|-------------------------------------|----------------------|
| 1 | risk-audit pre | `/risk-audit pre` | session | ticket title/criteria/labels | Risk list + prescribed red-first tests written; each risk names its test |
| — | **GATE 1** | orchestrator | — | stage 1 section | User approved plan, conditionals, escalations |
| 2 | tdd | `/tdd` | sonnet (opus on escalation) | ticket + stage 1 | Every prescribed test exists and is green; affected suite + `type-check` + eslint on touched files green; work committed |
| 3 | figma-parity *(cond.)* | `/figma-parity` | session | the Figma link + built UI | Element-by-element diff produced; deviations fixed or explicitly listed |
| 4 | risk-audit post | `/risk-audit post` | session | stage 1 + the diff | Every pre-risk verified handled; step-5 runtime gate run in the real browser with evidence captured |
| 5 | pr-review | `/pr-review` | session | the diff | Findings enumerated; must-fixes AND nice-to-haves applied; checks green on final diff |
| 6 | code-review *(cond.)* | `/code-review` | session | the diff + ticket | Standards + Spec axes reported; findings fixed or flagged for Gate 2 |
| — | **GATE 2** | orchestrator | — | all sections | User approved the run report |
| 7 | create-pr | `/create-pr` | sonnet | all sections | PR exists; body sourced from the pipeline file; base branch verified (stacked-aware) |

The diff for review stages: `git diff <base>...HEAD` where `<base>` is the branch this worktree stacked on (check `gh pr list` / branch parentage — main only when unstacked).

## Opus escalation markers (execution stages only)

Escalate the tdd implementer when the stage-1 report shows any of: high-severity risks touching concurrency, migrations, or data invariants; the slice crosses ≥2 module seams or rewrites a read/persistence path (§9 parity territory — Keep/Drop invariant list present); prescribed tests flag subtle failure modes.

Escalate a repair fixer when the failure is non-mechanical: the re-run failed for a reason outside the enumerated findings, or the runtime gate failed while tests are green.

Judgment stages (1, 3–6) stay on the session model in every case.

## Repair cycle (once per stage)

1. Spawn a fresh fixer agent: the common preamble + the failing check's findings/evidence + the relevant pipeline sections.
2. Re-run the **same** stage check on the resulting final diff (fresh agent again).
3. Green → append both the fix and re-run outcomes to the stage section and continue. Red → halt per `SKILL.md` §5.

## Gate report templates

**Gate 1**

```
## GATE 1 — <TICKET>: <title>
Risks (N): <one line each, severity-ordered>
Prescribed red-first tests: <list>
Conditional stages: figma-parity <ON (link: …) | OFF (no link)> · code-review <decided after tdd>
Model plan: implementer <sonnet | opus — reason>
```

**Gate 2**

```
## GATE 2 — <TICKET>: ready for PR
Built: <2-3 lines> · Tests: <added/passing counts>
Findings → commits: <every finding, one row each: source stage · finding · resolving commit | deferred+why>
Runtime gate: <evidence — URL/screenshot ref>
PR: <title> → base <branch>
<draft body>
```

**Halt**

```
## HALTED at <stage> — <TICKET>
Failed: <criterion> · Evidence: <output/paths>
Repair cycle: <attempted → outcome | not applicable (infra)>
Resume: /ship-slice <TICKET>
```
