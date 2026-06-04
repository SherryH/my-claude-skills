# risk-audit catalog — portable cause-families (Band 1–2)

Each entry is a LENS for the diverse-verification fan-out. `principle / detect / pin /
fix` transfer to any repo; `eg:` is local colour (strip when porting); Band-2 entries
carry a `mechanism:` slot the project's adapter binds.

- **Band 1** — zero stack assumptions; the lens runs in any repo, drop-in.
- **Band 2** — principle is portable, but the lens needs a `mechanism:` (bound by the
  project adapter or stack auto-detect) before it can `pin`/`fix` concretely.
- **Band 3** is intentionally absent here — local rules with only a portable kernel
  live in the project adapter, never in this catalog.

> Not a lens: comment/provenance hygiene has no runtime bug-cause — it is a post-mode
> cleanup STEP in SKILL.md, enforced via the project's comment rule, not a cause-family.

---

## 1. Seam side-effects untested        [Band 1]
- **principle:** A unit's contract includes its side effects on collaborators (cache
  invalidation, emitted events, the scope/shape handed to an injected dep, WHICH client
  got WHICH call) — not just its return value. Mount BOTH sides of the seam and assert
  the observable downstream outcome, never the writer's local state or an invocation
  count alone.
- **detect:** a test that mounts only the writer; `.toHaveBeenCalled` instead of a
  rendered/persisted result; a long-lived cache entry (staleTime) with a mutation that
  must invalidate it; one shared mock standing in for two collaborators the runtime
  treats differently.
- **pin:** mount the collaborator the effect flows to, drive it through the writer,
  assert the downstream result changed. (Escape hatch: exact-key invalidation assertion
  when mounting the consumer is disproportionate.)
- **fix:** test through the real seam; if two collaborators differ at runtime, mock them
  separately and assert which received which call.
- *eg:* RLS auth-vs-admin shared mock passed green while the real write was denied;
  `staleTime:Infinity` draft query never invalidated → edits reverted on reload.

## 2. Fork / rewrite parity drop        [Band 1]
- **principle:** A v2/migration/rewrite must not silently drop behaviors OR internal
  invariants the original guaranteed. Scope from "what must this preserve", not only the
  new feature's acceptance criteria — new tests pass while old guarantees vanish.
- **detect:** a new dir/component/path paralleling an old one; AC written from the new
  feature only; a read/persistence rewrite with no Keep/Drop list of casing transforms,
  derived fields, defaults, ordering.
- **pin:** port the original's scenarios as the FIRST red tests against the new path
  (characterization-before-fork). A behavior with no test is the dangerous case.
- **fix:** enumerate original behaviors AND data-shape invariants, mark each
  Keep/Drop/Defer with a cited authority; every Drop is a top-line BEHAVIOR CHANGE
  needing sign-off, never a footnote; plan-silence = OPEN question.
- *eg:* v2 editor dropped the publish title-gate; a version-read returned the pages blob
  verbatim, leaking snake_case (the normalization was an unnamed invariant).

## 3. Non-exhaustive case handling      [Band 2]
- **principle:** Widening or enumerating a union/enum partially compiles clean and passes
  happy-path tests, but is one refactor from silently dropping a member.
- **detect:** a hand-written array/switch/ternary over a SUBSET of a union's members; the
  same literal union redeclared in ≥2 files; "this type is wider than reachable states"
  noted in prose instead of guarded.
- **pin:** a test that iterates EVERY member of the union (keyed by the type).
- **fix:** model the mapping so a dropped member fails to compile/test; one exported type
  per concept.
- **mechanism:** `<exhaustiveness device — eg TS Record<Union,_> → TS2741; Rust match;
  Python assert_never>`

## 4. Implicit cross-boundary transform contract     [Band 2]
- **principle:** When data crossing a layer relies on a transform — key casing, timezone,
  units, defaults, ordering — that NO schema/type/test on either side asserts, that
  transform IS a load-bearing contract living in nobody's file. It defaults to
  emergent+untested and breaks the moment one path forgets it.
- **detect:** a generic util (snake↔camel, TZ format) applied wholesale to an opaque blob;
  a value formatted/parsed inline at a call site instead of via one chokepoint; an
  "opaque" field (`record<unknown>`) crossing a boundary two layers read differently.
- **pin:** round-trip test across the REAL transforms (not a JSON identity stub),
  parametrized over both raw and transformed fixtures, asserting the shape on the wire.
- **fix:** give the transform a structural home — a schema refine / a single typed
  chokepoint util — BEFORE the fork, not prose.
- **mechanism:** `<where the contract is declared — eg Zod .refine; a date-utils
  chokepoint; a serializer boundary>`
- *eg:* pages blob stored snake_case, read verbatim → blank survey; raw `Date` in the
  viewer TZ → wrong calendar day near midnight UTC.

## 5. Coding against assumed (not verified) substrate     [Band 2]
- **principle:** Writing queries/UI against an ASSUMED schema or design rather than the
  real source ships bugs that mocks and low-res screenshots hide — a mocked client
  silently accepts a non-existent column; a rasterized comp hides menu items / icons.
- **detect:** a column/filter pattern-matched from a sibling file; UI detail inferred from
  a screenshot; no read of the migration / design source in the diff's history.
- **pin:** a test/assertion tied to the real schema, or an enumeration of the real design
  layers.
- **fix:** read the authoritative source (migration file / design via its API) and
  enumerate it before writing; never pattern-match columns across tables.
- **mechanism:** `<source of truth — eg supabase/migrations/*.sql; Figma MCP file <KEY>>`

## 6. Silent error swallow              [Band 1]
- **principle:** Graceful degradation is fine; SILENT degradation is not. A real failure
  (endpoint down) must not become invisible.
- **detect:** a catch body with zero statements (comments only); `.catch(() => {})`; a
  swallowed promise.
- **pin:** assert the failure path is observed (telemetry captured / logged / surfaced).
- **fix:** capture/log at the swallow site; only noise-level expected cases may drop, and
  then say why.

## 7. Truthiness / coercion footgun     [Band 2]
- **principle:** Reading a value with the wrong coercion silently inverts behavior — an
  object is truthy, `0`/`""` are falsy, `??` ≠ `||`. The line that LOOKS right is wrong,
  and the type system permits it.
- **detect:** `data ?? false` / `&&` / ternary on a value that is an object or a nullable
  number/string; a boolean derived from a shape rather than a real boolean.
- **pin:** a test feeding the falsy-but-truthy value (`{enabled:false}`, `0`, `""`) and
  asserting the intended branch.
- **fix:** narrow to a real primitive at the source (select/unwrap) so the consuming line
  becomes actually-correct, not coincidentally-correct.
- **mechanism:** `<unwrap point — eg a TanStack select; a typed accessor>`
- *eg:* flag endpoint returns `{enabled:false}`; `data ?? false` → always-on.

## 8. Authorization gap / wrong layer   [Band 2]
- **principle:** Authz that is missing, at the wrong layer, or contradicted by a
  data-access policy is a security bug a happy-path test never sees. Separate
  authentication (edge) from authorization (business layer, first line); a data-policy
  boundary (eg RLS) must be honored by the client the runtime actually uses.
- **detect:** a permission check at the route/edge instead of the service; a new handler
  missing an authz call; a write using a client the policy denies; new code copying a
  legacy authz pattern instead of the target convention.
- **pin:** a test asserting an unauthorized caller is rejected, AND (if a data policy
  exists) that the privileged path uses the privileged client.
- **fix:** authz as the first line of the method; new code matches the TARGET convention,
  not the surrounding legacy.
- **mechanism:** `<project authz primitive + data-policy model — eg authorize() +
  Supabase RLS>`

## 9. Duplication / reuse-miss          [Band 2]
- **principle:** Repetition of a type, markup, or logic (≥2–3×) is a signal to
  consolidate; a reusable primitive must not branch on domain enums (domain→presentation
  belongs in an adapter at the call site).
- **detect:** the same union/markup/logic in ≥2 places; a "shared/primitive" component
  importing a domain type or holding `Record<DomainEnum, style>`.
- **pin:** mostly review-time; a totality test if a union is involved (see #3).
- **fix:** extract one shared definition; search for an existing primitive FIRST and
  record why it didn't fit if you build new; keep domain mapping in a thin adapter.
- **mechanism:** `<component/variant lib — eg shadcn + cva>`
