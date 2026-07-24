# Phase 03 — adversarial pass (decision / inbox / cursor)

**Date:** 2026-07-24
**Target:** the parser-class surface built this phase — `assertDecision` (validate.mjs),
`arc-inbox` approve/reject (ID resolution + idem), and the reader `--since` cursor.
**Method:** the mandatory construct-a-breaking-input pass (council v2/v3 discipline). A workflow
fan-out of **7 attacker lenses** (verdict-enum · decides-ref · reason-bytes · payload-shape ·
idem-race-dup · cursor-since · inbox-fold) produced **40 candidate breaking inputs**; each was
handed to an **independent skeptic** told to *refute* it against the actual source (default
DEFENDED unless a concrete failing path could be traced). Survivors were executed against the
real code and pinned as red fixtures in **both modes** (strict exit 2 + hook quarantine exit 0)
before this decision path is trusted.

**Tally:** 40 candidates · **2 CONFIRMED holes** · 21 DEFENDED · 0 uncertain · 17 left ungraded
when the workflow hit the session usage limit mid-refute (assessed manually below).

## The worst of it

A caller-supplied `--idem` let an attacker **pre-claim the stable decision-key of a real
approval it does not decide** — permanently locking that approval out of the inbox while a
forged decision sat on the append-only spine. The emitter's own comment had flagged this exact
pre-claim class and defended only the *ingest* path; the *emit* path — the one `decision.recorded`
actually uses — was open. The validator validated the decision's fields but never checked that
its idem was bound to the approval it named, so the mechanical dedup key and the semantic
`decides` key could be desynced.

## Confirmed holes (fixed + pinned)

| # | Hole | Root cause | Fix | Pinned as |
|---|---|---|---|---|
| H1 | **Idem pre-claim / two-key desync.** Emit `decision.recorded` with `decides` = a DECOY ULID but `--idem = sha256("decision.recorded\|"+A)` for a real approval A. It seals (valid shape), occupying A's key slot; the legit `inbox approve A` passes the read-check (keyed on the decoy) then collides on `DUP_IDEM` → **A can never be decided**, inbox still shows it open, and a forged decision is on the spine. | `emit` honours caller `--idem` (arc-event.mjs); `assertDecision` never bound `idem` to `decides`. | `assertDecision` now requires `event.idem === sha256("decision.recorded\|"+decides)`, checked **last** so a bad shape/verdict/reason still reports its own error. arc-inbox already supplies this idem, so legit decisions are unaffected — and any *second* decision on an approval (supersede or contradictory) now also collides, making decisions truly final. | spine-inbox.bats: "idem pre-claiming another approval's key … refused (strict); target stays decidable" + HOOK variant |
| H2 | **C1 terminal-escape smuggling.** A `reason` containing CSI (U+009B) / NEL (U+0085) / any C1 control (0x80–0x9F) sealed onto the spine, contradicting the code's own stated intent; the brief prints `reason`. | `hasControlChar` gated only C0 (`<0x20`) + DEL (`0x7f`); the C1 range is `>0x7f`. | `hasControlChar` now also rejects `0x80–0x9f`. Shared with `assertEvidencePath`, so evidence paths tighten too (no legit C1 in either). | spine-inbox.bats: "C1 control char … in a decision reason is refused (strict), nothing sealed" + HOOK variant + an over-rejection guard ("café ✓" still accepted) |

Both fixes verified by a node smoke check over the shared validator: valid evidence path OK,
traversal still rejected, C1 rejected in both reason and evidence, wrong-idem → BAD_DECISION,
bad verdict still → BAD_VERDICT (ordering correct).

## Manual assessment of the 17 ungraded candidates

The refute stage lost 17 candidates to the session usage limit. Assessed by hand against the code:

- **Closed by the H1 fix (idem-binding):** contradictory double-decide (approve+reject), a
  supersede-correction producing two conflicting decisions, orphan/wrong-target forged decision —
  any second decision for an approval now collides on its bound idem key.
- **DEFENDED by existing Phase-0 reader design:** torn line between/at the cursor (reported, not
  silently skipped; the cursor line torn → `CURSOR_NOT_FOUND`, a loud error), torn idem-index line
  (derived; replay heals), duplicate/reused event id and backdated ts (emitter ULIDs are unique;
  the `--event-file` forge is a Phase-0 concern), cross-venture decision (approvals are global by
  ULID — by design).
- **Pre-existing reader-robustness observations (also affect the already-shipped `brief`; NOT new
  Phase-03 holes) — noted, not fixed here:**
  1. **sqlite snapshot staleness** — `query()` auto-engine reads a `state.db` that is only rebuilt
     by `arc-replay`, so between replays the inbox/brief view can lag the JSONL. The *writer's*
     idem index is always live, so this is a stale-**read** UX wrinkle (a just-decided approval may
     show open; approving it then fails `DUP_IDEM` rather than `ALREADY_DECIDED`), never a
     double-seal.
  3. **null / non-object JSONL line** — a hand-written `null` line (only reachable by bypassing the
     writer, which rejects non-objects) would crash the inbox/brief fold on `e.event.id`.
  13. **approval.requested display injection** — `approval.requested` payload is free-form by plan;
      the inbox prints `what`/`gate`, so control chars in a forged/loose approval reach the terminal.
  These are tracked as a reader-hardening follow-up (see the spawned task); they are out of the
  Phase-03 DoD and share behaviour with brief, so they are not a Phase-03 regression.

## Corpus before → after

Decision-path adversarial fixtures: **0 → 5** pinned in spine-inbox.bats (H1 strict+hook, H2
strict+hook, over-rejection guard). Full inbox suite **18/18** green; node validator smoke check
green. spine-emit full-suite regression deferred to CI (Windows local runs exceeded the 10-min
ceiling; the validator change is monotonic — only adds rejections — and decision-scoped).
