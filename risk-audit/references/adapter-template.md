# risk-audit adapter — <PROJECT NAME>

## When to create this
The skill runs **drop-in with the Band-1 lenses alone** (seam-side-effects,
fork-parity, silent-swallow) — no adapter needed. Create this file the first time
you want the **Band-2 lenses** to fire with *this* project's tools — i.e. as soon as
you want exhaustiveness / cross-boundary-transform / verify-substrate / coercion /
authz / reuse checks. Run `risk-audit setup` (auto-detects your stack and drafts it),
or copy this template to `<repo>/.claude/risk-audit.md` by hand. Keep it THIN —
pointers to substrate you already maintain, never copies.

## Minimal example (a small TS + Vitest + Prisma API — copy, then grow)
Bind only the slots your stack has; omit the rest. A first adapter can be this short
— it already unlocks lenses #3, #5, #8 here; the others stay Band-1 until you add them.

```markdown
# risk-audit adapter — acme-api

## Tier-2 substrate to read
- conventions: README.md "Conventions"; docs/adr/

## Band-2 mechanism bindings
- #3 exhaustiveness  → Record<Union, _> → a dropped member is TS2741
- #5 source of truth → prisma/schema.prisma (read before writing a query)
- #8 authz + policy  → requireUser() middleware, first line of the handler; no row policy

## Comment rule
- WHY-not-WHAT; no issue/PR refs in committed source

## Test mechanism
- framework: Vitest
- mock boundary: mock only the Prisma client; routes/services/validation stay real
- placement: test/integration/
```

---

## Full skeleton (all slots — fill what applies, delete what doesn't)

## Tier-2 substrate to read (the lenses read these at runtime)
- bug log:        `<path §section — the cross-feature "don't re-learn" lessons>`
- learned rules:  `<glob — eg feedback-*.md memories>`
- conventions:    `<path §sections — the always-read coding patterns>`

## Band-2 mechanism bindings (unlocks the Band-2 lenses)
- #3 exhaustiveness  → `<device — eg Record<Union,_> → TS2741>`
- #4 transform home  → `<eg Zod .refine on the boundary schema; a date/format chokepoint util>`
- #5 source of truth → `<eg supabase/migrations/*.sql; design via Figma MCP file <KEY>>`
- #7 coercion unwrap → `<eg TanStack select; a typed accessor>`
- #8 authz + policy  → `<eg authorize() first line + RLS model>`
- #9 reuse primitive → `<eg shadcn + cva; components/shared/>`

## Band-3 local rules (this project only — portable kernel in brackets)
- dates    → `<eg date-utils.ts, never raw Date>`   [kernel: never format in viewer TZ]
- layering → `<eg Route→Application→Service→Repository; routes never call repos>`
- <surface parity> → `<eg every behavior works in live + preview render contexts>`

## Comment rule (drives the post-mode cleanup step)
- `<path §section — eg WHY-not-WHAT, no plan/issue/doc provenance, no scratch comments>`

## Test mechanism (how `pin` tests are written here)
- framework: `<eg Vitest + Testing Library; Playwright for visual>`
- mock boundary: `<eg only the DB client + auth services; everything else real>`
- placement: `<eg tests/integration/>`
