# Phase 08 S4 -- the retro: three sealed predictions settled, every ledger trigger run

## ADR-1411's three sealed predictions (sealed at kickoff, 2026-08-23)

| # | Prediction | Evidence | Verdict |
|---|---|---|---|
| 1 | Post-Phase-03 controlled blind owner score **≥60/100** on a lexos-class brief | v3 (Phase 03 S5, 2026-10-02): best arc **66**; v4 (Phase 07 S5, 2026-10-07): best arc **60**. Both owner scores are `note.logged` receipts, taken blind before unblinding | **HIT** -- both controlled runs reach 60; v4 only just, which is the honest reading |
| 2 | rival-beats-all-arc rate **≤50%** by cycle end | One rival run (v4): owner **no** (Stitch 59 vs best arc 60, a one-point margin); jury **1 of 2** valid rankings put Stitch above every arc variant. Receipted on `note.logged` | **HIT** -- 0 of 1 by the owner, 50% by the jury, both within the bar. One run is a thin sample, and it is the only one |
| 3 | ADR-1416, session-authored: "balanced-workhorse holds; EXP-A1 returns no material owner-visible gain for high-judgment" | Phase 04 S3 (2026-10-05): thesis by thesis, balanced 59 vs high-judgment 58 on the best pair; `exp-a1` returned no promotion; ADR-1421 records it | **HIT** -- scored against the session that authored it, not the owner |

A ledger of hits calibrates nothing, so the misses that matter are said too: the plain-prompt control
beat two of three arc variants in v4 (control 51 vs command-center 49), and both jurors ranked the
control FIRST in v4 while the owner scored it fourth of five designs. Juror taste is not a proxy for the
owner's, and it disagreed with him in the same direction in v3 and v4.

## Metric pack (from receipts and committed evidence only)

- Owner blind score trend (best arc): v1 23 (Cycle 3, pre-v2) -> v3 66 -> expa1 59 -> v4 60.
- rival-beats-all-arc: owner 0/1 · jury 1/2 (v4).
- Self-review catch rate: v3 3/4 iterations caught a defect; v4 every variant's iteration 1 caught at
  least one (a: 4, b: 3, c: 4, as each composer reported them; each `self-review/manifest.md` records the
  iterations, not the counts).
- Per-source availability (Phase 05 S5 live pack): 2 of 4 active sources answered (21st.dev, nicelydone).
- Captures per explore (v4): a 3 iterations x 2 viewports, b 2 x 2, c 2 x 2, control 1, rival 1, refs 0
  (dealt as files in this deal; S4b renders them from now on).

## Assumptions ledger -- every trigger RUN

| Assumption | Trigger run | Result |
|---|---|---|
| Lapa Ninja and SaaSFrame stay fetchable | FIRED 2026-09-27 (both), routed (ADR-1412). Successor (single-gallery fair bar): the v4 pack drew from 21st.dev AND nicelydone, so the single-gallery condition no longer holds | FIRED, routed; successor NOT FIRED |
| A session-less meta refuses | `session_less_meta_is_refused` in `tests/design-render-session.bats`, green on CI 37615241075 at `3ace479c` | HELD |
| The composer's read allowlist admits its own render and the pack only | FIRED 2026-08-24 and 2026-09-17, routed (ADR-1418). Re-run live in v4: the hook refused brief.md and matrix.md to a composer (deviation 2 in `phase-07/s5-live-run.md`) | FIRED earlier, routed; HOLDS now |
| Stitch's export is self-contained | FIRED 2026-10-06, routed (ADR-1422 vendoring). v4 draft vendored 29 assets, rendered fully styled offline | FIRED, routed, resolved by vendoring |
| v0's and Stitch's terms permit an internal comparison | Stitch terms clearance `01M46ZJ3K02JXSD7HHDXNHNJF1` before the live call; v0 never entered | NOT FIRED |
| <=3 self-review iterations catch a real defect | Trigger is "three full explores with catch rate 0": v3, expa1 and v4 all caught defects | NOT FIRED |
| A model-mixed panel ranks differently | Needs a homogeneous panel on the same items to compare against; no run had one | **NOT EVALUABLE** |

## Adaptable-principle discipline (read, not linted)

All 11 rows of `docs/design/refpacks/lexos-case-workspace/sources.md` read on 2026-10-07: each states a
transferable idea and why it works ("so a reader learns...", "so the list is never lost..."); none
describes only appearance. No row fails.
