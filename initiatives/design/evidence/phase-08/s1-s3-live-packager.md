# Phase 08 S1-S3 -- live packager run on real renders (lexos-case-workspace-v4)

Text only. The package was built locally to prove the gate on real renders and then deleted: LexOS
renders are never committed (owner ruling 2026-09-16), and nothing here was sent anywhere.

## Run (2026-10-07, main at `0f4c0d00`)

S5's renders predate S1, so their receipts carry no `provenance`. The first build at 1440x900 was
**refused PROVENANCE-ABSENT for both arc variants**: re-rendering the same pixels with the new
renderer adds an `arc` receipt, but the older provenance-less receipt for the same bytes still
exists, and absent is never read as arc. That is the rule working on real data, recorded as a
finding: a render made before S1 cannot ride out until its pixels are rendered again under a
receipt that says what it is. The demo below renders at a viewport no earlier receipt covers.

```
$ design-package.mjs build --explore lexos-case-workspace-v4 --render variant-b --render variant-c --viewport 1280x800
design-package: clean -- every image is an arc render in docs/design/blind-test/lexos-case-workspace-v4/package
design-package: built 2 direction(s) -- the mapping is package-manifest.json beside the package, never inside it
exit=0
docs/design/blind-test/lexos-case-workspace-v4:
package
package-manifest.json

docs/design/blind-test/lexos-case-workspace-v4/package:
direction-1.png
direction-2.png

# planted: the Stitch render (1280x800, provenance rival:stitch), a pack screen, variant-a 1440 iter-3 (rendered before S1, no provenance)
$ design-package.mjs lint --dir docs/design/blind-test/lexos-case-workspace-v4/package
design-package: REFUSED NON-ARC direction-3.png -- the render receipt says rival:stitch
design-package: REFUSED GALLERY direction-4.png -- these bytes are a reference-pack image -- a third party's screenshot never leaves the repo
design-package: REFUSED PROVENANCE-ABSENT direction-5.png -- a render receipt for these bytes carries no provenance -- absent is never read as arc
design-package: 3 refusal(s) in docs/design/blind-test/lexos-case-workspace-v4/package
exit=1
```

- The clean build carries two arc renders, `direction-1.png` and `direction-2.png`. The mapping is
  `package-manifest.json` BESIDE the package, written only after the lint passed.
- The three planted refusals, each by name, on real files: the Stitch rival render (`NON-ARC`,
  `rival:stitch`), a nicelydone pack screen (`GALLERY`), and an arc render from before S1
  (`PROVENANCE-ABSENT`).
- The committed `lexos-case-workspace-v1` package, linted the same day, FAILS CLOSED: its README is
  `NOT-ALLOWED`, and its three directions are `UNATTRIBUTED` (no render receipt carries those
  bytes). It is not resent until it is rebuilt.
- Spend: the real registry against the real `hq.policy.yaml` is clean (`design-sources-lint: ok -- 15
  source(s), 5 active`); the paid `mobbin` row stays off at the rupees-zero cap.
- Manual drop: proved by the suite (`tests/design-package.bats`, drop cases), not by an owner file in
  this run -- the owner dropped no screen on 2026-10-07.

## CI

`arc-ci` **37615241075** at `3ace479c` (PR #376 head), **19/19**, read per JOB; one Windows shard
(1/12) failed first on the known stdio-liveness flake and passed on rerun. Merged as `0f4c0d00`.
