# Phase 03 — Intelligence library + LexOS pilot + blind-test launch

**Goal (one line):** The tagged design-intelligence library exists, the full loop runs end-to-end on LexOS (real premise, upgraded pilot brief), and the two-stream blind test (ADR-0040) is LAUNCHED — evidence may trail the build (ADR-0041); REQ-01 stays `active` until both streams pass.
**Appetite:** 0.75 days
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] Library schema + first entries: every entry typed (Pattern/Craft/Brand/Anti) + tagged (domain · user type · platform · interaction problem · confidence · outcome) — untagged observations rejected; principle recorded, never just the screenshot
- [ ] LexOS pilot: the **2** companion drafts re-read fresh (`docs/design/2026-07-26-dashboard-clients.md`, `docs/design/2026-07-27-case-workspace.md` — the plan said 4; that count came from this cycle's kickoff and never from the frozen design source, see the corrected ledger row); pilot brief upgraded (primary object **answered: case, not client**, by a real LexOS lawyer 2026-07-29, receipt `01KYQ9B2BXMXWWADZZYVWXEGRT` — NOT the PROVISIONAL fallback; platform contract: desktop Y · mobile Y · tablet N · keyboard-first Y · reduced-motion Y); full loop run on the real LexOS stack
- [ ] Blind test launched: 3 directions packaged blind (arc origin undisclosed) — **packaging includes stripping the `max-w-shell` width-departure notes from variant-a and variant-b (variant-c has none), owner decision 2026-07-30, see AMENDMENT 2 below**; Stream A + Stream B requests actually sent; two evidence files created to receive results ✅ (`docs/design/blind-test/lexos-case-workspace-v1/`)
- [x] Pick + prediction receipts on the spine; outcome-evidence path (`note.logged`) documented
      — pick `variant-b` + falsifiable prediction sealed 2026-07-30 (`decision.recorded`
      `01KYRX3HYM2BYMHKEZZD1RDHN9` deciding approval `01KYRX33C27326BSZJAWVEVR3E`); outcome path
      documented at `docs/design/blind-test/README.md` and the documented command VERIFIED by
      running it against a throwaway spine (`ARC_SPINE_ROOT`), not by reading it
- [ ] tests green · live demo · tracker updated — the phase-done call on trailing evidence is the OWNER's (ADR-0041)

## Verification plan

**Refined at phase open, 2026-07-29 (the coarse line above was written at kickoff).** Live
demo, in order — each step's evidence is named so none of it can be asserted at close:

1. **Library** — schema + first entries committed; every entry typed and fully tagged.
   *Evidence:* the tag-completeness lint runs and rejects a deliberately untagged entry
   (adversarial pass — a gate is not done until a construct-a-breaking-input round has run).
2. **Pilot brief** — upgraded from the 2 LexOS drafts, primary object recorded as **case** with
   the lawyer receipt cited, platform contract filled.
   *Evidence:* `design-lint` passes it against the real drafts before any variant starts.
3. **Explore run on the real LexOS stack** — theses → variants → critique → blind ranking →
   owner pick.
   *Evidence:* `decision.recorded` carrying the pick and a falsifiable prediction, plus every
   round's `review.completed`. Renders now come from the hardened renderer (#57), so each
   `screenshot_sha256` is reproducible — the first phase where that is true.
4. **Blind test LAUNCHED** — 3 directions packaged with arc's authorship undisclosed; Stream A
   and Stream B requests actually SENT; two evidence files created to receive results.
   *Evidence:* the sent requests, not drafts of them. **Launch ≠ wait (ADR-0041)** — the phase
   does not hold its appetite open waiting for replies.
   *Blocked on:* a Stream-B recruit (see Your-setup) and a Stream-A channel.
5. **Close** — tests green, tracker updated. The call on trailing evidence is the OWNER's
   (ADR-0041); REQ-01 stays `active` until both streams pass.

**Explicitly NOT verification:** that the directions are good. Three blind jurors rank them,
the owner picks, and the two streams judge — no absolute score anywhere (a non-negotiable).

## Rabbit holes in this phase

LexOS tokens-proposal boundaries — the drafts deliberately do NOT touch danger/status/
spacing/disabled values (`disabled:bg-gray-500` 4.83:1 and the Map-based statusBadge are
intentional; do not "clean up") · waiting on evidence inside the appetite (launch ≠ wait,
ADR-0041).

## Out of scope for this phase

Evals suite (§2.9, later cycle) · W3+ tools (ADR-0039) · gate promotion · outcome-evidence
tooling beyond the documented `note.logged` path.

## Your-setup / pending

**Settled at phase open (2026-07-29):**
- **LexOS checkout — CONFIRMED** at `E:/Work_Hub/01_Automemory/Lexos` (branch
  `feat/phase-04-reminders`, last commit `4784ac9` 2026-07-28). Two sibling dirs are decoys and
  are NOT the pilot surface: `Lexos-gsd` (last commit 2026-07-10, no `docs/design/`) and
  `Lexos-old` (not a git repo at all).
  ⚠️ **That repo has uncommitted work in flight** (`lib/db.ts`, `lib/notifier.ts`, its own
  `PROGRESS.md` — the owner's LexOS Phase-04 reminders). This phase reads its drafts and
  renders its routes; it does not edit them, and nothing here may stage, stash or commit in
  that repo.
- **Primary object — ANSWERED, not provisional.** Real LexOS lawyer, 2026-07-29: **case**, not
  client. Receipt `01KYQ9B2BXMXWWADZZYVWXEGRT`.
- **AMENDMENT (owner, 2026-07-30) — what "full loop run on the real LexOS stack" means here.**
  Variants are static HTML mockups inside arc (`docs/design/explore/lexos-case-workspace-v1/`)
  built on LexOS's real token set, real premise, real vocabulary and real-shaped content. They
  are **not** built as routes inside the LexOS app. Reason: that repo carries the owner's
  uncommitted Phase-04 work, and branching + running a dev server and a Docker Postgres in it to
  host three throwaway variants risks live work to gain fidelity the explore does not need — the
  pick is a judgment about structure, not about integration. Recorded rather than absorbed: this
  narrows the criterion, and the owner chose it knowing that. What is genuinely NOT proven by this
  run: that a chosen direction survives contact with the real data layer and the real routing.
  That belongs to whoever implements the pick, and it is not evidence this phase can claim.

- **AMENDMENT 2 (owner, 2026-07-30) — the width-departure notes are stripped before packaging.**
  variant-a and variant-b each print an on-page note declaring their `max-w-shell` departure;
  **variant-c prints none** because it stays inside 48rem. A's note sits *above the H1* — the first
  thing on its page — and juror 1's lead reason for ranking b over a was exactly that. Routed via
  `/arc-change` and classed **trivial & in-scope**: it adds no capability and creates no REQ, it is
  a packaging step already implied by "3 directions packaged blind."
  - **Why strip:** `max-w-shell` is meaningless jargon to a lawyer and internal scaffolding to a
    designer. Leaving it in makes two of three directions carry a handicap the third does not,
    which biases the very comparison the streams exist to make.
  - **What this costs, stated rather than absorbed:** the artifact external judges see is **no
    longer byte-identical to the artifact the critic passed.** The delta must be recorded exactly
    (which lines, which files, new render hashes), and variant-a and variant-b must be
    **re-critiqued after the strip** — a PASS on the pre-strip bytes is not a PASS on what gets
    sent. variant-c is unchanged and is not re-critiqued.
  - **Not proven by this run either way:** whether the notes would have changed a respondent's
    ranking. Stripping removes a suspected bias; it does not measure one.

**Still owed by the owner — due before the blind-test launch criterion, NOT before the phase
opens:**
- Whether the lawyer who answered the brief question will also **sit the Stream-B blind test**.
  Answering one question is not agreeing to be a test subject; the phase can build without it
  and cannot launch Stream B without it.
- ₹0 recruiting channel for **Stream A** (design communities/peers).

## Non-negotiables (verbatim from PLAN)

- The critic never writes product code — enforced mechanically (no Edit tool + PreToolUse edit-hook path scope + scoped receipt Bash), never by prose (ADR-0034).
- No lorem ipsum in any reviewed artifact — realistic content from the content contract.
- No absolute quality scores anywhere; numbers exist only as blind comparative ranking.
- Every design review and every owner decision leaves a spine receipt in the closed vocabulary (ADR-0035).
- Taste is a decision recorded as a design ADR, never a research finding; research receipts only for factual/pattern claims.
- A new gate/lint/parser is not done until an adversarial construct-a-breaking-input pass has run and the found holes are fixed + pinned as fixtures.
- Any edit to a product-shipped file treats sync-golden regen as a named step: diff the delta first, confirm only intended paths moved, then re-record.
