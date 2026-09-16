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

- [x] **Seven new inventories in the contract**, each derived from its on-disk source, not
      hand-listed: `adrs` (by century band) · `gates` (`arc.gates.yaml`) · `jobs`
      (`hq.jobs.yaml`) · `ventures` (`ventures.yaml`) · `plans` (`docs/strategy/plans/`) ·
      `capabilities` (skills + `.mcp.json` + pinned images) · `planned-rooms`
      (`planned-rooms.json`)
- [x] **`face-coverage` reads the world.** For every new inventory the gate walks the SOURCE
      and fails on anything unhomed — so a thing added to arc without a room is a named
      failure, not a silent pass. One exit arm per new class.
- [x] **The mutant control holds:** a mutant that narrows the new checks to one class, or that
      returns the contract's own keys instead of walking the source, must FAIL the selftest.
      (Phase 05's lesson: a mutant narrowing `if (findings.length)` to `[lane]` passed all 17
      arms before the arms were split per class.)
- [x] **`chat-mcp` exists** in `rooms.generated.json`, `room-copy.json` and the Map — a room
      declared in `planned-rooms.json` and ADR-1306 and generated nowhere is the registry being
      wrong, not the declaration.
- [x] **The four empty stations carry rows:** `board`'s ADR map · `scheduler`'s jobs table ·
      `ventures`' passports · `strategy`'s plans queue. A station that names a thing and renders
      nothing is worse than no station.
- [x] **`/api/lane/:name` carries `phases`** — the 107 phase specs are in the directory the
      handler already reads.
- [x] **A CI room with the honest-state vocabulary** — `not instrumented` until a real run feed
      exists. `MISSING` is not `0`; "never wired" is not "measured green".
- [x] **The exclusion note names its file.** `lints` keeps its exemption with the reason
      restated; `gates` loses it because the reason was measured false. Every remaining
      exclusion must name the file that makes it true, so the next one cannot be inherited by a
      row it was never written about.
- [x] Two fresh attackers with different surfaces (one on the derivation logic, one on the
      shell/OS boundary), carrying this lane's running defect list, per CLAUDE.md.
- [x] CI green per JOB at the head SHA; tracker updated.

> **Closed 2026-09-16 by `/arc-phase-done 09 --lane face`.** Evidence:
> `evidence/phase-09/` (`live-demo.md` · `room-sweep-by-eye.md` · `test-output.log` · manifest).
> Two items closed in a different shape from how they are written above, recorded here rather
> than ticked silently:
> - *"A CI room"*: the honest `not instrumented` state is there, but it is homed inside
>   **Review & Ship**, not in a separate room. That is where `face-coverage` homes the 4
>   workflows.
> - *"`lints` keeps its exemption"*: ADR-1317 §3a overtook this on the same day. `hooks` and
>   `lints` are both DERIVED (`treeHooks` · `treeLints`), and the exemption list is empty.
>   `contracts/room-map.md` and a comment in `face-coverage.mjs` still carried the false
>   exemption sentences until this close corrected them.
>
> The by-eye sweep found three defects that fail no criterion above (F1 ADR map shows room
> names where it promises lanes · F2 scheduler lede promises next-fire/last-outcome it does not
> show · F3 planned `trader` wears a LIVE pill). All three move to face v2, which rebuilds those
> rooms as modules.

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

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 lives in-repo at `face/` with its own `package.json` and Vite build, and nothing in `.claude/scripts/**` gains a dependency (ADR-1316 supersedes ADR-1300 on placement, ADR-1309).
