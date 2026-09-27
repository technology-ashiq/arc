<!-- facts: agents=4f53cda1 commands=4f53cda1 docs=4f53cda1 faceRing=785b1405 faceRoom=1fa51fec files=4f53cda1 requires=1f70e0bb scripts=96b04657 version=8e633b4f -->

## In plain words

Think of docs as the company's own librarian. Instead of trusting a directory someone typed up
once and never checked again, it re-derives the whole directory from what the tree actually holds,
every time the wiki is built -- nothing to forget. <!-- src: ADR-1502 -->

`docs` is the product that turns arc's own tree into arc's own reference: one generated page for
every product, lane, process, decision band, command, agent, rule and gate that currently exists,
plus -- wherever someone has written it -- a hand-written explanation of why that thing exists at
all. <!-- src: .claude/scripts/docs/wiki-coverage.mjs -->

No list or number on any generated page is typed by hand: it comes from the tree itself, through
`wiki-build`. <!-- src: .claude/scripts/docs/wiki-build.mjs#renderWiki; ADR-1502 -->

### Why this needs to be a product at all

Before this generator existed, arc's explanation of itself lived in four separate files that each
tried to be the one true account: `docs/how-it-works.md`, `docs/how-arc-works-simple.md`,
`docs/usermanual.md` and `docs/blueprint.md`. <!-- src: ADR-1510 -->

By the time the generated wiki replaced it, one of those four still described six products, when
the tree by then actually held seventeen. <!-- src: initiatives/docs/PROGRESS.md -->

| What goes wrong without it | What it looked like | docs's answer |
|---|---|---|
| Nobody remembers to update the explanation | `how-it-works.md` still claimed six products when the tree held seventeen | Every list and count is derived from the tree at build time, so it cannot go stale without the tree changing too <!-- src: initiatives/docs/PROGRESS.md; ADR-1502 --> |
| Four different files each try to be the one true account | `how-it-works.md`, `how-arc-works-simple.md`, `usermanual.md` and `blueprint.md` all existed at once | Each of the four became a short stub at its old path pointing at its `docs/wiki/` replacement, with the original archived rather than deleted <!-- src: ADR-1510 --> |
| A model writes fluent prose that is usually right | reading alone cannot tell the wrong part of a drafted page from the rest of it | No model-drafted page ships until every factual claim is anchored to a real source and an independent model has marked it SUPPORTED <!-- src: ADR-1508; ADR-1513 --> |

The lane's own retro put the underlying problem in one line: a number nobody recomputes is a
number that starts lying. <!-- src: ADR-1502 -->

The generator ships as its own product, `docs`, rather than folded into `core` -- the floor every
other product requires -- because the choice was carried by keeping `core` minimal and by the
direction of the dependency: `docs` imports `core`'s tree-reading code, and `core` never imports
anything back from `docs`. <!-- src: ADR-1512 -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| entity | one part of arc | Any product, lane, process, ADR band, command, agent, rule or gate that the tree already contains -- the eight kinds the wiki draws a page for. <!-- src: .claude/scripts/docs/wiki-build.mjs#RENDERED --> |
| `treeWorld` | the one walk of the building | The single imported function that already reads every inventory arc has; the wiki reads through it instead of scanning any directory itself. <!-- src: ADR-1501 --> |
| `wiki.json` | the one written-down answer | The single deterministic file the extractor writes; every list and every number on a generated page is derived from it, though a hand-written narrative is included verbatim alongside them. <!-- src: .claude/scripts/docs/wiki-build.mjs#serialize --> |
| narrative | the hand-written "why" | Prose a person wrote, kept in its own file under `docs/wiki/_narrative/`, never generated and never rewritten by any script. <!-- src: ADR-1505 --> |
| narrative pending | nobody has written it yet | The banner a page shows when no narrative file exists for it; the page still shows every fact the tree declares. <!-- src: ADR-1506 --> |
| fingerprint | the "written against" stamp | An eight-character hash per fact key, stored as a narrative's first line, naming exactly which fact it was written against. <!-- src: .claude/scripts/docs/wiki-stale.mjs#fingerprint --> |
| drift | naming something that is gone | A narrative citing an ADR, script, command or path that no longer exists on the tree. <!-- src: ADR-1507 --> |
| anchor | the receipt for one claim | A hidden comment attached to one paragraph, list item or table row, naming exactly which repo path, ADR or extracted fact backs it. <!-- src: ADR-1513 --> |
| plain block | pure explanation, no claim | A block marked as stating no fact instead of carrying an anchor; it may name no file, no command, no ADR and no number. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#anchorProblem --> |
| receipt | the verifier's stamped verdict | A JSON file recording which model judged a narrative, the exact text it judged, and one verdict per block. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#receiptProblem --> |
| explanation debt | what nobody has explained yet | Every product or lane with no narrative, plus every command, agent, process, gate or rule no narrative names -- a count, never a target. <!-- src: ADR-1513; ADR-1506 --> |
| the Reference room | the wiki, inside the running app | The face app's own live view of the same generated facts and the same narrative text. <!-- src: face/src/modules/company/reference/fold.mjs --> |

## How a job flows

1. Every part of arc a page could describe already exists somewhere in the tree, in its own file --
   a product's manifest, a lane's progress tracker, a process file, an ADR, a command's or agent's
   or rule's frontmatter, one matched row per gate. <!-- src: .claude/scripts/docs/wiki-build.mjs#readProduct; .claude/scripts/docs/wiki-build.mjs#readProcess; .claude/scripts/docs/wiki-build.mjs#readAdr; .claude/scripts/docs/wiki-build.mjs#readCommand; .claude/scripts/docs/wiki-build.mjs#readGates -->
2. `wiki-build` never lists a directory itself: it imports `treeWorld` and `treeAdrBands` from
   `face-coverage.mjs` -- the same assembly the face's completeness gate reads -- so the wiki and
   the face cannot disagree about what arc is. <!-- src: .claude/scripts/docs/wiki-build.mjs#extractOrThrow; ADR-1501 -->
3. From `treeWorld` and `treeAdrBands` together, `wiki-build` reads exactly one named file per
   entity and turns the result into one deterministic `wiki.json`. <!-- src: .claude/scripts/docs/wiki-build.mjs#extractOrThrow -->
4. The same script renders `wiki.json` into plain markdown: one page per entity plus an index, each
   starting with a do-not-edit banner. <!-- src: .claude/scripts/docs/wiki-build.mjs#renderWiki -->
5. Wherever a hand-written file exists at `docs/wiki/_narrative/<type>/<id>.md`, its text is
   included verbatim below the generated facts; wherever it does not, the page carries the visible
   "Narrative pending" banner instead. <!-- src: ADR-1505; ADR-1506 -->
6. `wiki-coverage` checks both directions at once: every entity in `wiki.json` must have a page, and
   every page, page directory or narrative file on disk must belong to an entity that still exists. <!-- src: ADR-1503; .claude/scripts/docs/wiki-coverage.mjs -->
8. When a narrative was drafted by a model rather than typed by the owner, it may ship only when
   three things hold: `narrative-anchors` checks that every factual claim carries a source that
   resolves, `narrative-verify` sends the page to a model from a different family which must mark
   every block SUPPORTED before a receipt is written, and the owner reads the page and accepts it. <!-- src: ADR-1513; .claude/scripts/docs/narrative-anchors.mjs#receiptProblem -->

## The stages, one by one

Each stage below is written twice: first in plain words, then in the mechanics that actually run. <!-- plain -->

#### 1. Read the tree once (`wiki-build --json`)

A librarian who wants a good directory has to walk the whole building first -- not remember it from
last time. <!-- plain -->

`wiki-build.mjs --json` calls `treeWorld`, checks that every inventory kind it returns is one the
wiki has decided to render or explicitly decided not to render, then reads exactly one named file
per entity -- a product's `manifest.json`, a lane's `PROGRESS.md` machine header, a process's
`.process.yaml`, an ADR's opening lines, a command's or agent's or rule's frontmatter, and one
matched row per gate in `arc.gates.yaml` -- into one `wiki.json`. A file that exists but cannot be
read stops the build by name; it is never folded into "the fact was empty". <!-- src: .claude/scripts/docs/wiki-build.mjs#extractOrThrow; .claude/scripts/docs/wiki-build.mjs#readProduct; .claude/scripts/docs/wiki-build.mjs#readLane; .claude/scripts/docs/wiki-build.mjs#readProcess; .claude/scripts/docs/wiki-build.mjs#readAdr; .claude/scripts/docs/wiki-build.mjs#readCommand; .claude/scripts/docs/wiki-build.mjs#readAgent; .claude/scripts/docs/wiki-build.mjs#readRule; .claude/scripts/docs/wiki-build.mjs#readGates -->

#### 2. Render the pages (`wiki-build`)

Once the tree's facts are down in one place, turning them into readable pages is deterministic by
construction: every list sorted the same byte-order way, no timestamps, no absolute paths -- the
same input always produces the same output, down to the byte. <!-- src: ADR-1504 -->

`wiki-build.mjs` turns `wiki.json` into an index page and one page per entity under `docs/wiki/`,
every generated file starting with a do-not-edit banner naming the command that regenerates it;
`--check` re-renders in place and compares it against the committed tree, byte for byte, so a hand
edit to a generated page turns CI red on the next PR. <!-- src: ADR-1504; .claude/scripts/docs/wiki-build.mjs#renderWiki; .claude/scripts/docs/wiki-build.mjs#sameBytes -->

#### 3. Check both directions (`wiki-coverage`)

A page for something that no longer exists is a lie with authority; a real part of arc with no page
is invisible. Both directions are checked, and both are FAIL-FROM-BIRTH rather than warn-first. <!-- src: ADR-1503 -->

`wiki-coverage.mjs` fails, naming it, on any entity in `wiki.json` with no matching page, and on
any page, page directory or narrative file that belongs to no entity; an empty inventory is never
reported as covered. Its own `--mutant-selftest` builds six scratch trees: one (M0) is asserted
covered, and the other five (M1..M5) are each asserted to fail, naming exactly what was planted,
before the gate is trusted against the real tree. <!-- src: ADR-1503; .claude/scripts/docs/wiki-coverage.mjs -->

#### 4. Watch hand-written prose rot (`wiki-drift`, `wiki-stale`)

Prose can go wrong in two different ways: it can name something that is now gone, or it can keep
describing a fact that has quietly changed underneath it. Drift blocks; staleness only warns. <!-- src: ADR-1507 -->

`wiki-drift.mjs` scans every narrative for a reference -- an `ADR-NNNN`, a backticked `/command`, a
repo path -- and blocks, naming the file and line, on anything that does not resolve on the current
tree; `wiki-stale.mjs` instead warns, at exit 0, when the fingerprinted facts behind a narrative
have moved, naming which fact key changed. <!-- src: ADR-1507; .claude/scripts/docs/wiki-drift.mjs#backticks -->

Real incident: the very first hand-written narrative this lane drafted tripped `wiki-drift`
immediately -- it cited a command that did not exist -- and the gate refused it before the page
ever shipped. <!-- src: initiatives/docs/PROGRESS.md -->

#### 5. Check every claim has a source (`narrative-anchors`)

A model-drafted page is not trusted just because it reads well: every factual block has to carry an
anchor that resolves, or the gate fails it. <!-- src: ADR-1513 -->

`narrative-anchors.mjs` numbers a narrative's blocks -- a paragraph, a list item, a table row, each
counted once -- and requires every one to carry either a resolving source anchor, or the mark for a
block that names no file, no command, no ADR and no number; a block with neither, or with both,
fails. Its own self-test runs seventeen checks and asserts that exactly seventeen ran before
trusting the result: one confirms a clean, correctly-anchored narrative passes, and the other
sixteen are each a planted mutant or an edge case such as a legacy exemption or an awaiting-owner
count. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#blocksOf; .claude/scripts/docs/narrative-anchors.mjs#ran -->

#### 6. Have a different model judge it (`narrative-verify`)

Reading a fluent page and reading it critically are not the same act: the independent verifier gets
the page and its anchored sources, and nothing of the session that drafted it, on a model family
that must differ from the drafter's. <!-- src: ADR-1513; .claude/scripts/docs/narrative-anchors.mjs#receiptProblem -->

`narrative-verify.mjs` inlines the text every anchor points to, splits the page into byte-limited
chunks when its sources are large, and runs the `narrative-verify` process through `arc-run.mjs`
with `--driver generic-api --trial-model`, on a model whose name may not match the drafting
family; it writes a receipt naming the model, the exact text hash it judged, and one verdict --
SUPPORTED, UNSUPPORTED or CONTRADICTED -- per block, whatever those verdicts turn out to be. <!-- src: .claude/scripts/engine/narrative-verify.mjs; processes/narrative-verify.process.yaml -->

## Every part, explained

### Commands

`docs` declares no commands of its own. <!-- src: fact:products/docs.commands -->

### Agents

`docs` declares no agents of its own; the model that verifies a narrative is reached directly
through `engine`'s `arc-run.mjs`, as a one-off trial run, not through a Claude Code subagent
definition. <!-- src: fact:products/docs.agents; .claude/scripts/engine/narrative-verify.mjs -->

### Processes

- `narrative-verify` -- the job description a drafted narrative is judged against: it hands a
  fresh, tool-less model the page's numbered blocks and every source their anchors name, and asks
  for one SUPPORTED, UNSUPPORTED or CONTRADICTED verdict per block. Declaring no tools at all means
  the verifier can see only what it was handed, structurally, not by instruction. <!-- src: processes/narrative-verify.process.yaml -->

### Scripts

`docs` declares five scripts. <!-- src: products/docs/manifest.json -->

- **The extractor and renderer** -- `wiki-build.mjs` turns the tree into `wiki.json` and `wiki.json`
  into `docs/wiki/**`; the same file also backs `--check` (the dirty-diff gate) and
  `--audit-counts` (re-deriving every number printed on every page from `wiki.json` itself). <!-- src: .claude/scripts/docs/wiki-build.mjs#auditCounts -->
- **The completeness gate** -- `wiki-coverage.mjs` fails on any entity with no page, or any page
  with no entity, in either direction. <!-- src: .claude/scripts/docs/wiki-coverage.mjs#collect -->
- **The narrative-rot and model-narrative checks** -- `wiki-drift.mjs` blocks a narrative naming
  something gone; `wiki-stale.mjs` warns when the facts behind it moved; `narrative-anchors.mjs`
  checks that every factual block in a narrative resolves to a real source, counts the explanation
  debt, and refuses a page with no passing receipt. <!-- src: ADR-1507; ADR-1513 -->

### Gates and rules

This product's own checks run as CI tests instead, five files, each named for the phase that built
it: `docs-extract.bats` (the tree read), `docs-coverage.bats` (both-direction coverage),
`docs-render.bats` (the dirty-diff render check), `docs-drift.bats` and `docs-narrative.bats` (the
narrative-rot and anchor-and-receipt rules). <!-- src: tests/docs-extract.bats; tests/docs-coverage.bats; tests/docs-render.bats; tests/docs-drift.bats; tests/docs-narrative.bats -->

Three of the five scripts `docs` declares carry their own `--mutant-selftest` or `--selftest`, plant
a fault on purpose, and refuse to be trusted unless every planted fault is caught by name:
`wiki-coverage.mjs` runs six such arms, `wiki-drift.mjs` runs four, and `narrative-anchors.mjs` runs
seventeen. <!-- src: products/docs/manifest.json; .claude/scripts/docs/wiki-coverage.mjs#gates; .claude/scripts/docs/wiki-drift.mjs#failedArms; .claude/scripts/docs/narrative-anchors.mjs#ran -->

## The bigger loop

### The life of one narrative, from pending to accepted

1. A page starts out with nothing but the facts the tree already declares, under the visible
   "Narrative pending" banner. <!-- src: ADR-1506 -->
2. Someone -- the owner, by hand, or a model drafting under this rule -- writes the prose, and marks
   every factual block with an anchor, or marks a block as stating no fact about arc at all, when
   that is true. <!-- src: ADR-1513; ADR-1508 -->
3. `narrative-anchors.mjs` is run until the only finding left for that page is that it is
   unverified: every anchor resolves, but nobody has yet judged whether the words the anchor
   supports are actually true. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#evaluate -->
4. `narrative-verify.mjs` hands the numbered blocks and their inlined sources to a fresh model from
   a different family, reached as a one-off trial through `arc-run.mjs`, never through the routed
   rota. <!-- src: .claude/scripts/engine/narrative-verify.mjs -->
5. That model returns one verdict per block, and the receipt is written whatever the verdicts say
   -- a failing receipt is evidence too. <!-- src: .claude/scripts/engine/narrative-verify.mjs -->
6. One block marked anything other than SUPPORTED, and `narrative-anchors.mjs` refuses to ship the
   page; an edit made after a passing verdict unships it again too, because the receipt's recorded
   text hash no longer matches what is on disk. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#receiptProblem -->
7. Only once every block is SUPPORTED does the owner read the page and accept it, which is recorded
   in that same receipt file as `accepted: { by: "owner", on: <date> }`. <!-- src: ADR-1513 -->
8. Until that acceptance lands, the page is counted separately as awaiting the owner -- a warning,
   not a failure, so a verified-but-unread page is never mistaken for a finished one. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#evaluate -->

### How it connects to the rest of arc

`docs` declares `requires: [core, engine, hq]`; a real fix once had to add two of those three after
the fact, because the rule is that `requires` names every product whose file the scripts actually
import, statically or dynamically -- not only the ones that seemed relevant at the time. <!-- src: fact:products/docs.requires; initiatives/docs/fixed-defects.md -->

No product declares `docs` in its own `requires`: the generated page's `Required by` field --
computed once across every product's declared `requires` -- lists none. <!-- src: docs/wiki/products/docs.md; .claude/scripts/docs/wiki-build.mjs#relationsOf -->

`docs` is also a lane: the same id names the initiative that built this product, tracked at
`initiatives/docs/PROGRESS.md` like any other build. <!-- src: initiatives/docs/PROGRESS.md -->

Its own declared face room is `lane` on the `factory` ring, watching for `kickoff.done` and
`phase.closed` events -- the same room every lane-owned room in the face folds the same way. <!-- src: fact:products/docs.faceRoom; fact:products/docs.faceRing; products/docs/manifest.json; face/src/lib/lane-room.mjs#TRAIL_ROWS -->

The face app's Reference room reads the exact same `wiki-build` extract and the exact same computed
cross-links that these generated pages are drawn from, and splits a narrative's text at the same
`## The bigger loop` heading this page uses, so the room and the markdown page can never disagree
about where a narrative's story begins. <!-- src: face/src/modules/company/reference/fold.mjs#splitNarrative -->

## Glossary

- `entity` -- the eight kinds of thing `wiki-build` turns into a page: product, lane, process, ADR
  band, command, agent, rule, gate. <!-- src: .claude/scripts/docs/wiki-build.mjs#RENDERED -->
- `wiki.json` -- the one deterministic file the extractor writes; every list and number on a
  generated page is derived from it, alongside a hand-written narrative included verbatim. <!-- src: .claude/scripts/docs/wiki-build.mjs#serialize -->
- `block` -- one paragraph, list item, table row or quote in a narrative's text, numbered in
  reading order; a heading or a fenced code block is never a block. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#blocksOf -->
- `fact:<type>/<id>.<key>` -- an anchor pointing at one extracted field of one entity, rather than
  at a whole file. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#anchorProblem -->
- `model_source` -- a receipt's field recording how the verifying model was reached: `trial` for a
  model named directly on the command line (`--driver generic-api --trial-model <id>`), or `router`
  for one resolved through `engine/router.yaml` instead. Whichever it is, the model's name may never
  match the drafter's own family. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#receiptProblem; .claude/commands/arc-attack.md; ADR-0220 -->
- `awaiting-owner` -- a narrative every block of which has already been verified, but which the
  owner has not yet read and accepted. <!-- src: ADR-1513 -->
- `legacy narrative` -- one of the narratives written by hand before this anchor-and-receipt rule
  existed, exempt from it only while its text stays byte-for-byte the same as when it was written. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#LEGACY -->
- `explanation debt` -- every product or lane with no narrative, plus every command, agent,
  process, gate or rule that no narrative names in backticks; a count, never a target. <!-- src: .claude/scripts/docs/narrative-anchors.mjs#explanationDebt; ADR-1506 -->
- `chunk` -- a slice of one page's blocks and their sources, kept under a byte limit, because a
  whole page's sources once timed out on every model tried. <!-- src: .claude/scripts/engine/narrative-verify.mjs#CHUNK_BYTES -->
- `the Reference room` -- the face app's own live view of the same generated facts and the same
  narrative text, split at the same heading the pages use. <!-- src: face/src/modules/company/reference/fold.mjs#splitNarrative -->
