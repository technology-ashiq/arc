# Phase 00 evidence — birth

- **Birth PR:** #343, squash-merged as `8d296874` on 2026-10-06. CI run 37419306766 was 19/19 green, read per job with `ci-digest.mjs` and the head SHA `56e8d37f` asserted before the merge.
- **Red history:**
  - Run 37374233727: face-l3 module-frame F3. Removing the `money/discover` planned room broke face's planned module, so the room was restored and ADR-1914 amended.
  - Run 37378702493: face-module count arm, because CLAUDE.md's hand-written command count was 25 → 26.
- **Receipts (main clone, canonical spine, `events/2026-10-06.jsonl`):**
  - `kickoff.done` `01M47ZCQMHWB54E808DEZXGJH6`
  - ruling `approval.requested` `01M47ZCQW6XF5ZEWF4QGS1XFRH` (gate `lane-birth`, ADR-1900). **Awaiting the owner's stamp.**
  - `_quarantine/` was listed at emit time: 13 files from other lanes and earlier dates, with 0 containing `discover@`.
- **Audit memo:** `market-agent-audit.md`, NOT LOCATABLE (A-01).
- **Attack:** two rounds on the birth diff, `attack-8bb1a72-*` and `attack-5e1d529-*`. Every high/medium was fixed or rejected with the fixed taxonomy. Lows are in `../../debt-ledger.md`.
- **Close blocked on:** the owner's `arc-inbox approve 01M47ZCQW6XF5ZEWF4QGS1XFRH`, which is the exit criterion "the owner's decision.recorded found by id".
