# Phase 08 — Dogfood (arc operates through the face)

**Goal (one line):** five real days in which every decision the owner makes goes through
the face, proven by journal↔receipt match — the live-value milestone the original brief's
pull survives as.
**Appetite:** 5 days (real calendar days, ~0.5d build attention)
**Depends on:** phase-06, phase-07

## Exit criteria (Definition of Done)

- [ ] ≥5 real days: every decision through the face — L2's local request journal
      (decision ULIDs) matched 1:1 to `decision.recorded` on the canonical spine
      (byte-parity makes the spine alone blind to the door — the journal is the
      evidence, the spine is the truth; BOTH are checked, retro 2026-08-10: "he ran it"
      and "it landed" are different facts)
- [ ] runs from the **main clone** (worktrees carry no canonical spine)
- [ ] brief opened daily (request journal shows `/api/brief` daily)
- [ ] ≥1 as-of scrub used on a real question (journal shows a replay read)
- [ ] assumption row 5 adjudicated by its measurement (<1 face decision/day with open
      items → REQ-10 not met, retro asks whether the Inbox is the wrong shape)
- [ ] `/arc-retro` run; retro-log lines written; HISTORY entry
- [ ] tracker updated (PROGRESS.md row ✅ + done-log; REQ-10 → validated via
      `/arc-phase-done 08`)

## Verification plan

One coarse line, refined at phase start via `/arc-change`: journal↔receipt match script
output + daily-brief evidence + the retro artifact.

## Rabbit holes in this phase

Fixing polish mid-dogfood beyond one-liners (route through `/arc-change`) · extending the
window to chase a nicer number.

## Out of scope for this phase

New features of any kind — the week measures what exists.

## Your-setup / pending

Owner: five real working days operating arc through the face, from the main clone.

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
