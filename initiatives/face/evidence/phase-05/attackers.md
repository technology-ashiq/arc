# Phase 05 — the attacker rounds (2026-09-19 to 2026-09-23)

Every PR had fresh pairs of agents: one on the door's decision logic, one on the shell / git / OS boundary. Each carried
`initiatives/face/fixed-defects.md` with the instruction to check every line in every OTHER file. Every reproduced hole
is fixed and pinned, or is a debt row with its trigger. The per-hole lines are in `fixed-defects.md` under "face v2
Phase 05" and the PR sections after it; the counts below are those rows (one row can hold a class found in several
files).

| PR | what it shipped | rounds | fixed-defect rows | merged |
|---|---|---|---|---|
| 1 (#252) | the door machinery and the flagship six | 1 + a round-2 re-attack in PR 2 | 14 + 13 | `56ba17b0` |
| 2 (#253) | live rooms, the browser flows | 1 | 14 | `600a94d1` |
| 3a (#254) | the kernel ring's first seven verbs, the proposal-branch writer | 2 | 17 + 13 | `b4c38038` |
| 3b (#255) | bench propose, absorb pin and trial | 6 (rounds 3-6 narrow pairs on each diff) | 17 + 10 + 6 + 5 + 4 + 7 | `d8e25f8e` |
| 4 (#257) | the factory ring, eight verbs | 3 | 8 + 5 + 6 | `536d3b2b` |
| 5a (#258) | the money ring | 2 (the owner's two-round cap from here) | 5 + 6 | `106e6219` |
| 5b (#259) | the company ring | 2 | 6 + 6 | `6c34f7ee` |
| 5c (#261) | the live lanes: the leads send and the legal gate | 2 | 7 + 6 | `aa797081` |
| **all** | | **20** | **175** | |

The two most consequential, both in PR 5c's round 2: legal `publish` accepted a caller's decision FILE (a forged
approve published; the real inbox receipt never could), and the leads send digest did not bind who the mail goes to.
Both are fixed with fixtures, and ADR-1344 records the contract change (publish reads its decision from the spine).

**Not attacked:** the round-2 fixes of PRs 5a, 5b and 5c, under the owner's two-round cap (2026-09-19); their LOW
leftovers are rows on `initiatives/face/debt-ledger.md`. PRs 262 and 263 (tracker, and the close's two fixtures) change
no product code and were not attacked.
