# Trigger scan before the Phase 06 / 07 close, 2026-08-23

`/arc-phase-done` step 5: a FIRED assumption not yet routed through `/arc-change`, or an ADR revisit
condition that is now true, is unresolved risk and blocks a close. Seven assumption rows and
seventeen cycle ADRs, each checked against the tree rather than against memory.

## Assumptions ledger

| Row | Trigger | State |
|---|---|---|
| A-01 | the smoke invocation has not succeeded by the end of Phase 04's appetite | **did not fire** — Phase 04 closed 2026-08-16 with the invocation proven |
| A-02 | a red fixture is ACCEPTED by the parser, or a valid output rejected | **did not fire** — 47 red fixtures, all refused |
| A-03 | total elapsed exceeds the cap across a retry + fallback hop, or a timeout reads `reason: driver` | **did not fire** — proven on the real runtime: `01M07SDCNH28C881ZHWR2E4PSS`, `duration_ms 59921` against a 60s budget, `reason: budget` |
| A-04 | any of the 12 fixtures needs netns/seccomp/VM work → UNPROVABLE → **STOP** | **did not fire, and it was armed the whole way.** Fixture 7 entered Phase 06 flagged PARTIAL; it was closed by building the allowlisting proxy, not by re-reading the requirement |
| A-05 | Phase 07 reaches key provisioning with no figure recorded | **did not fire** — the figure is **zero**, read from the provider (`limit: 0`, `limit_reset: null`) and recorded by the owner issuing an unfunded key |
| A-06 | an `external-ok` pack carrying an `internal-only` block inside carried-over draft content is **not** refused | **DISCHARGED, and the fixture is the proof** — `tests/engine-data-boundary.bats`, *A-06 CARRY-OVER*. Refused, with the marker path reported at `carry_over.accepted_drafts[0].classification`, and the clean twin as negative control |
| A-07 | a row with one field empty, null or omitted LOADS | **did not fire** — the full 16-cell hostile matrix refuses, with a sound-row negative control |

## ADR revisit triggers

Fifteen of the seventeen are plainly not true (no runtime auto-update, no memory-plant regression, no
runtime proposed for a judging seat, no provider semantics change, no rejustification cycle, no
measured A/B, no vendor memory switch, no side effect from a `tools: []` process, no real "no
toolsets" spelling). Three deserve a written answer rather than a tick.

**ADR-0219 — *"a runtime is found able to receive data arc did not hand it"*.** Worth checking rather
than asserting, because ADR-0224 records that the runtime CLI treats an empty `-t` as a **fail-open**:
an empty toolset list gets all seventeen defaults, `web` and `browser` among them. That would be a
runtime fetching its own data, which is exactly this trigger.

Checked in the code and then across every process file. `toolsetsFor()` returns the narrowest real
toolset for a process that declares `tools: []` **with `permissions: declared`**, and the empty
string — the fail-open — only for one that declares `tools: []` **without** it. All six processes in
the tree:

| process | permissions | tools |
|---|---|---|
| `brief-materialize` | declared | `fs.read` |
| `build-in-public-draft` | declared | `[]` → narrowest |
| `commit-msg-draft` | declared | `git.op` |
| `day-close-roll` | declared | `fs.read` |
| `kickoff-plan` | unrestricted | `fs.read` |
| `review-diff` | declared | `git.op` |

**No process reaches the fail-open branch**, so the trigger has not fired. Written down because the
combination that would fire it is one word away from a shipped file, and the next process to declare
`tools: []` needs `permissions: declared` beside it or it silently gets seventeen.

**ADR-0214 — *"the pack-approval queue stalls more than two days"*.** The `N=3` approval was spent on
2026-08-18 and no dispatch has run since, which is five days. **The trigger has not fired, and the
distinction matters:** nothing was queued. A retry needed a *new* pack, and the pack did not exist
until today. A queue with nothing in it has not stalled — it was never fed. `pack-2026-08-23-cycle7`
is now written and is the first item this trigger could ever measure.

**ADR-0208 — *"the `review_by:` date on its `router.yaml` row"*.** `review_by: 2026-08-31`, and today
is **2026-08-23**. Not fired, and **eight days out**. Past that date the row is EXPIRED at load: every
dispatch refuses, naming the row, and one idempotent rejustify-or-retire proposal lands. That is the
mechanism working as designed, not a failure — but it is an owner action with a date on it, and it is
recorded here so the cycle does not discover it as an outage.

## ADR-0217's citation check is owed to the main clone

*"a runtime row whose cited decision ULID resolves to nothing on the spine"* cannot be re-verified
from this worktree: `.claude/state/` is gitignored and every worktree has its own empty spine, so
`arc-event` refuses to read across by design. Both ULIDs were verified present in `events/` and
absent from `_quarantine/` **before the row was written** (recorded in `engine/router.yaml`), and
re-confirming them belongs to the same main-clone step as the close receipts.

## Verdict

**Nothing blocks the close.** One assumption discharged with a fixture (A-06), one owner date eight
days out (ADR-0208), and one verification deferred to the main clone with the reason stated
(ADR-0217).
