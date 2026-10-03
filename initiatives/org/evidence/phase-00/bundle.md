# org Phase 00: evidence bundle (the catalog and its gate)

**Built on** `feat/arc-org-cycle18` (PR #302). The PR is merged once at the end (owner ruling 2026-09-30).

## Receipts (main clone)

- Owner ruling of 2026-09-29: request `01M3QG94BA03NM6692VRMXNN51`, approved by `01M3QSAJ8R7P6NQW2JJB776330` on 2026-09-30.
- Genesis over catalog digest `4b459d8e…` (71 cards, 37 legitimised by genesis): request `01M3QSK9P0DZJXKR2XSC4PMKHB`, awaiting the owner's decision.

## REQ-01 / REQ-03 / REQ-04 / REQ-13

- `coverage.txt`: `org-coverage` reports 71 roles (37 staffed), 30 agents, all covered. Every expected set comes from the tree through face-coverage walkers, including the new additive `treeScripts` export (ADR-1620).
- `selftest.txt`: `--mutant-selftest` ran 14 of 14 arms and all passed. 13 arms run the real CLI in a child process and record its exit status. M10 stubs a walker, which only the in-process seam can do, and it says so in its own line.
- `org/CHART.md` and `org/chart.json` are generated. The counts are 37 staffed, 3 partial, 7 human and 24 vacant, with 71 own and 0 hired. Each vacant role carries a `VACANT` banner, and `--check` fails on a hand edit.
- Blueprint §4 now points at the generated chart.

## Deviations from the design source, found while building

- **Card count by seat.** The `researcher` agent had no row in the chart (an A-02 event), so it is placed on `competitive-intel`, which is therefore not vacant. The social seat is `human`, because it carries an E2 string (the ADR-1622 erratum). Result: 24 vacant and 7 human, against the chart's 25 and 6.
- **Face.** `products/org` maps to no face room. The `org` room is an INDEX room, and mapping a product to it broke face-l3 on CI. The no-go "no face ring this cycle" holds.
- **Shared parser defect.** The engine lane's YAML subset reads a quoted list item that contains `: ` as a mapping. org works around it: the emitter refuses such an item and asserts its own round trip. This is debt row 1, reported to the engine lane.

## Adversarial passes

The boundary surface was attacked 3 times (`attack-*-boundary.json`): 26 findings, 25 fixed and pinned in `../../fixed-defects.md`, 1 LOW in the debt ledger. The third pass went over the two-round cap because `arc-attack` re-ran boundary on a new SHA. That is recorded here and was not repeated. **The logic surface has produced no result** (debt row 3). The next run sets `ARC_LLM_TIMEOUT_MS=420000` and covers this code.

## CI

Run 36643308697 at `c7eddd6` showed 3 distinct reds, all fixed in `535849d2`: the example card's file stem, the missing `org` entry in the products CATALOG, and the face index room. The green run is recorded at the final close.
