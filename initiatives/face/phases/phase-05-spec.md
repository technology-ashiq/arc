# Phase 05 — Map + room template + birth-rule + coverage

**Goal (one line):** the transit map draws itself from manifest `face:` sections, every
room renders generically from the same template, and `face-coverage` makes "onnu vidama" a
CI verdict.
**Appetite:** 5 days (phase tripwire at day 3: all 16 manifests' `face:` sections written
+ generic renderer green, else the Map and the `face-coverage` mutant control move to
Phase 06 and this phase closes on manifests-only; block C tripwire at day 6.5 of 13:
template + 12 rooms live, else bespoke panels cut to Council/Money/Leads/Growth)
**Depends on:** phase-04

## Exit criteria (Definition of Done)

- [ ] `face:` sections written for all 16 product manifests (room, ring, kinds, actors,
      sanctioned, stations, decisions, numbers, concepts — ADR-1306); `product-lint`
      `KNOWN_FIELDS` extended in the same change (assumption row 3)
- [ ] planned-rooms registry for the unborn lanes (ops · trader · discover · chat-mcp),
      sourced from their PLAN files — dotted rendering, no invented manifests
- [ ] generic room renderer: zones 1–6 from the `face:` section; unknown kinds render
      generically (kind-driven)
- [ ] Map (REQ-04, ADR-1304): all v1 lines/stations from the declarations; shared
      stations joined by kind; in-flight dots move on receipt; open-gate amber squares;
      dashed = unexercised with the honest label; dotted = planned; station → chip/room;
      blind-jury legibility check at 20+ lines (assumption row 4 fallback: zoom-to-ring)
- [ ] `face-coverage` lint (REQ-01, ADR-1311): 0 misses on the real tree; **mutant tree
      (a new lane + a new kind) FAILs naming both** — the negative control; wired into CI
      through a bats suite (`.github/` is deny-listed — the gate bites through tests)
- [ ] tests green on CI per job; tracker updated

## Verification plan

One coarse line, refined at phase start via `/arc-change`: `face-coverage` 0 misses +
mutant FAIL on CI; jury legibility artifact for the Map; product-lint green over all 16
manifests.

## Rabbit holes in this phase

Turning the Map into a game · hand-drawn lines in the app (forbidden by ADR-1304) ·
bespoke panels (Phase 06).

## Out of scope for this phase

Bespoke room panels (Phase 06) · Ask arc (Phase 07).

## Your-setup / pending

None.

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
