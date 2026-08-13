# Evidence bundle — phase 00 · lane legal

**Steel thread: a facts file becomes pages, deterministically, and three lints read the bytes.**

Phase 00 and Phase 01 were built in one continuous run, so several fixes below land in commits
that also carry Phase 01 work. Where that happens the row says so. Nothing here is claimed for
Phase 00 that Phase 01 delivered.

## What exists

| Piece | Path | Shape |
|---|---|---|
| CLI | `.claude/scripts/legal/arc-legal.mjs` | `render --venture NAME --out DIR`; exit `0` rendered · `2` bad input · `3` could-not-run |
| YAML subset parser | `.claude/scripts/legal/lib/yaml.mjs` | named errors for anchors, aliases, tags, merge keys, flow collections, block scalars, tab indent, duplicate keys, reserved keys, YAML-1.1 octal, NUL, BOM |
| Canonicaliser | `.claude/scripts/legal/lib/canonical.mjs` | `arc-legal-canon/1`; type-tagged, length-prefixed, NFC-normalised; refuses NON_FINITE, NON_INTEGER, UNSAFE_INTEGER, BIGINT, UNDEFINED, EXOTIC_OBJECT, CYCLE, ARRAY_HOLE |
| Schema | `.claude/scripts/legal/lib/schema.mjs` | three risk tiers per ADR-1002; closed vocabularies; three cross-field rules |
| Template engine | `.claude/scripts/legal/lib/template.mjs` | two constructs only: guarded clause, namespaced interpolation |
| Lints | `.claude/scripts/legal/lib/lints.mjs` | value · trace · completeness, all reading RENDERED bytes |
| Data | `products/legal/data/` | `vocab.json`, `clause-map.json`, `required-clauses.json`, `pages.json`, `claim-denylist.json`, `grievance-windows.json` |
| Fixtures | `tests/fixtures/legal/ventures/` | six, the full `payment_model` × `gst_registered` cross product |
| Suites | `tests/legal-{render,lints,hash}.bats` | 17 · 21 · 24 = 62 tests |
| Probes | `tests/legal-probe.mjs`, `tests/legal-schema-probe.mjs` | assertions read `_run.json`, never console prose |

Six fixtures, exactly as the executor contract names them:
`fixture-gateway-gst`, `fixture-gateway-nogst`, `fixture-mor-gst`, `fixture-mor-nogst`,
`fixture-none-gst`, `fixture-none-nogst`.

## The negative controls run

Every mutation is executed and the lint is asserted RED against the mutant's own output. A grep is
never the guard. Mutations live in `tests/legal-probe.mjs mutate`: `unpinned-clause`, `empty-page`,
`denylist-bypass`, `claim-in-template`, `branch-leak`, `drop-required-clause`, `map-drift`,
`strip-window-source`, `drop-subprocessors`.

**This is where Phase 00 was worst, and it was caught by CI rather than by me.** On the first push
the eight mutation controls failed on every leg — because the helper was invoked as
`run _mutate_and_render`, and bats `run` executes in a subshell, so `SANDBOX` and `MUTANT_STATUS`
were assigned in a process that exited immediately. **Every negative control for all three lints
was dead.** That is why the three criticals below survived long enough for an agent to find them
instead of a test. Fixed in `7ff3092`→`392bfc5`; the helper is now called directly.

## Adversarial passes — five fresh agents, two surfaces on the code

Doctrine is two fresh attackers with *different* surfaces, and each prompt carries
`initiatives/legal/evidence/fixed-defect-list.md` with the instruction to check every row in every
OTHER file. Both ran. Three text stances ran over the rendered bytes on top.

| Surface | Agent | Headline finding |
|---|---|---|
| Decision logic | fresh | three criticals that put a false or missing legal statement on a page **at exit 0** |
| Shell / OS boundary | fresh | the entry guard compared a lexical path to a realpath'd one — `main()` never ran under any symlinked path, so every macOS sandbox test rendered nothing and asserted `status -eq 0` on the no-op |
| Text — hostile customer | fresh | rewrote cancellation wording that read as friction |
| Text — regulator | fresh | the DPDP notice had to say *voluntarily, in advance of commencement* |
| Text — competitor's lawyer | fresh | unsupportable security phrasing |

~70 findings between them. Three of the five converged independently on the same #1: a venture
itemising other people's records with `stores_third_party_client_data: false` rendered a privacy
page that listed those records and promised nothing about them.

The OS-boundary finding is the **fifth recorded twin-fix recurrence in this repo**: the correct
version of that entry guard already existed in `.claude/scripts/memory/arc-recall.mjs`, comment and
all, and had never been applied here. It was found because the attacker was carrying the
fixed-defect list into a file no row named.

## Defects found and fixed

`initiatives/legal/evidence/fixed-defect-list.md` — **15 rows**, one per hole, each with file,
defect class and fix commit. Updated in the same commit as each fix, by design: Phases 1–3 name
this file by path in their attacker prompts, so it has to be an artifact they can read rather than
a session's memory.

The three criticals, because they are the ones that would have shipped a false statement:

1. **Clause presence was measured in MARKERS, not bytes.** Emptying a clause body deleted the
   liability limitation from the page while completeness-lint reported it present.
2. **The denylist was defeated by a hyphen.** `ISO 27001` was caught, `ISO-27001` passed —
   exploitable from a facts file alone, with no code access.
3. **A `grievance-windows.json` row with a string `ack_hours` was dropped from the `min()` but kept
   in the instrument list**, so the page named an instrument and printed a window four times laxer
   than the real one, while claiming it was the strictest.

Two of my own attacker-fixes introduced fresh false positives (denylist exemption measured with a
raw phrase length against a flattened string; a new bare-URL rule firing on the venture's own
`site_url`). Both are logged in `docs/trial-ledger.md` as false positives against the `value` gate
rather than quietly corrected.

## Trial gates

The three lints are registered in `docs/trial-ledger.md` as separate rows, WARN-first, with their
real firing record: **completeness 1 clean run, value 0 (two logged false positives), trace 0 (one
logged false positive).** None is promotable. `git log origin/main --oneline -5 -- docs/trial-ledger.md`
was run immediately before editing, per the shared-file rule.

## Hash chain (LEG-D) and the human gate (REQ-06)

Both intact and neither is bypassable from this phase. The render hashes the **authored** facts,
never the merged view, under a versioned preimage (`arc-legal-canon/1`) recorded in `_run.json`.
Nothing in Phase 00 writes to the spine, approves anything, or renders into a venture tree.

## CI

**Green at `dae95d5`, run `31672005249` — 19 of 19 jobs `success`, 0 failures.** Read per-JOB via
`gh run view --json jobs`, never the watcher's exit code, and the run's head SHA was confirmed
equal to local HEAD before the result was believed.

That is the third run of this phase and the first green one. The two before it were both real:

| run | SHA | what was red | what it actually was |
|---|---|---|---|
| `31631372943` | `7ff3092` | 8 mutation controls, every leg | `run _mutate_and_render` — bats `run` is a subshell, so every negative control for all three lints was dead |
| `31635518793` | `4904f8e` | macOS shards 2+3, ubuntu 18/20/22, Windows 4+8 | two defects: a product on disk with no `CATALOG` entry, and a test asserting the wrong law |
| `31672005249` | `dae95d5` | — | green |

I was wrong twice about the second run before reading its log — first attributing it wholly to the
entry guard, then to the shard reshuffle. Neither was the cause. The log was.

## Honest gaps carried out of Phase 00

- **`products/legal/` is copied by NEITHER sync path.** `templates/` and `data/` sit outside
  `.claude/`, which is the only tree either sync script copies, so a consumer repo that installs
  the `legal` product gets six scripts and no templates and dies at exit `3`. Phase 02 governance.
- **Same-author caveat on all three lints.** Every clean run so far is this lane checking pages
  this lane wrote. Phase 03's LexOS render is the first outside evidence, and it is one run.
- **The operator's GST-registration posture is unresolved** (assumptions ledger row 3). Both
  branches are built and fixture-pinned, so it blocks Phase 03 only.
