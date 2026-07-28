# Phase 03 — Intelligence library + LexOS pilot + blind-test launch

**Goal (one line):** The tagged design-intelligence library exists, the full loop runs end-to-end on LexOS (real premise, upgraded pilot brief), and the two-stream blind test (ADR-0040) is LAUNCHED — evidence may trail the build (ADR-0041); REQ-01 stays `active` until both streams pass.
**Appetite:** 0.75 days
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] Library schema + first entries: every entry typed (Pattern/Craft/Brand/Anti) + tagged (domain · user type · platform · interaction problem · confidence · outcome) — untagged observations rejected; principle recorded, never just the screenshot
- [ ] LexOS pilot: the 4 companion drafts re-read fresh; pilot brief upgraded (primary object case-vs-client answered with real lawyer input — doubles as Stream B's first data point; platform contract: desktop Y · mobile Y · tablet N · keyboard-first Y · reduced-motion Y); full loop run on the real LexOS stack
- [ ] Blind test launched: 3 directions packaged blind (arc origin undisclosed); Stream A + Stream B requests actually sent; two evidence files created to receive results
- [ ] Pick + prediction receipts on the spine; outcome-evidence path (`note.logged`) documented
- [ ] tests green · live demo · tracker updated — the phase-done call on trailing evidence is the OWNER's (ADR-0041)

## Verification plan

- One coarse line (refined via `/arc-change` when the phase starts): live demo = the
  LexOS explore-critique-pick run end-to-end + both stream requests sent + library
  entries lint-valid (tag completeness).

## Rabbit holes in this phase

LexOS tokens-proposal boundaries — the drafts deliberately do NOT touch danger/status/
spacing/disabled values (`disabled:bg-gray-500` 4.83:1 and the Map-based statusBadge are
intentional; do not "clean up") · waiting on evidence inside the appetite (launch ≠ wait,
ADR-0041).

## Out of scope for this phase

Evals suite (§2.9, later cycle) · W3+ tools (ADR-0039) · gate promotion · outcome-evidence
tooling beyond the documented `note.logged` path.

## Your-setup / pending

LexOS repo checked out locally + its `docs/design/` drafts current · recruiting channels
for Stream A (design communities/peers) and Stream B (LexOS lawyer contacts) at ₹0.

## Non-negotiables (verbatim from PLAN)

- The critic never writes product code — enforced mechanically (no Edit tool + PreToolUse edit-hook path scope + scoped receipt Bash), never by prose (ADR-0034).
- No lorem ipsum in any reviewed artifact — realistic content from the content contract.
- No absolute quality scores anywhere; numbers exist only as blind comparative ranking.
- Every design review and every owner decision leaves a spine receipt in the closed vocabulary (ADR-0035).
- Taste is a decision recorded as a design ADR, never a research finding; research receipts only for factual/pattern claims.
- A new gate/lint/parser is not done until an adversarial construct-a-breaking-input pass has run and the found holes are fixed + pinned as fixtures.
- Any edit to a product-shipped file treats sync-golden regen as a named step: diff the delta first, confirm only intended paths moved, then re-record.
