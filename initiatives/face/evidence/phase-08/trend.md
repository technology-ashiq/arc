# Usage trend since the command ring -- baseline before the two days

Verification plan row 3 asks for numbers, not adjectives. Each row below is one day, judged on its own by
`face-dogfood.mjs`'s verdict with `--day <that day>` and the op registry from `face-ops.mjs`. It was read on
2026-10-14 against the main clone's live journal (`.claude/state/face`) and spine (`.claude/state/hq`, `main` at
`4741c770`). Journal torn lines: 0. Spine torn lines: 0.

The command ring's own trend line (PROGRESS.md, 2026-09-17 to 09-18) read `6 · 55 · 1 of 5`: six decisions matched,
55 made outside the face, one day through it. This table starts there.

| day | decisions through the face | decided outside | face ops proven on the spine | per-day verdict |
|---|---|---|---|---|
| 2026-09-17 | 0 | 1 | 0 | NOT MET |
| 2026-09-19 | 6 | 0 | 0 | NOT MET |
| 2026-09-23 | 1 | 0 | 1 | MET |
| 2026-09-25 | 5 | 0 | 0 | NOT MET |
| 2026-09-26 | 1 | 0 | 1 | MET |
| 2026-09-27 | 0 | 0 | 1 | NOT MET |
| 2026-09-29 | 0 | 2 | 0 | NOT MET |
| 2026-09-30 | 3 | 2 | 0 | NOT MET |
| 2026-10-01 | 5 | 1 | 0 | NOT MET |
| 2026-10-03 | 2 | 0 | 5 | MET |
| 2026-10-05 | 11 | 1 | 0 | NOT MET |
| 2026-10-06 | 4 | 1 | 0 | NOT MET |
| 2026-10-07 | 21 | 1 | 0 | NOT MET |
| 2026-10-08 | 6 | 1 | 0 | NOT MET |
| 2026-10-09 | 6 | 0 | 0 | NOT MET |
| 2026-10-13 | 5 | 2 | 0 | NOT MET |
| 2026-10-14 (part day) | 14 | 1 | 0 | NOT MET |
| **total** | **90** | **13** | **8** | **3 of 17 days MET** |

## What the numbers say

- **Deciding has moved into the face.** Ninety decisions went through it over 17 days, against 13 outside it. At the command ring it was 6 through and 55 outside.
- **The outside decisions are a steady one or two a day, not a habit of going round the face.** On 10 of the 17 days there was at least one. Each one is named by id in that day's verdict. The two dogfood days have to bring that number to zero.
- **Ops are the weak clause.** Only 4 days applied an op from the work door at all, and 8 ops in total. 2026-10-07 had 21 face decisions and no op. A dogfood day needs at least one op, for example `today.capture-idea`.
- **Three past days already meet the per-day bar:** 09-23, 09-26 and 10-03. None of them counts toward REQ-10. All three came before the final surface (Phase 17, 10-13), and none was named in advance as a dogfood day (ADR-1329: operable over two named days).

The two dogfood days are read next to this table in the retro.
