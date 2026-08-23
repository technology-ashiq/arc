# Room map — the owner's reference against the frozen coverage contract

**Decided 2026-08-23 by the session, under the owner's explicit delegation:** *"design
mattum than enodathu, mathapadi arc ah pathi unaku than nalla theriyum, so arc decision
neeye pannu … design la antha face mattum than enaku important, bakki iruka pages lam arc
ku ethu venumo atha ne un istathuku change panniko … arc oru full product ah maranum,
entha products, features, flow, pipelines nu arc la iruka entha concepts nu ethume miss
aga kodathu."*

Two instructions, and they pull in different directions on purpose:

1. **The face is his. Everything else is mine to shape to arc.**
2. **Nothing in arc may be missing from the face.**

This document is where those two are turned into a build order.

---

## The measurement

Every one of the reference's eleven rooms was opened and read, then mapped against the 32
rooms frozen in `expected-set.json`. Verdicts are assigned by what a room **does**, not by
what it is called:

- **FULL** — the reference already builds this room's job
- **PARTIAL** — the material exists but is folded into a different room, so the room itself
  still has to be built
- **NONE** — nothing in the reference serves it

| verdict | count | rooms |
|---|---|---|
| FULL | **8** | today · spine · engine-room · council-chamber · money · ventures · law · learn |
| PARTIAL | **10** | inbox · ask-arc · model-policy · policy · memory · evolve · develop · review-ship · toolbelt · strategy |
| NONE | **14** | map · board · scheduler · bench · absorb · design-studio · growth · leads · legal · ops · trader · discover · org · concepts |

**By ring**

| ring | rooms | FULL | PARTIAL | NONE |
|---|---|---|---|---|
| command | 6 | 2 | 2 | 2 |
| kernel | 8 | 1 | 4 | 3 |
| factory | 5 | 1 | 3 | 1 |
| **money** | **8** | **2** | **0** | **6** |
| company | 5 | 2 | 1 | 2 |

All eleven reference rooms land somewhere; none is wasted. But the reference alone would
ship a face that is **missing 14 of arc's 32 rooms outright** and half-serving 10 more —
and the worst-covered ring is `money`, the one nearest revenue. That is the gap the owner's
second instruction exists to close.

Beyond rooms, the same contract fixes what must render **inside** them: 46 event kinds ·
16 lanes · 26 commands · 30 agents · 7 processes · 7 gates · 7 hooks · 7 rules · 29 lints ·
16 products · **107 concepts**.

---

## The decisions

### D1 — the face is untouched

`FaceStage` ports as-is: the 90×90 particle mask, the ambient cloud, the bloom, the mouse
repulsion, the listening/thinking/talking states. It persists behind every room at reduced
presence. This is the owner's one requirement and it is not traded against anything.

### D2 — the reference is the LANGUAGE; the contract is the STRUCTURE

The eleven rooms are not the room list. What is taken from the reference is its system:
the token set (already extracted to `docs/design/system/tokens.css`), the panel/receipt/
kind/stat/meter components, the translucent-slab-over-the-face treatment, and — the part
that actually makes it not look like a dashboard — **every room opens with a sentence, not
a title**. "If it isn't an event, it didn't happen." Thirty-two rooms need thirty-two such
sentences, and writing them is design work, not filler.

The room list itself comes from `expected-set.json`. It is the frozen contract, and
`face-coverage` fails closed against it.

### D3 — five rings become the navigation, not thirty-two rooms

Coverage and a 32-item sidebar are not the same requirement. The contract says every part
of arc must be **findable**; it does not say each needs a permanent nav row, and 32 rows
would defeat the 30–60 minute budget the whole product is built around.

So the rail carries the **five rings** — `command · kernel · factory · money · company` —
and rooms live inside them. The `command` ring (Today · Inbox · Map · Spine · Board · Ask
arc) is the daily surface; the other 26 rooms are one level in. The reference's eleven-item
rail is replaced, which is exactly the kind of change D1 hands over.

### D4 — un-fold what the reference folded

The reference merges rooms that arc keeps separate, because it was drawn before the lane
model existed:

| reference room | contract rooms it folds | why they split |
|---|---|---|
| Overview | today + inbox | Today is a read; Inbox is the one write path. Merging them means the only mutating surface in the product has no boundary of its own. |
| Factory | toolbelt + develop + review-ship | three lanes, three truths, three owners |
| Learn | learn + memory + evolve | `memory` and `evolve` are their own lanes with their own receipts |
| Engine room | engine-room + model-policy | model TIERS are law (ADR-0069); a driver picker is not a policy surface |

Splitting them back is not bureaucracy: each of those has a lane, a manifest, and a `face:`
section already generated. A folded room cannot show a lane's burn, phase, or gate state.

### D5 — the Map is promoted from nice-to-have to the coverage guarantee

The reference contains **no transit map at all** — the single largest hole in it. REQ-04
builds it from zero, and it is now the highest-value missing piece rather than a late
flourish, because the Map *is* "nothing is missing" made visible: every room a station,
every lane a line, unexercised lines dashed, planned rooms dotted, in-flight dots moving on
receipt. A list can hide a gap. A map cannot.

### D6 — the 14 empty rooms are mostly a rendering job, not a design job

This is the finding that makes full coverage affordable. Phase 05 already landed a `face:`
section in **all 16 manifests**, generated from this same contract, plus the 6-zone lane
template (ADR-1306) and `KNOWN_FIELDS` in `product-lint`. So most of the 14 come from the
generic renderer fed by manifest data — they are not 14 bespoke designs.

Bespoke panels stay for the rooms whose job the template cannot express: **Map · Inbox ·
Board · Spine · Money · Council chamber · Ventures · Ask arc**. Everything else renders
generic first and earns a bespoke panel only when the generic version is provably
insufficient.

### D7 — the honest-state vocabulary is not optional in a generic room

A generic room with no data must say which kind of nothing it is: `not instrumented` ·
`ABSENT + reason` · `MISSING` · `PENDING n/floor` · `SIMULATED` · `REHEARSAL` · `DRILL` ·
`EXPLORATORY`. Six of the eight money-ring rooms have little or no live data today, so
without this the coverage win would be 14 convincing empty rooms — which is worse than
missing rooms, because a missing room is honest.

---

## Build order

| # | work | rooms | why here |
|---|---|---|---|
| 1 | shell + rings + Today + Inbox on L2's real doors | 2 | the daily surface, and the only write path |
| 2 | generic renderer over `face:` manifest sections | ~21 | buys the most coverage per day of work |
| 3 | **Map** | 1 | the coverage guarantee; also proves the renderer's data is complete |
| 4 | Spine · Board · Money · Council · Ventures bespoke | 5 | the reference already designed four of these |
| 5 | Ask arc as a room | 1 | deterministic half is built; needs a surface |
| 6 | remaining bespoke, earned not assumed | rest | only where generic is provably insufficient |

---

## The gate that has to hold this, and the hole found in it

`face-coverage` is what makes "nothing missed" checkable rather than asserted — so the
first thing done under this mandate was to check the checker.

**It was covering 5 of 11 inventories.** kinds · lanes · commands · agents · products were
validated. `gates` · `hooks` · `rules` · `lints` · `processes` · `concepts` — **164
contract rows between them, every one naming a room** — were never read at all. All 164
happened to be correct, which is exactly why it went unnoticed: an unwatched map that is
right today is indistinguishable from a watched one. The 107 concepts matter most, since
they are the ⌘K backing store and a concept homed in a room that does not exist is a search
result that opens nothing.

Closed 2026-08-23. The gate now validates all six, plus two new tree truths derived the
same way as the others (`.claude/rules/*.md` and `processes/*.process.yaml`).

**Reopened and closed again the same day, by ADR-1317.** A fresh audit asked the harder
question — what exists in this repo that is in **no** inventory the gate reads — and measured
nine answers. The paragraph that stood here was part of the problem: it excluded `gates`,
`hooks` and `lints` with one shared sentence, and that sentence is **false for gates**.
`arc.gates.yaml` carries exactly seven `- name:` rows, exactly the seven contract keys — a
machine-readable registry. An eighth gate would have got no room and no failure.

Eight inventories are now derived from the WORLD rather than from the contract: `gates`
(`arc.gates.yaml`) · `jobs` (`hq.jobs.yaml`) · `ventures` (`ventures.yaml`) · `adrs`
(`docs/adr/`, by century band) · `plans` (`docs/strategy/plans/`) · `capabilities` (skills +
`.mcp.json` + `docker/`) · `plannedRooms` (`planned-rooms.json`) · `ci`
(`.github/workflows/`).

Two exclusions remain, and **each now names the file that makes it true**:

| inventory | why it is not derived 1:1 | the file |
|---|---|---|
| `hooks` | 15 units behind 7 **event-level** rows — the inventory is the event, because that is what a person reasons about | `.claude/hooks/*.d/` |
| `lints` | 29 rows over 34 lint-named scripts; `legal-lints (4)` is deliberately one row for four | `.claude/scripts/**/*lint*` |

An exclusion that does not name its file cannot be checked, and gets inherited by rows it was
never written about. That is precisely how `gates` kept a reason that belonged to `lints`.

**Nine new mutant arms** were added so none of the new checks can rot into a vacuous pass;
each corrupts a real row and asserts the gate names the ghost. `--selftest` runs 17 arms
plus the clean tree plus the exit-code arm, all PASS.

### Verified, not asserted

| claim | how it was checked | result |
|---|---|---|
| every manifest carries a `face:` section generated from the contract | `face-sections.mjs --check` | 16 mapped, 0 unmapped by design |
| the tree still satisfies the frozen contract | `face-coverage.mjs` | 46 kinds · 16 lanes · 26 commands · 30 agents · 16 products · 7 rules · 6 processes · 164 homed rows |
| the gate fails closed on every dimension it claims | `face-coverage.mjs --selftest` | 17/17 mutant arms named |

An earlier draft of this document asserted the manifest claim from `PROGRESS.md` and a
`grep` for `^face:` that returned **zero** — because the sections are nested, not
top-level. The grep was wrong and the claim was right; the tool settled it. That is the
reason a claim in this lane is carried by a command and not by a sentence.
