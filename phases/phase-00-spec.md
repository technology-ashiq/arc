# Phase 00 — Steel thread: read-only vision critique with a receipt

**Goal (one line):** One real arc-internal route (`docs/strategy/arc-hq-mockup.html`, ADR-0045) independently inspected end-to-end by a read-only vision critic, leaving a `review.completed {"lens":"design"}` receipt on the spine, behind a warn-mode design gate.
**Appetite:** 1.25 days
**Depends on:** none

## Exit criteria (Definition of Done)

- [ ] `design-critic` agent exists (`.claude/agents/design-critic.md`) — NEW agent (ADR-0034), frontmatter tools: Read, Glob, Grep, Write, and the scoped entry `Bash(bash .claude/scripts/hq/arc-event.sh:*)` (the exact /arc-qa allowed-tools pattern — no general Bash); **no Edit**; protocol requires reading the rendered PNG back before judging (vision mandatory)
- [ ] PreToolUse edit-hook fragment `.claude/hooks/PreToolUse-edit.d/10-design-critic.sh` (same fragment dir + matcher pattern as the existing `.claude/hooks/PreToolUse-edit.d/00-freeze.sh`) scopes critic writes to `docs/design/critique/**` — bound to the critic context via a critic-session marker file under `.claude/state/design/` that the critique runner sets for the critic run's duration (freeze-hook state-file pattern — never a global always-on rule); while the marker exists, a write anywhere else blocks; bats test proves the block (non-zero exit)
- [ ] Critique runner exists: `.claude/scripts/design/design-critique.sh` — the orchestration piece. Responsibility split (mirrors the frozen plan §2.3): the RUNNER sets/clears the marker file, runs the deterministic render, invokes the design-critic agent, computes PASS/FAIL from the critique artifact (PASS ≡ zero VIOLATION), and writes the review-ledger `design` stamp via `review-ledger.sh` on PASS; the CRITIC writes only the critique artifact and emits the spine receipt via its scoped `arc-event.sh` Bash — the critic structurally cannot touch the ledger
- [ ] Minimal brief template exists (`docs/templates/design-brief-template.md`): the 4 contract section headers + the 7 interaction-model questions — just enough to critique against (full brief mode is Phase 1)
- [ ] Deterministic render: one command opens the target page at a fixed viewport via agent-browser and writes a PNG; the critique artifact records the screenshot's hash + viewport
- [ ] Critic run on the committed planted-defect fixture PNG (defect-injected clone of the target route) reports the planted defect as `VIOLATION`; run on the real route's clean render produces a critique artifact with ≥1 real finding classed VIOLATION / WEAKNESS / POLISH — no absolute scores (REQ-02)
- [ ] Receipt: `review.completed` payload `{"lens":"design","target":"<repo-relative route path>","result":"PASS|FAIL","screenshot_sha256":"<hash>"}` emitted via `bash .claude/scripts/hq/arc-event.sh emit` — `target` is the route-identification key the gate script matches on; visible through the reader; review-ledger `design` stamp (`.claude/state/reviews/`, via `review-ledger.sh`) written on PASS (PASS ≡ zero VIOLATION findings, REQ-03)
- [ ] `design` gate row in `arc.gates.yaml` — exact row (the file's strict flat parser: keys `name/check/mode/tier/runtime/evidence`, one `key: value` per line, no inline comments): `name: design` · `check: bash .claude/scripts/design/design-gate.sh` · `mode: warn` · `tier: hook` · `runtime: native` · `evidence: .claude/state/design/gate.txt`; the check script exits 1 when a critiqued route lacks a design receipt (matched on the payload `target` field), 0 when present, 1 with a WARN diagnostic on reader error — never 2 this cycle (REQ-04)
- [ ] tests added & green (one bats file, run foreground/serially)
- [ ] live demo run + output checked
- [ ] tracker updated — `PROGRESS.md` at repo root: this phase's row in `## Phase table` flipped ✅ with date + an entry appended to `## Done log` (format = the file's own existing rows; build playbook §8)

## Verification plan

- **Test command:** `bats tests/design-steel-thread.bats`
- **Expected failure first:** the test asserts (a) a critique artifact exists under
  `docs/design/critique/` for the target route, (b) the spine (via the reader) contains a
  `review.completed` event whose payload has `"lens":"design"` and the expected `target`,
  (c) a critic-context write outside the critique dir exits non-zero, (d) after a PASS
  run, the review-ledger records a `design` stamp for the current commit
  (`review-ledger.sh` output / `.claude/state/reviews/` stamp file contains `design`).
  Before the phase is built, (a) fails with "no critique artifact found for
  arc-hq-mockup" — red proven, then built to green.
- **Live demo scenario:** run the critique command against
  `docs/strategy/arc-hq-mockup.html` → watch the critic read the PNG back and write the
  critique artifact → run the reader/brief → the design receipt line is visible → check
  the review-ledger shows the `design` stamp for HEAD → attempt a write to `README.md`
  from the critic context → hook blocks it. Then run the gate with and without the
  receipt present → warn fires only when absent.
- **Real-system check:** the real agent-browser render of the real page (the fixture PNGs
  cover only the planted-defect contract test).
- **Expected evidence:** critique artifact (with screenshot hash line) · reader output
  showing the receipt · bats green output · blocked-write transcript · gate warn/pass output.

## Rabbit holes in this phase

- Building brief mode here — NO: minimal template only, brief mode is Phase 1.
- Touching the spine dedup bug — NO (ADR-0044): Phase 0 emits once per run.
- Windows path matching in the edit-hook scope — reuse the matcher from
  `.claude/hooks/PreToolUse-edit.d/00-freeze.sh` verbatim; do not write a new path
  normalizer.
- Critiquing interactivity on a static page — the platform contract for this route is
  desktop-only static; state-matrix depth waits for Phase 2 surfaces.
- Cross-OS render drift: the render command is authored/tested on the owner's Windows
  box, but CI is 3-OS — font/antialiasing/DPI differences can change the PNG hash between
  Windows dev and Linux/macOS CI with no code change; pin explicit font + disable AA in
  the render command before trusting the hash check, don't assume Windows-tested parity.

## Out of scope for this phase

Full 4-contract brief mode + design-lint (Phase 1) · manifest module (Phase 1) · explore/
theses/worktrees (Phase 2) · library + LexOS pilot (Phase 3) · gate promotion warn→block.

## Your-setup / pending

None — agent-browser installed, spine live, all local.

## Non-negotiables (verbatim from PLAN)

- The critic never writes product code — enforced mechanically (no Edit tool + PreToolUse edit-hook path scope + scoped receipt Bash), never by prose (ADR-0034).
- No lorem ipsum in any reviewed artifact — realistic content from the content contract.
- No absolute quality scores anywhere; numbers exist only as blind comparative ranking.
- Every design review and every owner decision leaves a spine receipt in the closed vocabulary (ADR-0035).
- Taste is a decision recorded as a design ADR, never a research finding; research receipts only for factual/pattern claims.
- A new gate/lint/parser is not done until an adversarial construct-a-breaking-input pass has run and the found holes are fixed + pinned as fixtures.
- Any edit to a product-shipped file treats sync-golden regen as a named step: diff the delta first, confirm only intended paths moved, then re-record.
