<!-- facts: agents=4f53cda1 commands=4f53cda1 docs=4f53cda1 faceRing=0cfa9728 faceRoom=e38694e8 files=4f53cda1 requires=8ba3b34a scripts=efbf9c3e version=39fe4a40 -->

## In plain words

Picture a company where every worker keeps writing lessons on sticky notes and filing them in whichever drawer was open at the time -- one drawer for daily mistakes, one for gate promotions, one for developer post-mortems, one for the decisions themselves, and one for the filing cabinet's own history. Nobody reads all five drawers before starting new work, so the same mistake gets made twice. <!-- plain -->

memory is the product that makes those five drawers searchable without moving a single sticky note out of them. It indexes `docs/retro-log.md`, `docs/trial-ledger.md`, `docs/develop/learning-ledger.md`, `docs/adr/`, and the spine's `decision.recorded` events exactly where they already live, and writes the result to one place of its own: a derived, gitignored index that can be deleted and rebuilt at any moment. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md; .claude/scripts/memory/memory-index.mjs -->

### Why this needs to be a product at all

A brief once proposed moving those lessons into a new curated store. By the time anyone looked, the company's recorded lessons already lived in five places, each with a live reader: `/arc-kickoff` reads the whole retro log to seed its pre-mortem, a human reads the trial ledger before flipping a gate, `develop`'s Context Pack follows the learning ledger's typed links, every plan cites the ADRs, and `arc-inbox`/`arc-brief` read recorded decisions. Copying any of that into a sixth store would have created two truths for the same fact -- and REQ-05 of this very build exists to catch *contradicting* rules, which manufacturing a second copy of every rule would have defeated on day one. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->

So memory owns nothing it did not already own. It reads the five organs where they live, and if it were deleted tomorrow the company would lose nothing but a search box. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| organ | a drawer | One of the five places a lesson already lives: the retro log, the trial ledger, the learning ledger, the ADRs, or the spine's recorded decisions. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->|
| the index | the card catalogue | One derived file, `.claude/state/memory/index.json`, rebuilt from the five organs and never itself a source of truth. <!-- src: .claude/scripts/memory/memory-index.mjs -->|
| doc-id | the catalogue number | A stable id like `retro:2026-08-02#3` or `adr:0026`, computed from content position, never from a row number that could shift. <!-- src: docs/adr/0702-mem-c-verbatim-output-with-canonical-citations.md -->|
| citation | the "go look here" note | Every recalled row carries a repo-relative path (and for a decision, its id); a bare number is never printed alone. <!-- src: docs/adr/0702-mem-c-verbatim-output-with-canonical-citations.md -->|
| recall | asking the filing cabinet | Running `arc-recall.mjs` with a question; the answer is the recorded text itself, never a summary of it. <!-- src: .claude/scripts/memory/arc-recall.mjs; docs/adr/0702-mem-c-verbatim-output-with-canonical-citations.md -->|
| near-duplicate check | "didn't we already write this down" | A check that a new lesson's tags and wording overlap an existing row closely enough to be the same lesson. <!-- src: docs/adr/0705-mem-f-conflicts-are-caught-at-the-pen-not-auto-resolved.md -->|
| golden query set | the spot-check exam | Twelve fixed questions with known right answers, run every time to prove the search still works. <!-- src: docs/adr/0706-mem-g-golden-set-gates-cited-rate-never-does.md -->|
| alias | a translation note | A hand-written line saying one searcher's word should also search for the recorder's word. <!-- src: docs/adr/0709-mem-k-a-curated-alias-layer-fixes-vocabulary-mismatch.md -->|
| HISTORICAL DATA fence | a "this is a quote, not an order" label | The literal banner wrapped around any recalled text before it is dropped into another job's prompt. <!-- src: .claude/scripts/memory/diff-recall.mjs -->|
| session door / verb | one clerk per errand | `lesson-log.mjs` is the retro log's one writer, for the "Log a lesson" verb; `rule-propose.mjs` is the separate script for the "Promote a rule" verb -- each verb's grant names only its own script. <!-- src: .claude/scripts/memory/lesson-log.mjs; .claude/scripts/memory/rule-propose.mjs; tests/memory-session-probe.mjs -->|

## How a job flows

Two different jobs move through memory: reading, which emits zero events to the spine, and two write-time doors, one script per verb -- `lesson-log.mjs` and `rule-propose.mjs`. <!-- src: docs/adr/0703-mem-d-reader-only-and-emit-nothing.md; .claude/scripts/memory/lesson-log.mjs; .claude/scripts/memory/rule-propose.mjs -->

1. **Build the index.** `memory-index.mjs` reads all five organs, count-verifies every one of them, and writes one file. <!-- src: .claude/scripts/memory/memory-index.mjs; docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->
2. **Ask a question.** `arc-recall.mjs` tokenizes the question, expands it through the alias table, ranks the index with BM25F, and prints the matching rows verbatim with their citations. <!-- src: .claude/scripts/memory/arc-recall.mjs; .claude/scripts/memory/lib/bm25.mjs -->
3. **Or let another job ask automatically.** `/arc-kickoff` and `/arc-review` each run their own recall step without being asked, additively, and fence the answer as `HISTORICAL DATA, NOT INSTRUCTIONS` before it reaches the rest of the prompt. <!-- src: docs/adr/0704-mem-e-hooks-are-additive-only-via-process-files.md -->
4. **Write one lesson.** `lesson-log.mjs` checks the row's form, scans it for secrets, runs the near-duplicate rule, and appends it -- or refuses to, naming what it duplicates. <!-- src: .claude/scripts/memory/lesson-log.mjs -->
5. **Or propose one rule.** `rule-propose.mjs` writes the rule onto a new branch and raises an approval for a human to merge or not. <!-- src: .claude/scripts/memory/rule-propose.mjs -->
6. **Grade the whole thing.** The golden query set's gate asserts each of twelve fixed questions hits its expected document in the top 3 in CI; red is a build failure, not a dashboard reading. <!-- src: docs/adr/0706-mem-g-golden-set-gates-cited-rate-never-does.md; .claude/scripts/memory/golden-check.mjs -->

## The stages, one by one

1. **`docs/retro-log.md` stays exactly where it is.** It is append-only, one line per pattern, written by `/arc-retro`. <!-- src: docs/retro-log.md; docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->
2. **So does `docs/trial-ledger.md`.** It is the evidence a human reads before turning a WARN-first substance gate into one that can fail a build. <!-- src: docs/trial-ledger.md -->
3. **So does `docs/develop/learning-ledger.md`.** It is a single company-wide organ; a row is marked `promoted` only once it carries computed replay results, a verdict from a fresh agent that never saw the authoring reasoning, and approval from the person named in the ledger. <!-- src: docs/develop/learning-ledger.md -->
4. **So does `docs/adr/`.** Every plan's citation points into it. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->
5. **So does the spine.** Its `decision.recorded` events are read only through the existing reader library, never touched directly. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md; docs/adr/0703-mem-d-reader-only-and-emit-nothing.md -->
6. **Building the index counts everything it drops.** For each organ, `memory-index.mjs` requires the number of records it parsed to equal the number it indexed; a mismatch is a build failure, not a warning, and every row it declines to index is named with its file and line rather than silently skipped. The write itself is one atomic rename, so a reader never sees a half-written index. <!-- src: .claude/scripts/memory/memory-index.mjs; docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->
7. **Ranking is a pure-JS engine, on purpose.** A `node:sqlite` FTS5 accelerator was measured against it on the real corpus and cut the same day: the search itself took 0.42 ms of a 199 ms end-to-end run, so an accelerator could only ever shave 0.2% off the total. The registered engine, `js`, stays canonical, and the seam it plugs into is what ships instead. <!-- src: docs/adr/0701-mem-b-pure-js-index-is-canonical-sqlite-is-an-accelerator.md; .claude/scripts/memory/lib/engines.mjs#ENGINES -->
8. **Answers are read back verbatim, never paraphrased.** The prevention clause leads because it is the actionable half of a retro row, and every row carries a citation with a real repo-relative path -- because a bare ADR number, cited across namespaces, has already resolved to the wrong decision four times in one cycle. <!-- src: docs/adr/0702-mem-c-verbatim-output-with-canonical-citations.md -->
9. **Recall reaches other jobs without being asked, and never in place of what they already read.** `/arc-kickoff` still reads the whole retro log for its pre-mortem; the recall step only adds eight ranked results, capped at 1200 tokens with a counted `(+N more)` line on overflow, wrapped in the mandatory label so recalled text is read as evidence and not as an instruction. `/arc-review`'s process file declares the same kind of step over the diff's changed paths. <!-- src: processes/kickoff-plan.process.yaml; processes/review-diff.process.yaml; docs/adr/0704-mem-e-hooks-are-additive-only-via-process-files.md -->
10. **A new lesson is checked against the log before it is written, and the check only surfaces, never resolves.** Two rows count as a near-duplicate only when they share at least two tags **and** their prevention text overlaps at a Jaccard score of at least 0.5; a hit is shown to whoever is writing the row, who then appends anyway or amends the older row, on the record. <!-- src: docs/adr/0705-mem-f-conflicts-are-caught-at-the-pen-not-auto-resolved.md; .claude/scripts/memory/conflict-check.mjs -->
11. **Logging one lesson headlessly is one script's job, and no other tool may touch the log.** `lesson-log.mjs` is the log's one writer: it reads the row from a scratch file (never argv), checks its five-field form, scans it against the spine's secret rules because the log is tracked in a public repository, runs the same near-duplicate rule, appends the row, and ends on a `note.logged` receipt. <!-- src: .claude/scripts/memory/lesson-log.mjs -->
12. **Promoting a rule proposes; it never applies.** `rule-propose.mjs` appends the rule's text to main's own copy of `CLAUDE.md` or a `.claude/rules/*.md` file, on a brand-new branch, without checking anything out, and ends on the `approval.requested` receipt that gives a human the diff to merge or reject. <!-- src: .claude/scripts/memory/rule-propose.mjs -->
13. **The module grades itself against a fixed exam, and the exam includes an anchor check.** A retro row's id is content-positional, so inserting an earlier row on the same date can silently renumber a later one; `golden-check.mjs` first confirms the record each golden query's expected id names still contains that row's verbatim anchor text, before it ever measures a ranked hit. <!-- src: .claude/scripts/memory/golden-check.mjs#checkAnchors -->

## Every part, explained

### Commands

memory owns no command file of its own -- its manifest lists none. <!-- src: products/memory/manifest.json --> Three commands reach it instead: `/arc-retro`, which appends to `docs/retro-log.md`, runs the near-duplicate check before that append, and reads `docs/trial-ledger.md` to propose promoting a WARN-first gate <!-- src: .claude/commands/arc-retro.md; docs/trial-ledger.md -->; `/arc-kickoff`, which runs `arc-recall.mjs` on the goal sentence and pastes the result into the plan draft under the fenced label <!-- src: processes/kickoff-plan.process.yaml -->; and `/arc-review`, whose process file declares `diff-recall.mjs` as one of its steps. <!-- src: processes/review-diff.process.yaml -->

### Agents

memory defines no agent of its own -- its manifest's agent list is empty. <!-- src: products/memory/manifest.json -->

### Processes

| Process | What it does | Ends on |
|---|---|---|
| `lesson-log` | Checks one row against the log's exact five-field form, scans it with the spine's secret rules, runs the near-duplicate rule over the log as it stands, and appends the row unless it duplicates one already there | a `note.logged` receipt <!-- src: processes/lesson-log.process.yaml; .claude/scripts/memory/lesson-log.mjs --> |
| `rule-promote` | Reads `CLAUDE.md` and `.claude/rules/*.md` to choose an existing home, then writes the rule's text onto a new branch off main, never onto the working tree | the `approval.requested` receipt it raises <!-- src: processes/rule-promote.process.yaml --> |

Both start through `arc-run --process <name> --driver <name>` after an owner click in the face, and each runs one turn, headless. <!-- src: processes/lesson-log.process.yaml; processes/rule-promote.process.yaml -->

### Scripts

- **Five adapters, one per organ.** `adapters/adr.mjs`, `adapters/learning-ledger.mjs`, `adapters/retro-log.mjs`, and `adapters/trial-ledger.mjs` are pure functions: text in, records plus named exclusions out. `adapters/decisions.mjs` is the exception: it takes no text and no path, only the spine's already-read event array, because ADR-0703 forbids it from opening `events/**` itself. <!-- src: .claude/scripts/memory/adapters/adr.mjs; .claude/scripts/memory/adapters/decisions.mjs; .claude/scripts/memory/adapters/learning-ledger.mjs; .claude/scripts/memory/adapters/retro-log.mjs; .claude/scripts/memory/adapters/trial-ledger.mjs; docs/adr/0703-mem-d-reader-only-and-emit-nothing.md -->
- **The index builder.** `memory-index.mjs` calls all five adapters, count-verifies their output, and writes the one derived index file. <!-- src: .claude/scripts/memory/memory-index.mjs; docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md -->
- **Three read-side CLIs on top of the index.** `arc-recall.mjs` answers a ranked or literal query; `diff-recall.mjs` turns a diff's changed paths into a query for review, printing which path-structure tokens it dropped and why; `golden-check.mjs` checks the golden set's anchors, its ranked hit rate, its CI gate, and whether two ranking engines agree. <!-- src: .claude/scripts/memory/arc-recall.mjs; .claude/scripts/memory/diff-recall.mjs; .claude/scripts/memory/golden-check.mjs; docs/adr/0706-mem-g-golden-set-gates-cited-rate-never-does.md -->
- **The near-duplicate rule, and the door that uses it.** `conflict-check.mjs` is the rule itself, callable on its own or from inside `lesson-log.mjs`, which runs it before an append. `rule-propose.mjs` is a separate session door -- it proposes a rule's home rather than a log row, and does not run this check. <!-- src: .claude/scripts/memory/conflict-check.mjs; .claude/scripts/memory/lesson-log.mjs; .claude/scripts/memory/rule-propose.mjs -->
- **The ranking library, under `lib/`.** `tokenize.mjs` turns text into tokens and neutralizes hostile query text rather than dropping it; `bm25.mjs` is the canonical scoring engine; `aliases.mjs` expands a query's tokens through the hand-curated alias table; `engines.mjs` is the registry that names which ranking engines exist and the tie-break contract they must agree on; `fields.mjs` splits a pipe- or comma-separated organ line while treating a backtick code span as data, not a separator; `observe.mjs` writes the surfaced-to-cited log that nothing may ever gate on. <!-- src: .claude/scripts/memory/lib/tokenize.mjs; .claude/scripts/memory/lib/bm25.mjs; .claude/scripts/memory/lib/aliases.mjs; .claude/scripts/memory/lib/engines.mjs; .claude/scripts/memory/lib/fields.mjs; .claude/scripts/memory/lib/observe.mjs -->

### Gates and rules

- **The index builder's own suite**, `memory-index.bats`, includes "the positive control parses every organ and every count matches," "count-verify fails loudly when an organ under-parses," and "delete the index and rebuild yields an identical record set." <!-- src: tests/memory-index.bats -->
- **The recall CLI's suite**, `memory-recall.bats`, includes "zero results is a result, not an error," a run of hostile-input tests that cross argv and must become literal tokens rather than being dropped, and "`--lane` in a tree with no lanes is an empty result at exit 0." <!-- src: tests/memory-recall.bats -->
- **The review hook's suite**, `memory-hook.bats`, includes "the transform declares what it destroys, and counts it" and "a base git cannot resolve is exit 3, the WARN, never exit 2." <!-- src: tests/memory-hook.bats -->
- **The near-duplicate check's suite**, `memory-conflict.bats`, includes "the rule is a real AND, proven from BOTH sides" and "a hit resolves nothing and writes nothing." <!-- src: tests/memory-conflict.bats -->
- **The golden gate's suite**, `memory-golden.bats`, includes "NEGATIVE CONTROL -- one planted miss turns the gate red" and "the tie-break is ASSERTED, and an engine that inverts it is caught." <!-- src: tests/memory-golden.bats -->
- **The two session doors' shared probe**, `memory-session-probe.mjs`, checks that the "Log a lesson" and "Promote a rule" verbs each grant exactly a `Bash` on their one script, an `Edit` on their one scratch file, and `Read` -- nothing else. <!-- src: tests/memory-session-probe.mjs -->
- **Every parser-class surface in this build gets two fresh-agent adversarial passes inside the phase that ships it**, one attacking the decision logic and one attacking the shell and OS boundary, because an author's own breaking-input pass has already been measured to find nothing a fresh agent then found nine of. <!-- src: docs/adr/0708-mem-j-adversarial-pass-binds-to-the-shipping-slice.md -->

## The bigger loop

### The life of one lesson

A retro turns up a mistake worth not repeating. Its pattern, prevention and tags become one row, written to a scratch file the tool reads as bytes rather than passed as text on a command line, and checked against the log before it is appended. <!-- src: .claude/commands/arc-retro.md; .claude/scripts/memory/lesson-log.mjs -->

That check is lexical only, and says so on every run: it compares shared tags and a Jaccard score over normalized prevention text, never meaning. If the row shares at least two tags with an existing one and scores 0.5 or higher, the candidates are shown and nothing is auto-merged; the person writing the row decides whether to append anyway or amend what is already there. <!-- src: docs/adr/0705-mem-f-conflicts-are-caught-at-the-pen-not-auto-resolved.md; .claude/scripts/memory/conflict-check.mjs#jaccard -->

Once appended, the row is only as findable as the search is good, and the search is measured rather than assumed. Twelve fixed queries, each with a known expected id, are run every time; the Phase-00 grep oracle scored only five of the twelve with an expected id in its top 3, and the module has to beat that number in CI or the build fails -- a positive condition that can report the answer is simply not good enough, not only that no rule was broken. <!-- src: docs/adr/0706-mem-g-golden-set-gates-cited-rate-never-does.md; tests/fixtures/memory/golden-queries.tsv -->

Where a real query misses, the fix is one line in a hand-curated alias file, never a stemmer and never an embedding model -- and the file is honest about its own track record: a ten-row alias table was written once, one row per golden query, then removed, and nothing changed, because bm25 tag-weighted ranking already carried every one of those queries without it. A row goes in only for a golden query, or a real query someone actually ran, that misses the top 3 and whose miss is traceable to a single vocabulary gap; today the table is deliberately empty, because none of that first ten had earned its place. <!-- src: docs/adr/0709-mem-k-a-curated-alias-layer-fixes-vocabulary-mismatch.md; docs/memory/aliases.md -->

`/arc-retro` step 2 also gives a finding its permanent home; one such home is one line promoted into `CLAUDE.md` or an existing `.claude/rules/*.md` file. `rule-propose.mjs` automates that one step: it writes the rule onto a branch nobody's tree is checked out onto and raises an approval; a human merges it, or does not. <!-- src: .claude/commands/arc-retro.md; .claude/scripts/memory/rule-propose.mjs; processes/rule-promote.process.yaml -->

### How it connects to the rest of arc

memory requires exactly two other products, `core` and `hq`. Its read side -- the index, `arc-recall`, `diff-recall`, `golden-check` -- emits zero events to the spine, and adds no kind to arc's closed, 44-kind vocabulary. <!-- src: products/memory/manifest.json; docs/adr/0703-mem-d-reader-only-and-emit-nothing.md -->

Its two write-time doors are different: `lesson-log.mjs` ends on a `note.logged` receipt, and `rule-propose.mjs` ends on an `approval.requested` receipt. <!-- src: .claude/scripts/memory/lesson-log.mjs; .claude/scripts/memory/rule-propose.mjs -->

memory is built to work with no lanes at all: `lane` is provenance carried by a record that happens to have one, never a requirement, and filtering by `--lane` in a tree with no `initiatives/` directory returns a normal empty result rather than an error. <!-- src: docs/adr/0707-mem-i-root-mode-first-lane-is-only-provenance.md -->

Its face room, `memory`, sits in ring `kernel`. It is allowed to show three files -- `index.json`, `golden-queries.tsv`, `surfaced-cited.jsonl` -- through two stations, "golden queries" and "recall", and two concepts, "HISTORICAL DATA fence" and "golden gate (recall)". <!-- src: products/memory/manifest.json -->

The room's current build draws the retro log's own lessons through `/api/memory`; both the retro log and the trial ledger are also served as sources by path, hash and size. "Log a correction" and "Recall" are verb-pending cards. <!-- src: face/src/modules/kernel/memory/fold.mjs; face/src/modules/kernel/memory/View.tsx -->

## Glossary

| Term | Meaning |
|---|---|
| organ | One of the five places arc's lessons already live: the retro log, the trial ledger, the learning ledger, the ADRs, or the spine's decisions. <!-- src: docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md --> |
| index | The one derived, gitignored file memory writes; deletable and rebuildable at any time. <!-- src: .claude/scripts/memory/memory-index.mjs --> |
| doc-id | A stable id computed from a record's content position, such as `retro:2026-08-02#3` or `adr:0026`. <!-- src: docs/adr/0702-mem-c-verbatim-output-with-canonical-citations.md --> |
| count-verify | The build check that the number of records an adapter parsed equals the number it indexed. <!-- src: .claude/scripts/memory/memory-index.mjs#verify; docs/adr/0700-mem-a-index-in-place-no-new-rule-store.md --> |
| near-duplicate check | The write-time rule comparing shared tags and prevention-text overlap; it surfaces, never resolves. <!-- src: docs/adr/0705-mem-f-conflicts-are-caught-at-the-pen-not-auto-resolved.md --> |
| golden query set | Twelve fixed questions with known expected ids, run every time as the quality gate. <!-- src: docs/adr/0706-mem-g-golden-set-gates-cited-rate-never-does.md --> |
| surfaced-to-cited log | An observational file recording what recall surfaced; disqualified from ever gating or promoting anything. <!-- src: .claude/scripts/memory/lib/observe.mjs --> |
| alias | A hand-written, git-reviewed line expanding one search word into another, added only after a real query missed. <!-- src: docs/adr/0709-mem-k-a-curated-alias-layer-fixes-vocabulary-mismatch.md; docs/memory/aliases.md --> |
| HISTORICAL DATA fence | The literal banner wrapped around recalled text before it lands in another job's context. <!-- src: .claude/scripts/memory/diff-recall.mjs --> |
| session door | The one script behind a memory-room write verb: `lesson-log.mjs` for "Log a lesson", `rule-propose.mjs` for "Promote a rule" -- each verb's grant names only that script. <!-- src: .claude/scripts/memory/lesson-log.mjs; .claude/scripts/memory/rule-propose.mjs; tests/memory-session-probe.mjs --> |
| root-mode | Running with no `initiatives/` directory; memory treats `lane` as optional provenance rather than a requirement. <!-- src: docs/adr/0707-mem-i-root-mode-first-lane-is-only-provenance.md --> |
