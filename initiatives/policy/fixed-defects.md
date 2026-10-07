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

Cycle 2, Phase 00, attack round 1 (`9dc4cbe`, logic on deepseek-v4-flash + boundary; 18 findings, 16 fixed, 2 rejected):

- **The evidence reader read a linked worktree's private spine and printed a normal-looking "17 BELOW-BAR, 0 refusals"** — `load.mjs` `assertCanonicalSpine` refuses a worktree, a missing spine and a foreign `ARC_SPINE_ROOT` (L1/B1/B2) — *every reader of the spine: a reading of the wrong spine is confident and wrong*
- **A headless refusal could cite an incident written AFTER it, of another version of the process, that never named the capability** — `fold.mjs` corroboration: ULID order, full `process@version`, typed `denials` on the incident (L2/L3/L5) — *any cross-reference check: verify order, identity and content, not just that the id resolves*
- **Single-line text excluded only C0, so U+2028/2029/NEL and lone surrogates passed; a UTF-16 cut split surrogate pairs** — validator rule widened, arc-run sanitizes and truncates by code point (L4/B8) — *every free-text field bounded by `.length` or a C0-only class*
- **`Date.UTC` rolled 2026-02-30 into March, so an impossible as-of shifted every age silently** — `isCalendarDay` round-trips the parts, in the fold and the CLI (L7/B4) — *every date parsed by shape alone*
- **A policy with no subject folded into a zero-cell reading that looked clean** — the fold throws (L9) — *any summary whose clean state and empty state print alike*
- **The arc-run writer had no day bound, so a job denied every 15 minutes wrote thousands of receipts** — `refusalSealedToday` (B3) — *any receipt emitted on a recurring path*
- **BELOW-BAR exit 3 was set after the output loop, so a closed pipe turned it into exit 1** — exit code set first, EPIPE swallowed (B5) — *every CLI whose exit code is its verdict*
- **A type check then a read by path could be split by a swap (FIFO TOCTOU)** — one descriptor, `fstatSync` then read (B7) — *every check-then-use on a path*
- **Programs embedded in bats shell strings** — moved to `tests/fixtures/policy-evidence/spine-probe.mjs` (B6) — *CLAUDE.md: a program in a shell string carries no quotes*

Rejected in round 1: L6 (n/a cells keep `last_refusal`: that IS REQ-03's acceptance, and an n/a cell never moves the bar) — `already-covered`; L10 (a deny at L1 is impossible) — `unsupported`: `incident.mjs` documents integrity denies at L1.
