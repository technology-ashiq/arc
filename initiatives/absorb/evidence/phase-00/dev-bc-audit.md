# DEV-B/C boundary audit — what develop C6 actually shipped

**Phase:** absorb 00 · **Date:** 2026-08-09 · **Method:** read from the tree, never from
`PLAN-develop`'s prose about the tree. Every claim carries `file:line`. Where the file and the plan
disagree, the file wins and the disagreement is recorded as a finding.

**Why this exists:** ADR-0600 makes absorb's registry rows *reference* develop's lock rather than
duplicate them (A5), and ADR-0604 routes a Capability Proposal returning "technique" to absorb.
Both assume a contract. This audit reads the contract before the registry's reference format is
frozen.

---

## 1. The lock row contract — `.claude/scripts/develop/capability-lock.json`

**Top-level shape:** an object with exactly two keys — `capabilities` (array, `:2`) and `refusals`
(array, `:15`, currently empty).

**One live row** (`:3`–`:13`), carrying nine fields:

| field | line | value shape observed |
|---|---|---|
| `name` | `:4` | bare package name (`madge`) |
| `registry` | `:5` | registry id (`npm`) |
| `version` | `:6` | exact pin, no range (`8.0.0`) |
| `hash` | `:7` | `sha512-` prefixed integrity string |
| `publisher-auth` | `:8` | free prose — maintainer names + how it was verified + a date |
| `build-attestation` | `:9` | free prose, explicitly records ABSENCE (`none published`) |
| `checked` | `:10` | ISO date |
| `source` | `:11` | `registry:name@version` plus retention note |
| `class` | `:12` | free prose mixing capability class AND the human-OK receipt |

**Identity, for reference purposes:** `name` + `version`. The allowlist
(`.claude/scripts/develop/capability-allowlist.txt:1`) keys on `name` alone and currently contains
one entry, `madge`.

### FINDING 1.1 — there is no declared schema, so "required vs nullable" does not exist to be read

ADR-0600's exit criterion asked for "every field, which are required, which are nullable". **That
question has no answer in the tree.** There is no JSON Schema, no `$comment` contract, and no
validator for this file — the only definition of a valid row is the nine fields the single existing
row happens to carry, plus whatever `capability-vet.sh` inspects. "Required" is therefore inferred
behaviour, not a declared contract.

**Consequence for ADR-0600:** absorb's registry cannot validate a reference against a declared
contract. It can only assert that the referenced `name` + `version` **resolves to exactly one row**
in `capabilities[]`. That is what `tests/absorb-registry-ref.bats` asserts, and it is deliberately
the weaker claim, because the stronger one is not available.

### FINDING 1.2 — `class` is prose that encodes two separate machine-relevant facts

`:12` reads `"write-capable (human OK recorded: ashiq 2026-08-03)"`. That single string carries the
capability class **and** the human-approval receipt. Anything wanting to know "is this write-capable"
or "was this human-approved" must parse prose.

**Consequence for absorb:** a registry row must never restate either fact. It references the lock
entry and stops. This is A5 working, and it is also why REQ-04's "rows reference, never duplicate" is
a lint rule rather than a convention.

### FINDING 1.3 — the tree and `initiatives/develop/PROGRESS.md` disagree about madge, and the disagreement is unresolved

`initiatives/develop/PROGRESS.md:231` records the phase result as *"The real candidate was
**refused**… It BLOCKed on `human-ok`"*. The lock file has madge in `capabilities[]` with a recorded
human OK (`:12`) and an **empty** `refusals[]` (`:15`).

Both can be true in sequence — BLOCKed, then the owner recorded his OK — but nothing in the tree
dates or receipts that transition, and `refusals[]` has no record of the original BLOCK. Recorded
here as an open question for develop, **not** something absorb resolves or edits.

**Consequence for absorb:** none mechanically. It is cited because ADR-0074's trigger audit leaned on
"madge has zero use receipts", and that conclusion is unaffected either way: no harness code path
consumes madge, and `initiatives/develop/debt-ledger.md:18` records the circular-dependency check
that would have consumed it as a declared PLAN no-go.

---

## 2. The vet gate — `.claude/scripts/develop/capability-vet.sh`

**Seven conditions** (`:11`–`:17`), documented in the file's own header:

| # | condition | what it requires |
|---|---|---|
| 1 | `existence` | a recorded registry response that PARSES and names this name at this version |
| 2 | `allowlist` | the name was decided in advance, not discovered live |
| 3 | `version` | pinned exactly, and offered by the recorded response (a git SHA for a skill) |
| 4 | `hash` | the integrity string, EQUAL to the one the registry published |
| 5 | `provenance` | TWO fields, recorded separately, each real text |
| 6 | `content-scan` | the whole fetched tree, scanned for exfiltration and pipe-to-interpreter |
| 7 | `human-ok` | required whenever the tree is write-capable, or cannot be fully read |

### FINDING 2.1 — all seven BLOCK; this gate has no WARN tier at all

`:8`–`:9`: *"It BLOCKs unless ALL of these hold, and it reports EVERY condition that failed rather
than the first."* There is no WARN path and no TRIAL period. Report-every-failure is confirmed in the
emitter at `:260`.

**Consequence for absorb, stated so nobody "harmonizes" the two later:** develop's gate BLOCKs from
birth because its input is a live third-party artifact about to be installed — a hostile-input path
where a WARN is an install. absorb's lints are WARN-first in TRIAL because their input is arc's own
authored reports and diffs, and promotion goes through `/arc-retro` against `docs/trial-ledger.md`.
**The postures differ because the risk classes differ, not because one is immature.** Making absorb's
lints BLOCK on day one, or develop's WARN, would each be a mistake.

---

## 3. The Capability Proposal — `.claude/agents/capability-scout.md`

**Table columns** (`:24`): `| need | candidate | source | quality evidence | verdict |`

**Verdict set** (`:33`): `worth vetting` · `refused here` · `unknown`

### FINDING 3.1 — CONFIRMED as predicted: there is no `technique` verdict

ADR-0604 rules that *"a Capability Proposal that concludes 'the gap is a technique, not an artifact'
refers here"*. **No such verdict value exists.** The referral rule currently has nothing to hook
into, and a scout finding a technique gap must express it as `refused here` or `unknown` — neither of
which routes anywhere.

**Consequence:** this is REQ-05's job in Phase 3, and it is **two** edits, not one — the
`PLAN-develop` addendum documents the verdict, and `.claude/agents/capability-scout.md` gains it in
both `:33` and its table contract. Phase 3's spec already carries this and records that (b) is cycle
enablement work, not a rebuild, so the ADR-0602 allowlist is not engaged and not widened.

---

## 4. Contradiction with ADR-0606: the code home's stated reason is false

ADR-0606 chose `products/absorb/` for docs and the registry citing **"develop-lane symmetry"**.

**Every one of the twelve product directories contains exactly one file, `manifest.json`** — core,
council, design, develop, engine, evolve, git, hq, leads, plan, qa, review. `products/develop/`
holds no docs and no data. develop's data lives at `.claude/scripts/develop/`.

**So the symmetry claim is wrong.** There is no precedent for a product directory holding data.

### The decision nevertheless STANDS, for a stronger reason found here

`sync-to-project.sh:137` rsyncs **all** of `.claude/` into a consumer project on a bare install
(minus `settings.local.json`, `state/`, `scheduled_tasks.lock`, `worktrees/`), and
`tests/sync.bats:69,76` assert the result is **byte-identical** to
`tests/fixtures/sync-golden/tree-manifest.txt`. `products/` is **never synced** — the script copies
`.claude/`, `docs/templates/`, six meta docs, `CONSTITUTION.md` and two council docs, and nothing
else.

`capability-lock.json` is consequently hash-pinned in that golden manifest
(`tree-manifest.txt:119`). **Every write to develop's lock file forces a regeneration of the golden
fixture** — a real, standing friction develop carries today.

absorb's registry is written on **every technique transition**, far more often than a lock file. Had
it gone to `.claude/scripts/absorb/`, every registry row would perturb a byte-identity gate.
`products/absorb/` is outside the sync surface, so it does not.

**Amendment note required on ADR-0606:** right decision, wrong reason. The reason is
sync-surface exclusion, not symmetry.

### FINDING 4.1 — CORRECTED MID-AUDIT: `products/absorb/manifest.json` is REQUIRED, not optional

**This finding first said the opposite, and the first version was wrong.** It reasoned that absorb is
a lane rather than an installable product (like policy, portfolio and model-policy, which have no
product directory) and therefore needed no manifest. That conflated two different things.

`.claude/scripts/core/product-lint.mjs` refuses any **synced** file that appears in no product
manifest — `product-lint: unmapped file (synced but in no product)`, exit 2, in a CI step that runs
**before** bats. It cost a full CI cycle on 2026-08-07 (`a06cdb8`) when policy's extracted
`subjects.mjs` shipped without a row.

`products/develop/manifest.json` lists **every** develop file explicitly, including data:
`capability-lock.json` and `capability-allowlist.txt` sit in its `files` array alongside ten
`scripts` entries. So the real pattern is:

- a lane that ships **synced** files under `.claude/scripts/LANE/` needs `products/LANE/manifest.json`
- a lane that ships **no** synced files needs no product directory — which is why policy, portfolio
  and model-policy have none, and why policy's own scripts went into `products/hq/manifest.json`
  instead of a new product

absorb ships `.claude/scripts/absorb/report-lint.mjs`, so **absorb needs a product manifest.** What
it does *not* list is `products/absorb/registry.json` — that file is unsynced, needs no row, and
listing it would make the selective-install path copy the technique registry into consumer repos.

**On the ADR-0606 symmetry claim (§4 above):** the "develop-lane symmetry" reason was still wrong for
the *registry*, which is what ADR-0606 was placing, but it is **right for the scripts** — develop
genuinely has both `.claude/scripts/develop/` and `products/develop/manifest.json`. The audit's §4
conclusion is unchanged: registry in unsynced `products/absorb/`, scripts in synced
`.claude/scripts/absorb/` with a manifest row.

### FINDING 4.2 — one manifest regeneration IS required this phase

`.claude/scripts/absorb/report-lint.mjs` lands inside the synced surface, so
`tests/fixtures/sync-golden/tree-manifest.txt` must be regenerated in the same commit. This is
acceptable where the registry would not be: a lint script is stable, a registry is not. **Invisible
locally, red on CI** — regeneration is a Phase 0 step, not a discovery.

---

## Summary — what ADR-0600's reference format becomes

A registry row references a lock entry by **`name` + `version`**, and asserts only that the pair
resolves to exactly one row in `capabilities[]`. It carries no `hash`, no `publisher-auth`, no
`class`, no `provenance` — those live in the lock alone (A5, FINDING 1.2), and a registry row
carrying any of them is a lint warning per REQ-04.

Stronger validation is not available because no schema exists to validate against (FINDING 1.1).
That is a limit of develop's contract, recorded rather than worked around.

**Amendments this audit requires:** ADR-0606 (code-home reason, §4). ADR-0600 and ADR-0604 need no
amendment — 0600's reference-by-name-and-version survives, and 0604's referral rule was already
known to be pending REQ-05 (§3.1).
