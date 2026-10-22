# Phase 04 attack bases (REQ-07), recorded before any run -- 2026-10-21T17:49Z

Each area is attacked as ONE scratch commit on top of its base: the merge's code files only (no tests, docs, initiatives, JSON or Markdown), so the input is code-only. Model: deepseek/deepseek-v4-flash-0731 (ADR-0069(g) trial), reasoning off.

| area | merge | base (merge^) | files | bytes | run |
|---|---|---|---|---|---|
| D95a | `525042e7` | `9979a266` | 3 | 78057 | D95a |
| D95b | `525042e7` | `9979a266` | 4 | 78737 | D95b |
| D96 | `ad83b34f` | `8b12b246` | 15 | 94277 | D96 |
| D99 | `4c8a0407` | `1811407a` | 16 | 88262 | D99 |
| D106 | `36663e20` | `8bd2f667` | 6 | 20485 | D106 |
| PR449 | `6012c36e` | `5f9ea6b0` | 18 | 85174 | PR449 |

D95 is 156,794 bytes code-only, over the 120 KB cap, so it is split by path into two runs: D95a (narrative-proof + validate + the public key) and D95b (narrative-anchors, owner-key, owner-sig, arc-inbox).
