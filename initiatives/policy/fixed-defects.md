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

Cycle 2, Phase 00, attack round 2 (`b6f99ff`; 18 findings: 13 fixed, 2 rejected, 3 LOW to the debt ledger):

- **The writer chose its spine by `ARC_SPINE_ROOT`/`--root` while the reader pinned the governing root, so evidence sealed where nothing reads it** — arc-run writes a refusal only when its spine is `canonicalSpine()`, and says so when it is not (L1/B4) — *every writer of evidence: compare the spine you write to with the one that is read*
- **A deny at L1 counted as proof of L1's propose path** — at L1 only a propose qualifies (L2) — *any "proof a level works" that accepts a different decision than the level's own*
- **A receipt could declare the other surface and borrow its writer** — surface must equal the subject's (L3) — *every self-declared field that selects a trust path*
- **A declared `evidence_days: 0` read exactly like no N** — `invalid-bar` reason (L7) — *any validator that folds "invalid" into "absent"*
- **The writer cut the reason by code point but the validator measured UTF-16 units, so astral reasons lost their receipt** — one `capReason`/`MAX_REASON` shared by both (B2) — *every bound enforced in two places: one function, one unit*
- **The day bound counted any line matching three fields, so one forged line suppressed the genuine receipt all day** — `sealedRefusalToday` requires a sealed, corroborated refusal (B3) — *any dedupe check: count only what the reader would count*
- **A blocking `open` on a FIFO still hung the reader; a symlinked day file was followed; arc-run re-added a by-path read** — one `readDayFile` (lstat, O_NONBLOCK, O_NOFOLLOW, fstat) shared by reader and writer (B1/L10/B5) — *fix the pattern in every copy, not the file the attacker named*
- **The dedupe Set was marked before the emit outcome** — marked only once sealed (B6, in-process half) — *any "done" flag set before the work succeeds*
- **The EPIPE handler covered the text path only** — attached once at the top of `main` (B7) — *every early-return branch that writes*
- **A BOM was stripped per file, not per line** — per line (L6) — *every line-oriented parser*

Rejected in round 2: L4 (a nested payload passes the profile) — `already-covered`: the loader runs the closed-shape validator on every event; L8 (a failed receipt retried next denial breaks once-per-day) — `unsupported`: nothing was sealed, and the sanitizer no longer emits lone surrogates.

Rejected in round 1: L6 (n/a cells keep `last_refusal`: that IS REQ-03's acceptance, and an n/a cell never moves the bar) — `already-covered`; L10 (a deny at L1 is impossible) — `unsupported`: `incident.mjs` documents integrity denies at L1.

Cycle 2, Phase 01, attack round 1 (`0993467`; 17 findings: 11 fixed, 4 rejected, 2 LOW to the debt ledger):

- **The guard's emit inherited the spine selector, so a receipt could seal where the guard did not read** — `ARC_SPINE_ROOT` pinned to the read spine, id read back from its day file (L2/B2) — *the writer/reader twin again: every emit in a reader-driven tool*
- **The "previous verdict" was any line with the guard's name; an approval sealed before a failed run.completed left no digest, so retries stacked approvals** — previous digest only from sealed guard receipts with a 64-hex digest, from run.completed OR the approval (B3/B4) — *any dedupe key stored only in the LAST of several writes*
- **A guard run with `--as-of` sealed real receipts and became every cell's audit** — `as_of_overridden` recorded; such runs never audit and dedupe only against their own kind (B5) — *every clock override that reaches a durable write*
- **The emit failure said only "Command failed: bash"** — the emitter's stderr plus the PowerShell/WSL hint (B1) — *every spawned helper's failure message*
- **One fold refusal blanked the whole Policy room** — cells served with `evidence: null` and a named `evidence.error` (B7) — *a new optional field must not be able to take down the old required ones*
- **The door test checked evidence shape, not coherence** — n/a iff L0 or out of scope, BELOW-BAR iff in scope and not fresh, fresh carries an age (L1/L4/L5/L8) — *a test that checks a label without its content*

Rejected in Phase 01 round 1: L7 (`allCells.length > 0 &&` sits INSIDE the assertion, so an empty list already fails) — `unsupported`; L3 (a previous receipt without a digest raises an approval) — `already-covered`: that is the safe direction; L6 (dedupe ignores as_of) — `already-covered`: deduping an unchanged BELOW-BAR set is ADR-0511's design (plan-attacker F6); L9 (a renamed guard process) — `non-actionable`: there is no older guard version.

Cycle 2, Phase 01, attack round 2 (`f03f3fe`; 17 findings: 6 fixed, 4 rejected, 7 LOW to the debt ledger):

- **An explicit `--as-of` naming today read as a real run, and an overridden run still raised a real approval** — any explicit `--as-of` is an override; an override never raises an approval (L7/B2) — *a test or back-dated run must have no outward-facing write*
- **The read-back matched the id as a substring** — it now finds the event: this id, this kind, this guard (L3) — *every read-back: parse the record, never grep its id*
- **The emitter's root selector was still inherited** — `ARC_ROOT` pinned with `ARC_SPINE_ROOT` (L9/B1) — *close the whole family of selector variables, not the one named*
- **The interactive day bound accepted any matching line at any level** — it must be at the level being recorded (L6/B3) — *self-declared fields on a no-corroboration path*
- **CLEAN said "all fresh" with nothing in scope** — says "no in-scope cell (nothing above L0 to evidence)" (L5) — *a clean message must not claim what it never measured*

Rejected in Phase 01 round 2: L1 (the previous-digest loop reads unvalidated lines) — `already-covered`: every event in `inputs.events` passed `validateEvent` + `eventSha`, and the process id and outcome are matched exactly; L2/L8 (the digest omits the no-writer/clearable split) — `already-covered`: `state` encodes the split (unknown = no-writer); L4 (duplicate cell keys in the door map) — `unsupported`: the fold builds one cell per subject x capability by construction.

Cycle 2, Phase 02, attack round 1 (`9b82c06`; boundary 7 findings: 5 fixed, 1 rejected, 1 to the debt ledger; the logic surface returned an empty list in 11 s, recorded as UNVERIFIED rather than as "no findings"):

- **The drift check ran only AFTER the copy, so a paste generated from a stale file silently reverted another change** — `verify-paste.mjs --pre` gates the copy (B1) — *any check meant to catch drift must run before the overwrite*
- **Hashes were of raw bytes, so an autocrlf checkout read every file as DIFFERS** — CRLF folded to LF in generator and verifier (B6) — *every byte-compare a Windows owner will run*
- **The hook checked one spine and spawned the emitter with the whole environment** — `ARC_SPINE_ROOT`/`ARC_ROOT` pinned in the child env (B3) — *the writer/reader twin, fourth time: pin every selector at every spawn*
- **The failure report inside the catch could itself throw, turning the block into exit 1** — guarded (B5) — *a best-effort path's own logging must be best-effort*
- **`policy-lint other.yaml --evidence` linted one file and judged the evidence of another** — `--evidence` refuses a non-governing path (B7) — *a delegated verdict must be about the same subject as the caller's*

Rejected in Phase 02 round 1: B4 (a WSL `bash` makes every hook receipt fail silently) — `unsupported`: the hook is spawned by the PreToolUse dispatcher, which is itself bash, so `bash` on its PATH is that same bash.

Cycle 2, Phase 02, attack round 2 (`0da9701`; boundary 8 + logic 15 -- the first logic run failed its output contract and was re-run on the same SHA before any fix): 7 fixed, 9 rejected as written against older code or already covered, the rest LOW to the debt ledger.

- **Parallel tool calls ran parallel hooks, and the check-then-emit sealed two receipts** — an O_EXCL lock around the day check and the emit, taken over after 60 s if stale (r2 L1, closing debt row 10) — *any check-then-write across processes needs the lock, not a comment*
- **`policy-lint --evidence` spawned the delegate with an inherited root and spine** — `cwd` and both selectors pinned; a spawn failure is named (r2 B1/B7) — *the writer/reader twin, fifth time: every spawn of a judge*
- **The env-pin and non-throwing-report fixes had no fixture** — a decoy `ARC_ROOT`/`CLAUDE_PROJECT_DIR` test and a closed-stderr test (r2 B3) — *a fix with no test that fails without it is not applied*
- **A 3000 ms bound measured once on one box makes the first-receipt test flaky on a slow runner** — `ARC_POLICY_REFUSAL_TIMEOUT_MS` (a wait, never a selector) raised in the tests (r2 B5) — *every timing bound inside a test*
- **A loosened assertion stopped proving the cell was classified** — now `no-writer|clearable`, both states named (r2 B6) — *a test made to pass in two worlds must still assert something in each*

Rejected in Phase 02 round 2: B2 (CRLF bytes hide behaviour) — `already-covered`: `.gitattributes` sets `* text=auto eol=lf`, so no working copy here is CRLF; L2, L4, L7, L9 — `already-covered`: written against the round-1 paste (env pinned, catch guarded, the full field set matched, realpath compare); L5 (the N edit counts matches, not which) — `unsupported`: the design is N on EVERY in-scope L1 grant, and a count change refuses to generate; L11 (hook and emitter clocks differ) — `unsupported`: one host clock, the day computed once per call.
