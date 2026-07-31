# ADR 0060 — root-mode evidence refuses to overwrite; the manifest covers the whole bundle

**Status:** accepted
**Date:** 2026-07-31
**Reversibility:** two-way
**Revisit trigger:** a cycle that legitimately needs to ADD to a closed bundle (a late
artifact for an already-closed phase) — today that is indistinguishable from an overwrite
and is refused; if it becomes a real need, it gets an explicit `--append` with its own
manifest semantics, not a relaxation of the refusal.

## Context

Closing Cycle 4's Phase 00 ran `arc-evidence.sh bundle 0`, which in root-mode writes to
`docs/evidence/phase-00/`. That directory was not empty: it held seven artifacts from a
previous cycle, and the run silently rewrote `manifest.json`'s commit pointer from
`fa794ea` (2026-07-28) to `c2d8fa1`. Git history shows the same directory has received
**four** different "close Phase 00" commits — 2026-07-17, 2026-07-23, 2026-07-28, and this
one — because the path is keyed on the phase number alone and carries no cycle identity.

ADR-0055 already recorded that `docs/evidence/` "interleaves Cycle-2 and Cycle-3 bundles
under flat `phase-NN` names", and closed that namespace on the grounds that new evidence
would land lane-scoped at `initiatives/<lane>/evidence/phase-NN/`. The gap it left is
narrow and structural: **Phase 00 has no lane.** Lane creation is `/arc-kickoff`'s alone
(ADR-0054) and this cycle's lane is not born until Phase 01, so the one phase that must
run before lanes exist is also the one phase whose evidence has nowhere legal to go —
lane-scoped is impossible, and root-scoped is the frozen path ADR-0055 declared the sole
canonical copy of pre-portfolio history.

Two distinct defects, and the second is why the first survived four cycles:

1. **Silent overwrite.** The bundle writes into whatever is at the path, with no check
   that something else already owns it.
2. **The manifest describes the writer, not the bundle.** It hashes only the artifacts
   that run collected — two of the nine files present — so `verify` returned
   "bundle verified" over seven unlisted files belonging to a different cycle. A gate
   that checks what it wrote rather than what is there cannot detect contamination, and
   this is exactly how the collision stayed invisible from 2026-07-17 to now.

## Options considered

- **Make the root-mode default path cycle-scoped** (`docs/evidence/cycle-NN/phase-MM/`) —
  **rejected.** Root-mode output is a byte-identical permanent consumer contract
  (ADR-0054), pinned by `tests/root-golden.bats`; changing the default path breaks it for
  every downstream repo. It would also need a cycle identifier parsed out of a markdown
  heading, which is precisely the fragile-contract bug class the council found twice.
- **Move the older bundles into per-cycle directories** — **rejected.** That is a history
  rewrite: manifests record paths and hashes, and ADR-0055's revisit trigger reserves it
  for a dedicated ADR with owner sign-off. The freeze holds.
- **Refuse the collision, and make the manifest describe the directory** — **accepted.**
  Neither changes any existing-passing behaviour: a fresh consumer repo bundling into an
  empty path is byte-identical to today, so the ADR-0054 contract is preserved.

## Decision

1. `arc-evidence.sh bundle` **refuses** when the destination already holds a bundle whose
   manifest names a different commit, printing the owning commit, its date, and the
   `--out` form that resolves it. Same-commit re-runs stay idempotent, so re-bundling
   during a close is unaffected.
2. `manifest.json` hashes **every file in the bundle directory**, not only the artifacts
   the run collected. `verify` therefore fails on a foreign or added file rather than
   passing over it.
3. Cycle 4's own bundles land at `docs/evidence/cycle-04-portfolio/phase-NN/` via the
   existing `--out` seam. `docs/evidence/phase-00/` and its siblings are **not touched**:
   the freeze is honoured, and the four historical closes keep the last state they were
   left in.

The safe path is the default and the unsafe one is now impossible to take silently. That
ordering is the point: the previous design let the operator do the wrong thing by
forgetting a flag, and said nothing.

## Consequences

- A consumer repo that has been overwriting its own phase evidence will start seeing a
  refusal. That is the defect surfacing, not a regression — the refusal names the commit
  that owns the directory so the operator can see what was about to be lost.
- `verify` becomes strictly stronger and may now fail on bundles that previously passed,
  including historical ones. Historical bundles are frozen and not re-verified as part of
  any gate, so this does not retroactively fail a closed phase.
- Cycle 4's evidence is not adjacent to earlier cycles' in the filesystem. `PROGRESS.md`
  carries the path, and Phase 01 moves this cycle's evidence lane-scoped per ADR-0055
  anyway, so the flat namespace gains exactly one directory and then stops growing.
- Phase 00's evidence is the only bundle this cycle writes in root-mode. From Phase 01 the
  lane exists and ADR-0055's lane-scoped rule governs, unchanged.
