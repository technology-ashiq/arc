# Phase 03 evidence: inbox gate, exporter, money seed, and the real hunt (REQ-07)

- **Code:** merged in #350 (`e959e0b1`) and green on CI: `discover-export.bats`, plus the propose/reject arms in `discover-council.bats`/`discover-score.bats`.
- **Preconditions (REQ-07):** the owner gave a written OK in chat on 2026-10-07 for the council run on the `claude-code` driver, which uses the subscription with no cash spend (amount ₹0). The niche is **`invoice reminders`**. This was a full council, not the one-juror fallback.
- **Real hunt, run from the MAIN clone after the code merge:** `.claude/state/discover/real-hunt-2026-10-07/`.
  - `hunt --emit` read 3 public HN queries and found 45 records in 33 clusters. `clusters.json` sha256 is `6d40daaa…63e2`, equal to the 2026-10-06 mini-hunt on the same live data. The `run.completed` receipt is `01M49AQ8BNMMEAFKY9RPBWH32A`. It emitted **0 `idea.captured`**, because every item had already been captured the day before. That is REQ-02's cross-run dedup working on production data.
  - `score` produced 33 rows, with sha256 `a706d952…a9fa`. The winner is `6e390ca3cf49` at 51.
  - `judge --run`: two `council.verdict`, both hold/Medium (see `../phase-02/README.md`).
  - `propose --emit`: `approval.requested` `01M49CAT5785D1GZBMPT1VQT31` for `invoice-reminders-6e390c`.
- **Wall clock, from hunt start to shortlist in the inbox:** **1694 s (28.2 min)**, under the 60-minute target. It started at 2026-10-06T19:23:16Z and the inbox was reached at 19:51:30Z. The council took 1688 s of that.
- **Human gate (REQ-05):** the owner chose "approve as rehearsal" in chat, and the stamp was applied with `arc-inbox approve`, producing `decision.recorded` `01M49CEWSXE7Q1GFZS24HMZY5S`. The owner's approval latency is recorded separately: it is the time from the inbox at 19:51:30Z to the chat answer, and it is excluded from the 28.2 minutes.
- **Export (REQ-06):** `export --in …` wrote `products/launch/ventures/invoice-reminders-6e390c.venture.yaml` and `.hunt.md`, which are committed in this PR.
  - The yaml was accepted by launch's own `loadProfile` (61 of 85 slots apply).
  - The slug is the niche plus a 6-hex `cluster_fp` suffix.
  - It carries `brand.domain: unassigned` and `honesty_class: rehearsal`.
  - The `.hunt.md` links all 3 HN evidence urls, the request id and the decision id.
- **Money seed (REQ-09):** `money_signal.estimate_minor: ABSENT`, written as a commented seed. None of the 3 HN posts states a price, so the honest value is ABSENT and not a guessed integer. The scorer's `money_signal` *term* (75) still cites its 3 evidence ids. discover emitted **0 `revenue.*`** events, checked by grepping `events/2026-10-07.jsonl`.
- **Quarantine:** `_quarantine/` holds 0 files containing `discover@`. The two records refused with `BAD_PROCESS` (bare `discover`) belong to the Phase 00 close emit, not to this hunt.
- **Files here:** `real-clusters.json`, `scores.json`, `judge.json` (verdicts joined), `proposal.json`.
