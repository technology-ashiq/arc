# Handoff pack — phase 03 · lane face

13/13 slices proven.

## Prediction calibration

3 hit · 2 miss · 0 unforeseen

- **likely-failure-mode** — hit — the second half fired in every ring: face-pure pushed the v0.7 markup's constructs into the folds (the money View's nested ternary became the fold's `hatch`, the law View's length comparisons became `isAmendmentEmpty`/`isTeethEmpty`, each on the ring's own lint run); the first half fired as a stale read, not a loop -- after a stamp the room sat on "reading" and a poll in flight brought the stamped approval back (command ring attack, RoomFrame's read epoch)
- **likely-regression-site** — hit — the inbox stamp through the host: the command ring's shell attacker showed the stamped approval coming back from an in-flight poll and an as-of change hiding a stamp that had landed; fixed in the host (fixed-defects.md, command ring)
- **riskiest-file** — miss — RoomFrame.tsx carried one race class; the files with the most confirmed holes were face-facts.mjs (command ring) and the shared readers built later -- lane-room.mjs (factory and money rings) and company-room.mjs (company ring, 13 logic holes)
- **expected-blockers** — hit — the first clause fired: typecheck errors on the host's types reached CI (door.mjs untyped default, a never[] union, an unknown argument; run 35241805573); the second did not -- the lint's first real-tree red was macOS's /var realpath, not a Cycle 15 constant
- **expected-proof-failures** — miss — no face-pure finding reached CI on a ported View (each was caught locally before the push), and no console error came from a refused read; the only console errors CI saw were the Windows runner's socket-buffer class (net::ERR_NO_BUFFER_SPACE), which nobody predicted and the money ring counted on its own line

## Proofs

| slice | tier | proof | commit |
|---|---|---|---|
| 01 | unit | unit -- on CI for each ring's PR: tests/face/face-pure.mjs holds the real tree at findings=0 with the ring's modules counted; face-coverage's module half reads orphans=0; tests/face/module-frame.mjs's shipped-ring arm holds the ring's folders EQUAL to contracts/modules-v2.json's ids for it, no View importing face/src/rooms/, every declared route in DOOR_ROUTES, every boolean-named fold field a boolean -- red first with the ring listed before its modules are ported | d8386216 |
| 02 | e2e-visual | e2e-visual -- gh run view --json jobs on each ring PR's head: tests/face-browser.bats green on ubuntu Node 20 + 22, macOS and windows, each log carrying `smoke: opened=N openable=N errors=0` in dark and in light and the render line judged equal to face-coverage's module half; ubuntu Node 18 the counted skip | d8386216 |
| 03 | unit | unit -- tests/face/module-frame.mjs on CI folds every module of each shipped ring with no payloads and requires evidence/phase-03/not-served-RING.md's table (module · panel · route) to EQUAL the notServed entries the folds return, both ways; the smoke prints `smoke: not-served mood=M panels=N` per mood | d8386216 |
| 04 | verified-real | verified-real -- after each ring merges, `node .claude/scripts/core/face-dogfood.mjs` from the main clone; its summary line copied into PROGRESS.md's usage-trend line with the date, never counted toward REQ-10 | d8386216 |
| 05 | unit | unit -- tests/face/module-frame.mjs on CI: F1 the org fold's ADR band rows name a lane id from the registry and never a room name (company ring); F2 the scheduler fold's lede names only what its panels show and a field the door does not serve is a NOT SERVED panel (kernel ring); F3 the trader fold of a planned room returns isLive false and a REHEARSAL badge (money ring) | d8386216 |
| 06 | unit | unit -- face-coverage --selftest and tests/face-coverage.bats on CI read `exemptions=3` after the factory ring (factory · executor · agents, each naming ADR-1327) and `exemptions=4` after the company ring (story); the shell draws each extra as a labelled room, and the render line counts it | d8386216 |
| 07 | verified-real | verified-real -- per ring, `harness-run.mjs --shots DIR` from the branch build (1440x1000, both moods, Chrome version in the shots manifest); a fresh design-critic agent reads each candidate PNG beside its Phase 00 baseline PNG and writes evidence/phase-03/shot-review-RING.md, one line per module x mood; 0 VIOLATION and 0 BELOW-BAR before the ring's merge | d8386216 |
| 08 | e2e-visual | e2e-visual -- after the company ring: the smoke on every Node >=20.19 leg opens the 36 modules and the generic chat-mcp room in both moods with 0 errors, and all five shot reviews read 0 VIOLATION and 0 BELOW-BAR | d8386216 |
| 09 | unit | unit -- tests/face/face-facts.mjs on CI: each structural arm planted FAILs by kind (data file, link, import outside, ?raw import, JSON attribute, glob beyond code, asset URL, env value, static fetch, blob, JSON.parse of a literal, data mass, v0.7's bundle by name, unscannable), v0.7's arcFacts shape planted under face/src/lib FAILs, each heuristic arm WARNs with exit 0, and `face-facts.mjs` on the real tree prints fail=0 with files counted; red first on ERR_MODULE_NOT_FOUND | 81dcf814 |
| 10 | verified-real | verified-real -- after the kernel ring merges: PROGRESS.md records the Block B reading with the green module count (command 6 + kernel 8) read off that PR's CI run, and the cut-or-continue ruling | be832ac7 |
| 11 | e2e-visual | e2e-visual -- every ring PR's smoke line reads `excluded-errors=0` with no --exclude passed, on every configuration that builds L3; evidence/phase-00/delta-report.md's list stays MEASURED EMPTY | d8386216 |
| 12 | verified-real | verified-real -- two fresh general-purpose agents on the command ring PR (decision logic: face-facts, the read host's registry decisions; shell/OS boundary: face-facts walk, the host loop, the shots capture), each in a private scratch directory with fixed-defects.md; every confirmed hole fixed, pinned and appended to fixed-defects.md; reports in evidence/phase-03/attacker-reports.md | 81dcf814 |
| 13 | verified-real | verified-real -- /arc-phase-done 03 from the main clone after the company ring merges and main is re-verified by dispatch | d8386216 |

## Spec-fidelity

Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report
below. It reads ONLY those two files — never this pack, never the ledger — because the
session that wrote the code cannot see its own blind spots.

The pass ran in a fresh context over `phase-03-spec.md` and `git diff fd78a4f7..d8386216`. Its verdict line is
**`FIDELITY: drift found`**, and it stands as filed. Its findings, each with a disposition (FIXED with a check,
DECLARED, or DEBT), are filed at `spec-fidelity.md` beside this pack; the fixes landed in this close's PR:

- typed numbers and names in four folds (executor, trader, ventures, legal's seal list inside a NOT SERVED panel)
  -- FIXED, and four twins found by grepping the pattern across every fold and View (the command ring's board
  drew the same "1 in 4"; law, ops and ventures each carried a typed threshold); the base rate is now a NOT
  SERVED panel on `/api/ventures` in both rooms, and the command and money lists were re-derived
- the shell's two-source room list, the served exemption file and the rows' room text -- DECLARED in ADR-1337
- the Windows runner-class ceiling inside "0 console errors" -- DEBT (the existing, measured row)
- the factory extras in the company ring's PR; F2 answered by NOT SERVED panels rather than a trimmed lede; the
  allow-list row, the grown rows, the verbs and rehearsal lists, the duplicated critiques -- DECLARED
- the company ring's dogfood reading -- FIXED in PROGRESS at this close

FIDELITY: drift found
