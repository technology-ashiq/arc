# Phase 02 — owner demo (review → QA → Prepare ship)

Canonical spine: the main clone, `.claude/state/hq/events/` (not `_quarantine/`).

| Step | Receipt | Notes |
|---|---|---|
| QA, run 1 | none | Owner pasted the URL twice; the writer refused it and the session ended model-invalid (run `01M5HM510M4H2F0BQWNSRTF50G`, $0.54). |
| QA, run 2 | `qa.completed` `01M5JHT8Z2VNTEK93AT33AVMWK` | Owner's click on the real driver; 1 bug found. |
| Prepare ship, run 1 | none | Session `0mvlbt9sdhWdm1fK` (run `01M5N1Q9169KTZWHV3FM00ETZE`, $0.69) failed: a bare `kickoff-lint` exits 3 with several lanes live, and the SessionEnd hook dirtied `docs/session-log.md`, which the gate's clean-tree check reads. Both fixed in #460 (`b3eb7ac3`). |
| Prepare ship, run 2 | `approval.requested{gate: deploy}` `01M5PGRM17XC2PNWMV2S9XSDYW` | Written by the session with the gate writer (`review-ship-record.mjs ship --sha b3eb7ac35c7f… --as-process ship-run@…`, after a `--dry-run`) from a clean `feat/face-c17-p02-ship3` at `b3eb7ac3`, on the owner's instruction to finish without another click. **Not a face click** — stated, not hidden. The owner then saw it in the face's inbox (2026-10-24: "theriyuthu") and accepted the close on it. Nothing deployed. |

CI read per job: #453 merged `ba702637` green; #460 run `40013374903` 19/19 on `6de04a45`; main
dispatch `40023076511` 19/19 on `b3eb7ac3` (macOS shard 1 flaked once, rerun green) — the green the
gate read.

Attack on #460: boundary round 1 (`attack-2afd64c-r1-boundary.json`: B1, B2 medium fixed; B4 low
fixed; B3 low to debt). Logic did NOT run: the OpenRouter key returned 401. Owner ruled "merge pannu".
