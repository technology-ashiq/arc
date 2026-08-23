# Phase 09 — Nothing missing (the completeness sweep)

**Goal (one line):** close the nine surfaces of arc that a fresh audit found invisible to the
face, and change `face-coverage` so it derives its expected set from the WORLD rather than from
its own list — because a gate that compares a list against itself reports "all covered" forever.
**Appetite:** 3 days
**Depends on:** phase-05 (the coverage gate), phase-06 (the rooms). Decision: **ADR-1317**.

## Why this phase exists at all

The owner's one non-negotiable for this cycle: *"arc oru full product ah maranum … ethume miss
aga kodathu"* — nothing in arc may be missing from the face. Phase 05 built a gate that says

```
face-coverage: 46 kinds, 16 lanes, 26 commands, 30 agents, 16 products, 7 rules,
6 processes, 164 homed contract rows -- all covered
```

That is a true sentence about the contract and **not** the claim the owner asked for. A fresh
agent, asked what exists in the repo but in no inventory the gate reads, measured nine answers.
ADR-1317 records them with the measurement behind each.

## Exit criteria (Definition of Done)

- [ ] **Seven new inventories in the contract**, each derived from its on-disk source, not
      hand-listed: `adrs` (by century band) · `gates` (`arc.gates.yaml`) · `jobs`
      (`hq.jobs.yaml`) · `ventures` (`ventures.yaml`) · `plans` (`docs/strategy/plans/`) ·
      `capabilities` (skills + `.mcp.json` + pinned images) · `planned-rooms`
      (`planned-rooms.json`)
- [ ] **`face-coverage` reads the world.** For every new inventory the gate walks the SOURCE
      and fails on anything unhomed — so a thing added to arc without a room is a named
      failure, not a silent pass. One exit arm per new class.
- [ ] **The mutant control holds:** a mutant that narrows the new checks to one class, or that
      returns the contract's own keys instead of walking the source, must FAIL the selftest.
      (Phase 05's lesson: a mutant narrowing `if (findings.length)` to `[lane]` passed all 17
      arms before the arms were split per class.)
- [ ] **`chat-mcp` exists** in `rooms.generated.json`, `room-copy.json` and the Map — a room
      declared in `planned-rooms.json` and ADR-1306 and generated nowhere is the registry being
      wrong, not the declaration.
- [ ] **The four empty stations carry rows:** `board`'s ADR map · `scheduler`'s jobs table ·
      `ventures`' passports · `strategy`'s plans queue. A station that names a thing and renders
      nothing is worse than no station.
- [ ] **`/api/lane/:name` carries `phases`** — the 107 phase specs are in the directory the
      handler already reads.
- [ ] **A CI room with the honest-state vocabulary** — `not instrumented` until a real run feed
      exists. `MISSING` is not `0`; "never wired" is not "measured green".
- [ ] **The exclusion note names its file.** `lints` keeps its exemption with the reason
      restated; `gates` loses it because the reason was measured false. Every remaining
      exclusion must name the file that makes it true, so the next one cannot be inherited by a
      row it was never written about.
- [ ] Two fresh attackers with different surfaces (one on the derivation logic, one on the
      shell/OS boundary), carrying this lane's running defect list, per CLAUDE.md.
- [ ] CI green per JOB at the head SHA; tracker updated.

## Verification plan

1. `face-coverage --selftest` — one exit arm per new gap class, plus the two mutants above.
2. A **positive control per inventory**: add a fake row to the source (a gate, a job, a
   venture, an ADR band) and assert the gate goes red naming it. An inventory that cannot be
   made to fail is not being read.
3. `face-sections --check` clean after regeneration; the registry's own duplicate-id, room-name
   and bare-wildcard guards still hold.
4. `dash-doors` covers `/api/lane/:name` returning phases, with a lane that HAS phases and one
   that does not — an empty array and a missing key are different answers.
5. Look at the rooms in a browser. Four stations that were empty must show rows; a screenshot
   is not a substitute for opening it (Cycle 3: five critique rounds on pixels nobody opened).

## Rabbit holes in this phase

- **Do not add 265 ADR rows.** They drown the contract and tell the owner nothing. Bands, one
  row each, naming the lane — the bands already exist in `PORTFOLIO.md` because that is how a
  person actually navigates them.
- **Do not invent a CI feed.** The honest state is `not instrumented`. A fabricated green is
  the one failure the whole face is built to prevent.
- **Do not touch the reserved-hue contract** (ADR-1313) or add a sixth meaning-bearing hue.
- **Do not re-home `.claude/**`.** It is already 100% product-owned — 327 tracked files, 0
  unmapped — and every script reaches a room transitively through its product.

## Out of scope

Phase 08's five calendar days; the Phase 07 model half (blocked on the engine lane's empty
tool-allowlist seam); anything requiring `.github/**` edits, which this session cannot author.
