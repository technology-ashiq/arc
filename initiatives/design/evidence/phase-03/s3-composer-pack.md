# Phase 03 S3 -- the composer reads the real pack (2026-09-27)

Exit criterion: the Phase 01 read allowlist, granted against an empty directory, is re-verified now
that Phase 02 filled the pack, and the sibling negative control is re-run on real files.

**It failed first.** The grant was `.claude/state/design/refpacks/<explore-id>/`; the curator writes
`refpacks/<brief-id>/`. On the real explore `lexos-case-workspace-v2` (brief
`lexos-case-workspace`) the pre-fix `composer-scope-check.sh`, armed for `variant-a`, answered
**exit 2 (refused)** for the real pack screen `nicelydone-157f41885229fcdf.jpg`. The composer could
never have read the pack.

After the fix (the pack is keyed by the brief id `explore.txt` records; no record grants no pack),
armed the same way, on the same real files:

| target | exit |
|---|---|
| `.claude/state/design/refpacks/lexos-case-workspace/nicelydone-157f41885229fcdf.jpg` (real pack screen) | 0 |
| `docs/design/refpacks/lexos-case-workspace/sources.md` (its principles) | 0 |
| `docs/design/explore/lexos-case-workspace-v2/variant-b/index.html` (sibling, negative control) | 2 |
| `.claude/state/design/refpacks/lexos-case-workspace-v2/x.png` (the old explore-id grant) | 2 |
| `docs/design/explore/lexos-case-workspace-v2/variant-a/index.html` (own variant, control) | 0 |

Released with `--end`; no composer marker left armed. Pinned in `tests/design-composer-eyes.bats`.
