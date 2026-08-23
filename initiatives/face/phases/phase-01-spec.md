# Phase 01 — Explore ×3 + design system (the design lane decides the look)

**Goal (one line):** three genuinely different theses of the 8 signature screens, judged
blind against a reference, owner pick + falsifiable PREDICTION — then the winner's tokens
canonicalised as the design system.
**Appetite:** 5 days (3d explore + 2d design system; day 3 tripwire checks BOTH the
≥3/7 IA / ≥3/4 art-axis divergence AND that all 24 variant builds — 3 theses × 8
signature screens, lint-passing and rendered — are done; incomplete theses are cut to
their finished screens before the 2 design-system days start)
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] `design-director` assigns three theses (default: command center / canvas map-first /
      review workspace inbox-first) + 4-axis art direction; `matrix.md` filled at
      assignment; divergence call ≥3/7 IA dimensions and ≥3/4 art axes (≤1 reassignment
      round — else assumption row 4 fires)
- [ ] `ui-composer` ×3 build isolated variants (own dir, own `tokens.css`, same base SHA)
      of the 8 signature screens; each passes `design-lint` (exit 0)
- [ ] deterministic renders via `design-render.sh` — same input → same hash, recorded
- [ ] `design-jury` ×3 rank blind with the reference (Linear) as the unlabelled 4th item;
      3 ranking artifacts + the reference's position recorded
- [ ] owner PICK + falsifiable PREDICTION recorded as `decision.recorded` (emitted from
      the main clone), made only after the owner has opened the three rendered variants
      himself — not the jury's textual rankings alone (design Cycle 3, 2026-07-30: five
      critique rounds, three blind rankings and a sealed prediction were built from
      agent reports about pixels nobody had opened; the owner opened them once and
      scored 23/100) — ≤2 critique rounds total (ADR-1308)
- [ ] winner's tokens → canonical `tokens.css`; core components specified: stamp, chip,
      seal, receipt drawer, station/line, KPI tile with *Why?*, tape ruler, room shell,
      honesty watermarks (ADR-1313 classes); design-lint canonical-tokens check green
- [ ] Claude Design sync only AFTER the DES-G "W3+" `/arc-change` ruling AND the owner's
      explicit publish OK per CLAUDE.md's publishing rule (an ADR ruling authorizes the
      sync mechanism, not the act of sending product screens to a third-party hosted
      service — the ADR-0040 gap nearly put LexOS mockups on a public subreddit) —
      repo → Claude Design, never the reverse (skip cleanly if the ruling is not sought
      this cycle)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `node .claude/scripts/design/design-lint.mjs docs/design/briefs/face-hq/brief.md`
  plus per-variant `design-lint` route scans and the `design-render.sh` hash comparison
- **Expected failure first:** before variants exist, the per-variant design-lint / render
  invocations fail with missing-path errors (red); the matrix divergence check fails while
  `matrix.md` is unfilled. Run once before composing — a divergence call that never
  failed is the same-app-different-styling smell.
- **Live demo scenario:** open the three variant dirs side by side; confirm three
  different products, not three themes; open the jury artifacts and find the reference's
  rank position stated in each.
- **Real-system check:** the owner's pick lands as `decision.recorded` on the canonical
  spine (verify by ULID from the main clone — a worktree emit leaves no trace, retro
  2026-08-10 lesson).
- **Expected evidence:** `matrix.md` · 3 variant dirs + lint transcripts · render hashes ·
  3 ranking artifacts · the decision ULID · canonical `tokens.css`.

## Rabbit holes in this phase

A design-token theming engine · chart perfectionism · variants of more than 8 screens ·
critique rounds beyond 2.

## Out of scope for this phase

Any L2/L3 code (Phases 03/04) · Map implementation (Phase 05) · bespoke room panels
(Phase 06).

## Your-setup / pending

Owner: the blind pick + prediction (a human gate mid-phase) · optionally the DES-G ruling
via `/arc-change` in the design lane if Claude Design is used this cycle.

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
