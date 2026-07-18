# ADR 0020 — Re-homed scripts leave an executable stale copy in consumer trees

**Status:** proposed — awaiting decision
**Date:** 2026-07-18
**Reversibility:** two-way
**Raised by:** `/arc-change`, from the Phase 03 checkpoint-1 adversarial pre-mortem

## Context

Every sync path is purely additive, by design and by non-negotiable:

- `sync-to-project.sh:99` — `rsync -a`, no `--delete`
- `sync-to-project.sh:103` — `cp -r`
- `sync-to-project.ps1` — robocopy, no `/PURGE`
- `EXCLUDES` (`:92`) filters what is copied; it never prunes what is already there

So when Phase 3 moves `.claude/scripts/council-lint.mjs` to `.claude/scripts/council/`, any
consumer that upgrades ends up with **both** — six council scripts where three belong.

This is already-known territory: **REQ-10** ("Stale files are visible, never deleted") owns it,
and **non-negotiable #51** forbids the obvious fix outright — *"Consumer repos: never delete —
attic move to `.claude/attic/DATE/` only, report before mutate."* `rsync --delete` and robocopy
`/PURGE` are therefore **not options**, they are violations. REQ-10 is scheduled for **Phase 5**,
and `phases/phase-03-spec.md:40` explicitly puts attic/prune out of scope for Phase 3.

What the pre-mortem adds is that re-homing produces a **sharper** kind of stale file than REQ-10
anticipated. REQ-10's framing is about unowned clutter being *visible*. A re-homed script is worse
than clutter:

- it is **executable and still runs** — `council-lint.mjs:36` resolves the repo root from `cwd`,
  not from the script's own location, so the orphaned flat copy works and exits 0
- it is **silently wrong** — it is a frozen fork that will never receive another update
- `.claude/arc-registry.json` reports the target **clean**, because the registry lists what was
  installed, not what is present
- nothing tests it: `tests/sync.bats:7` mktemps a **fresh** target on every case, so
  upgrade-over-an-existing-install is not covered anywhere in 243 tests

Across all five checkpoints this compounds — up to five products' worth of frozen executables.

## Decisive constraint on timing

**REQ-09 places the first real external consumers in Phase 4** (venturemind / InvoiceFly), status
`active`. Today the count is effectively zero. The residue is therefore near-theoretical during
Phase 3 and becomes real the moment Phase 4 dogfoods into a live repo — which is also the first
time anyone would *upgrade* an existing install rather than create a fresh one.

## Options considered

1. **Accelerate REQ-10 into Phase 3** — build prune-report + attic before the first move.
   Pros: consumers never see a stale executable. Cons: pulls ~0.5w of Phase 5 into the phase the
   plan already calls the riskiest, and contradicts Phase 3's own risk-ordering rationale
   (re-homing waits until the seams are proven — adding new machinery mid-phase widens the blast
   radius of exactly the wrong phase). Appetite could absorb it (~10% burnt); risk discipline says
   don't.
2. **Accept the Phase 3→5 window, document only.** Pros: zero scope change; Phase 3 stays tight.
   Cons: leaves a known-broken upgrade path unowned across two phases, including all of Phase 4 —
   the phase whose entire purpose is putting arc into real external repos. Phase 4's evidence
   bundles would be collected on trees carrying frozen duplicates.
3. **Instrument in Phase 3, remediate before Phase 4 closes.** In Phase 3: one regression test
   that syncs a pre-move export then a post-move export into the *same* target and asserts the
   old path's survival (pinning current behaviour as a known gap, not asserting it is correct),
   plus a stale-path line in `/arc --status` derived from the registry. Then move REQ-10's
   prune-report ahead of Phase 5, to land before Phase 4 closes. Pros: no delete path invented, no
   non-negotiable bent, the gap becomes visible and tested immediately, and the real fix lands
   exactly when the first real consumer exists. Cons: REQ-10 spans two phases; Phase 5 keeps only
   the attic-move half.

## Decision

**PENDING — Ashiq's call.**

Recommendation: **Option 3.** It is the only one that respects both the non-negotiable (never
delete) and Phase 3's risk-ordering, while refusing to let a known-broken upgrade path ride
through the entire dogfood phase unowned. The sequencing falls out of the plan's own structure:
the problem becomes real when consumers become real, which REQ-09 pins to Phase 4 — so that is
the deadline, not Phase 5.

If Option 3 is taken, REQ-10's row moves from Phase 5 to "5 (attic) / 4 (report)" and the
instrumentation test lands as a Phase 3 exit-criteria line.

## Consequences

Whichever option is chosen, two facts are now recorded and must not be rediscovered:

- deletion is permanently off the table for consumer trees (non-negotiable #51) — any future
  "just clean it up" proposal is already answered
- `tests/sync.bats` has no upgrade-over-existing-install coverage at all; every case starts from
  a fresh mktemp target. That blind spot is independent of this decision and outlives it.
