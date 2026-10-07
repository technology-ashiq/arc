# Fixed defects — the policy lane's running list

Every attacker prompt carries this file, with one instruction: **check each line in every OTHER
file you are shown, not only the file it was fixed in.** Every attacker pass adds its fixed holes
here, one line each.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

Seeded at the cycle-2 kickoff (2026-10-07) from Cycle 9's closed findings
(`archive/PROGRESS-cycle9-2026-08-10.md`, `archive/evidence-cycle9-2026-08-10/phase-04/findings.md`):

- **Policy receipts could not be emitted at all: `arc-event` had no idem branch for the policy kinds, so every receipt was REJECTED and quarantined while the emitter exited 0** — Cycle 9 Phase 02 — *any test that drives a module directly instead of the sanctioned emitter and reads back the spine directory*
- **`decision_ref` was written, shape-checked and hashed into the idem, and never dereferenced, so a promotion citing an approval that did not exist raised a cap** — Cycle 9 Phase 04 finding 18 — *any reference field (a ULID, a receipt id) that is validated for shape but never resolved*
- **A trailing dot or space is a second name for the same file on Windows; the guard reported the target clear while the file went 3219 → 14 bytes** — Cycle 9 Phase 04 finding 10 — *every path compared by string rather than by filesystem identity*
- **`argv0_allow` was enforced only at L2; "list missing" was closed and "list present and then ignored" left open** — Cycle 9 Phase 04 finding 26 — *any check that runs on one level or branch and is assumed to run on the others*
- **The birth rule gated on `name:` while runtime authorizes the filename stem — validate one read, compare another** — Cycle 9 Phase 03 — *any gate whose subject string differs from the string the runtime actually uses*
- **7 of 18 tests stayed green with the whole check deleted, because each asserted only that a string was ABSENT** — Cycle 9 Phase 03 — *every assertion of absence; it needs a positive marker that the code ran*
- **A receipt emitted from a worktree landed in that worktree's spine, invisible to the canonical one** — Cycle 9 close — *any emit or read whose spine root is not pinned to the main clone*
- **`ARC_ROOT=/tmp/x` disarmed the whole headless gate in one variable** — Cycle 9 Phase 01 — *any env var that selects the root, the policy file or the spine a decision reads*
