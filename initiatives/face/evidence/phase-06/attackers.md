# Phase 06 — the attacker rounds (2026-09-24 to 2026-09-25)

Every code PR ran `/arc-attack` (ADR-0226) through `arc-run`, carrying `initiatives/face/fixed-defects.md` with the
instruction to check every line in every OTHER file. Every reproduced hole is fixed and pinned, or is a debt row with
its trigger. Findings are counted from the `attack-<sha7>-r<K>-boundary.json` files in this directory; rows are the
per-hole lines in `fixed-defects.md` under the "Phase 06" sections (one row can hold a class found in several files).

| PR | what it shipped | attacks (round: findings) | fixed-defect rows | merged |
|---|---|---|---|---|
| #269 | slice 01, the session door: start / stream / attach through `arc-run --driver` | `60c13e9` r1: 15 · `8e389a5` r2: 14 | 15 + 13 | `4e759e16` |
| #270 | slice 02, the session dock: a session starts only from its click | `a320d86` r1: 14 · `d90c3b1` r2: 14 | 11 + 14 | `44e3f283` |
| #271 | slice 05, the Engine room: driver, model, health; no key | `57d014d` r1: 11 · `4010c52` r2: 12 | 8 + 9 | `26daeec2` |
| #272 | slice 03a, `council.verdict` in the closed shape (ADR-1345) | `eaa9168` r1: 12 · `1d98650` r2: 13 | 5 + 6 | `bcc0d880` |
| #273 | slice 03b, `council-convene` | `66a26f0` r1: 13 · `1be4183` r2: 14 | 8 + 6 | `5f373111` |
| #274 | slice 03c, streamed sessions and vouched receipts | `3e77530` r1: 15 (round 2 refused whole three times, ledgered) | 7 | `b4c443b8` |
| #278 | slice 04, the memory ring: lesson-log, rule-promote | `3e97a85` r1: 13 | 7 | `ab425ac6` |
| #282 | slice 04, develop-proof and adr-record | `1f95807` r1: 15 | 9 | `3b85a8c8` |
| **all** | | **13 rounds, 175 findings (12 high · 96 medium · 67 low)** | **118** | |

From #274 on, one round per PR (owner, 2026-09-25: lean). LOW leftovers are rows on `initiatives/face/debt-ledger.md`.

**Not attacked:**
- **The logic surface, on every PR.** All 13 rounds are the boundary (process / OS) attacker. The logic attacker runs on
  `--driver generic-api --trial-model $ARC_ATTACK_TRIAL_MODEL`, and the free trial model answered 429 on every attempt.
  Exit criterion 6 asks for both, so this half is unmet. It is a debt-ledger row (2026-09-26) whose pay-down is a
  logic pass over Phase 06's diff (base `5c957e44`) once the owner sets a paid model. The owner's stamp at the close
  accepts or refuses it.
- #276 (the live convene's three fixes: prose rules in a process body and a command, plus evidence), #279 and #284
  (trackers), #285 (the residue file) and the close PR (the residue fixture and this bundle). None changes the door's
  code.
