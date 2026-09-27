<!-- facts: agents=4f53cda1 commands=4e24a542 docs=4f53cda1 faceRing=0cfa9728 faceRoom=c97bc4ad files=4f53cda1 requires=8ba3b34a scripts=30a62542 version=8e633b4f -->

## In plain words

Picture a small company whose staff are AI models. Every so often a rival team does something clearly better, and instead of poaching their whole workshop, the company sends someone to study it, write down exactly what they saw and where, and bring back only an idea that can be rebuilt inside the company's own walls for someone else to approve. <!-- plain -->

absorb is arc's technique refinery: one command, `/arc-absorb`, studies an outside agent or tool read-only and writes a classified extraction report; only for a technique classified for rebuild does a proposed arc-native rebuild land, confined to a fixed allowlist of folders. Rebuild, A/B and adoption are separate steps, in that order -- testing that rebuild against the old way and asking the owner for a blind decision are carried by separate tooling, before anything is marked adopted. <!-- src: .claude/commands/arc-absorb.md; docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; docs/adr/0603-owner-judge-receipt-grammar-is-a-sealed-blind-payload-profile.md; docs/adr/0605-absorb-ab-tests-run-bench-style-not-through-evolve.md -->

Studied code never executes, and this command is propose-only -- nothing is adopted by running it. <!-- src: .claude/commands/arc-absorb.md -->

### Why this needs to be a product at all

If a company only ever trusted its own workshop, a genuinely better idea sitting inside a rival's would simply stay there -- unused, uncredited, and eventually reinvented badly by someone who never saw the original. <!-- plain -->

absorb exists so a technique observed anywhere can become native arc capability, so the market's best ideas compound into arc without runtime dependencies, supply-chain risk, or license contamination. <!-- src: initiatives/absorb/PLAN.md -->

| What is lost | What it looks like | absorb's answer |
|---|---|---|
| Copying an incompatible-licensed implementation | arc inherits license contamination and supply-chain risk | A rebuild lands only inside a fixed allowlist, adds zero new runtime dependencies (checked by parsing the diff for every import form, not by searching for a keyword), and an incompatible license ends the technique as a refusal recorded in the registry with its reason, never a rebuild <!-- src: initiatives/absorb/PLAN.md; docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; .claude/scripts/absorb/rebuild-lint.mjs; docs/adr/0601-extraction-report-is-a-fixed-lint-checkable-template.md --> |
| A studied source turns hostile | A README can carry a terminator line trying to close its own envelope and smuggle text into the instruction region | Studied bytes never execute, and every read arrives sealed inside a per-read random-nonce envelope that the content itself cannot forge closed <!-- src: .claude/scripts/absorb/study.mjs; .claude/commands/arc-absorb.md --> |
| A technique could adopt itself | A registry row moves to `adopted` or `retired` with no accountable decision behind it | Adoption and retirement each end as an inbox item with a reason; no self-adoption code path exists, and the harness offers no path that writes those two statuses directly <!-- src: initiatives/absorb/PLAN.md; .claude/scripts/absorb/registry-ref.mjs --> |

That first row is enforced by parsing rather than by searching: the dependency check parses every import form -- static, dynamic, and a specifier built by concatenation -- because a keyword search once missed exactly this shape in arc-evolve's propose-only guard and a mutant module walked straight past it. <!-- src: .claude/scripts/absorb/rebuild-lint.mjs -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| technique | a reusable idea, not a whole tool | Something arc can re-express as an edit to its own files; an installable artifact is a different question, and routes to develop instead. <!-- src: docs/adr/0604-absorb-boundary-rulings-recorded-so-nobody-relitigates.md --> |
| extraction report | the write-up instead of the source | Five required headings the owner reads in place of opening the studied source itself; a script checks that a citation, a verdict, and a license note are actually present on every row. <!-- src: docs/adr/0601-extraction-report-is-a-fixed-lint-checkable-template.md --> |
| the allowlist | the only rooms a rebuild may enter | A fixed list of four: `processes/**` (excluding three pilot process files that serve as engine's own compiler-fidelity evidence), `docs/playbooks/**`, `.claude/commands/**` (command bodies), and `tests/**` (fixtures that accompany a rebuild). Widening it is an amendment, never a convenience edit made mid-rebuild. <!-- src: docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; products/absorb/allowlist.txt --> |
| registry | the one ledger | `products/absorb/registry.json`, one file holding every technique's row, lane-scoped, never forked per lane. <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md --> |
| PLANOFF | the bake-off | The old-way-versus-absorbed-way test layout -- a protocol, a results table, and an append-only ledger -- run on at least three representative fixtures. <!-- src: docs/adr/0605-absorb-ab-tests-run-bench-style-not-through-evolve.md --> |
| sealed blind judgement | a taste test with the labels swapped for randomized code-names | The owner picks between at least two options shown only under randomized labels drawn from a fixed pool of words chosen to carry no information about what they label; which label meant which option is committed to by a sha256 hash before the pick, and revealed only after a decision is recorded. <!-- src: docs/adr/0603-owner-judge-receipt-grammar-is-a-sealed-blind-payload-profile.md; .claude/scripts/absorb/judgement.mjs; .claude/scripts/hq/lib/validate-absorb.mjs --> |
| correlation | the id that ties a judgement to its run | An id tying one sealed judgement's commitment and its evidence bundle to that run; a decision can only reveal the mapping if it names this same correlation. <!-- src: .claude/scripts/absorb/judgement.mjs; .claude/scripts/hq/lib/validate-absorb.mjs --> |
| T-NN id | the id a warning calls it by | The zero-padded id a technique gets the moment it is written into a report's inventory; ids are unique inside one report. <!-- src: .claude/scripts/absorb/report-lint.mjs; .claude/commands/arc-absorb.md --> |
| lock_ref | a pointer, never a copy | The exact shape `{name, version}` inside a registry row, pointing at one row in develop's own `capability-lock.json`; a row carrying its own hash or provenance field is a lint failure. <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md; .claude/scripts/absorb/registry-ref.mjs --> |
| cap and displacement | the shelf limit | A ceiling of twelve adopted rows per lane; the next adoption at the cap must name which retired row it displaces, and a displacement pointing at a row that is not actually retired frees no slot. <!-- src: .claude/scripts/absorb/registry-ref.mjs#judgeRegistry --> |

## How a job flows

Adoption claims are evidence, not vibes: the results table travels with the adoption proposal, and a proposal without its table is lint-invalid. <!-- src: initiatives/absorb/PLAN.md -->

| Stage | What happens | What can stop it here |
|---|---|---|
| Pin and study | The source is fetched and pinned, then read through a confined, read-only harness | A path that escapes the study root, an oversized file, or a hardlinked file is refused or quarantined before it is ever treated as text <!-- src: .claude/scripts/absorb/study.mjs; .claude/commands/arc-absorb.md --> |
| Classify | One inventory row per technique, each with a citation | A row with no citation, or a verdict outside the four buckets, is a lint warning <!-- src: .claude/scripts/absorb/report-lint.mjs; docs/adr/0601-extraction-report-is-a-fixed-lint-checkable-template.md --> |
| Register | A candidate row lands in the registry | This command never writes adopted or retired directly <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md; .claude/commands/arc-absorb.md --> |
| Rebuild | A diff confined to the allowlist | A path outside it, a new runtime dependency, or a missing attribution comment is a lint warning <!-- src: .claude/scripts/absorb/rebuild-lint.mjs --> |
| Test | The old rule and the new rule run over the same fixtures | A fixture whose own quote does not match its own subject text is a fatal error, not a warning <!-- src: .claude/scripts/absorb/ab-run.mjs --> |
| Judge | The owner picks one of several blind labels | Revealing the mapping before a real decision exists on the spine is refused <!-- src: .claude/scripts/absorb/judgement.mjs --> |
| Decide | A `decision.recorded` event lands through the inbox | A row moving to adopted or retired with no matching `decision.recorded` reference is a lint warning, and no code path here writes those statuses directly <!-- src: docs/adr/0603-owner-judge-receipt-grammar-is-a-sealed-blind-payload-profile.md; .claude/scripts/absorb/registry-ref.mjs; initiatives/absorb/PLAN.md --> |

## The stages, one by one

1. **Resolve the lane, then pin the source.** The command resolves the lane and echoes `Selected lane:` before anything else; the source is then pinned before it is read -- a commit hash for a local clone, or a URL plus a retrieval date otherwise -- because a source with no pin is not a source, and the fetch happens before study begins. <!-- src: .claude/commands/arc-absorb.md -->
2. **Read the license, by reading it.** Not assumed from the ecosystem: what was actually found, and where, is recorded. An incompatible license ends the technique as a refusal logged in the registry with its reason, never a rebuild. <!-- src: .claude/commands/arc-absorb.md -->
3. **Scaffold the report from a confined walk.** `study.mjs --scaffold` walks the source root once, derives the Source and Study-scope sections from what it actually found, and refuses to write anything without both a pin and a license. <!-- src: .claude/scripts/absorb/study.mjs; .claude/commands/arc-absorb.md -->
4. **Inventory, then read only what the question needs.** `--inventory` lists every readable file the walk found; `--read` returns one file sealed inside a random-nonce envelope declaring it data, never instructions -- a large source can be read in a line-numbered slice instead of whole, and the envelope still names the slice while keeping the whole file's hash. A path escaping the root by traversal, by a symlink, or by a case mismatch that only resolves on one operating system is refused before it is opened. <!-- src: .claude/scripts/absorb/study.mjs#confine; .claude/scripts/absorb/study.mjs#envelope -->
5. **Fill one technique row per idea found, and classify it.** Every row needs a citation as `file:line` or a transcript reference, and one verdict from exactly four buckets: a technique arc can re-express inside the allowlist, an installable artifact that routes to develop instead, a model-quality question that routes to the router, or something not worth the time already spent. <!-- src: .claude/commands/arc-absorb.md; docs/adr/0604-absorb-boundary-rulings-recorded-so-nobody-relitigates.md -->
6. **Lint the report.** `report-lint.mjs` checks the five required headings, in order, and that every row carries its citation, its verdict, and its license note; it warns rather than blocks while the lint is new, so the warnings themselves have to be read rather than the exit code. <!-- src: .claude/scripts/absorb/report-lint.mjs; .claude/scripts/absorb/report-lint.mjs#guessable -->
7. **Register the candidate; propose nothing yet.** A studied technique becomes a candidate row in the registry. This command never writes an adopted or retired status -- those require a decision recorded through the owner's inbox, and no code path here writes them. <!-- src: .claude/commands/arc-absorb.md -->
8. **On a rebuild verdict, lint the rebuild before proposing it.** `rebuild-lint.mjs` checks every touched path against the allowlist, parses the diff for every import form rather than searching for a keyword, and checks that a permissive-license rebuild names its source in every file it touches; `registry-ref.mjs` checks the row's status lifecycle, the cap, and that nothing in it copies develop's lock data. <!-- src: .claude/scripts/absorb/rebuild-lint.mjs#IMPORT_FORMS; .claude/scripts/absorb/registry-ref.mjs#judgeRegistry; initiatives/absorb/PLAN.md; .claude/commands/arc-absorb.md -->
9. **Receipt.** Evidence is emitted through arc's existing spine event kinds only -- absorb adds none of its own. <!-- src: .claude/commands/arc-absorb.md; initiatives/absorb/PLAN.md -->

The command's own steps end there, at a registered candidate or a proposed rebuild diff. Testing the rebuilt rule against the old rule over the same fixtures, and asking the owner to judge the two blind, are the loop's next stages, carried by the separate tooling described below. <!-- src: .claude/commands/arc-absorb.md; .claude/scripts/absorb/ab-run.mjs; .claude/scripts/absorb/judgement.mjs -->

## Every part, explained

### Commands

absorb owns one command, `/arc-absorb`: study the source named in its argument and produce an extraction report. Its allowed tools are `study.mjs`, `report-lint.mjs`, `registry-ref.mjs`, `rebuild-lint.mjs`, the lane resolver (`lane-resolve.sh`), `arc-event.sh`, `git log`, `git diff`, and reading and writing files. <!-- src: .claude/commands/arc-absorb.md; products/absorb/manifest.json -->

### Agents

absorb defines no agent of its own -- its manifest's agent list is empty. The one technique this lane has actually landed is enforced by forwarding a plain-language instruction into another product's agent, `security-auditor`, called from `/arc-audit` -- a prompt-level instruction rather than a gate, because that agent's own definition sits outside absorb's rebuild allowlist. <!-- src: products/absorb/manifest.json; docs/playbooks/finding-verification.md; docs/adr/0602-rebuild-lands-only-on-an-allowlist.md -->

### Processes

`/arc-absorb` is a hand-written command body: it carries none of the "GENERATED FILE -- DO NOT EDIT" markers that mark a command compiled from a `processes/*.process.yaml` file, the way `/arc-commit` does. <!-- src: .claude/commands/arc-absorb.md; .claude/commands/arc-commit.md -->

### Scripts

- **The study harness.** `study.mjs` is the only path through which a studied byte may reach the agent -- arc-absorb.md forbids reading a studied file with the agent's own Read tool, so every byte instead arrives through `study.mjs --read`. It confines every path to the study root, refuses traversal and symlink escapes, quarantines oversized or multiply-linked files, and seals what it reads inside a nonce-stamped envelope whose nonce is random per read; its scaffold mode writes the report's derived sections. <!-- src: .claude/scripts/absorb/study.mjs; .claude/scripts/absorb/study.mjs#classify; .claude/scripts/absorb/study.mjs#envelope; .claude/commands/arc-absorb.md -->
- **The report and rebuild lints.** `report-lint.mjs` checks a finished extraction report against ADR-0601's fixed, lint-checkable template; `rebuild-lint.mjs` checks a finished rebuild against the allowlist, the zero-new-dependency rule, and the attribution rule -- both warning rather than blocking while the lints are new. <!-- src: .claude/scripts/absorb/report-lint.mjs; docs/adr/0601-extraction-report-is-a-fixed-lint-checkable-template.md; .claude/scripts/absorb/rebuild-lint.mjs -->
- **The sealed blind A/B.** `ab-run.mjs` computes the old-rule-versus-new-rule metrics a protocol fixed in advance, and can render either rule's report for a blind reader; `judgement.mjs` seals the labels, reveals the mapping only after a real decision exists on the spine, and can independently verify a seal still matches its own commitment. <!-- src: .claude/scripts/absorb/ab-run.mjs; .claude/scripts/absorb/judgement.mjs -->
- **The proposal-branch front doors.** `pin.mjs` and `trial.mjs` turn a scaffold or a seal into a reviewed diff: each writes only to a new branch through git plumbing, never checking anything out, then raises its own `approval.requested`, judged by the spine before anything is written. <!-- src: .claude/scripts/absorb/pin.mjs; .claude/scripts/absorb/trial.mjs; docs/adr/1340-fv2-kernel-ring-effects-proposal-branches-and-evolve-wiring.md -->

### Gates and rules

- **The allowlist itself.** Rebuilds may land only on `processes/**` (minus three pilot files reserved as engine's own compiler-fidelity proof), `docs/playbooks/**`, `.claude/commands/**`, and their accompanying `tests/**` fixtures -- nowhere else, and widening the list is an amendment to the ADR, never a convenience edit made mid-rebuild. <!-- src: docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; products/absorb/allowlist.txt -->
- **The no-execution boundary, fixture-proven.** `absorb-study-boundary.bats` proves studied code never executes with three mutants, one per banned verb, plus a positive control proving the sentinels fire when actually run, and separately constructs the symlink and oversized-file attacks that the committed corpus deliberately leaves out; `absorb-hostile.bats` drives that committed corpus of six attack families through the same harness. <!-- src: tests/absorb-study-boundary.bats; tests/absorb-hostile.bats; tests/fixtures/absorb/hostile/INDEX -->
- **The sealed blind payload, checked at the spine.** A judgement request's shape is closed to `subject` plus six named fields -- `candidate`, `fixtures`, `labels`, `commitment`, `evidence_path`, `correlation` -- and any other key is refused; its blind labels are drawn only from a fixed pool of words chosen to carry no information about which option they name; a subject differing only by case or whitespace is refused rather than treated as the real thing. <!-- src: .claude/scripts/hq/lib/validate-absorb.mjs#assertAbJudgement; .claude/scripts/hq/lib/validate-absorb.mjs#assertNotNearMiss; .claude/scripts/hq/lib/validate-absorb.mjs#REQUIRED -->
- **Nothing adopts itself.** A registry row moving to adopted or retired without a `decision.recorded` reference is a lint warning, and the harness offers no code path that writes those two statuses on its own. <!-- src: .claude/scripts/absorb/registry-ref.mjs; initiatives/absorb/PLAN.md -->

## The bigger loop

### The life of T-01, arc's first absorbed technique

Studying a rival is cheap. Deciding whether what was found is worth keeping, then actually building it inside your own walls, is the expensive part. <!-- plain -->

This is the one technique absorb has actually taken all the way through the loop, from a first study to an adopted registry row. <!-- src: products/absorb/registry.json -->

On 2026-07-12, a benchmark recorded arc taking the best overall score among several planning tools and still missing the one real defect a malformed input produced: a malformed percent-escape that produced a 500, which only a rival's post-build review pass caught. <!-- src: docs/adr/0606-abs-g-century-code-home-empty-seed-and-first-target.md -->

That gap became absorb's first named target: study the rival's post-build review pass and see whether arc could re-express whatever let it catch that one defect. <!-- src: docs/adr/0606-abs-g-century-code-home-empty-seed-and-first-target.md -->

The study read the rival's review skill file, pinned by its sha256 hash, and found no LICENSE, LICENCE, or COPYING file in the study root or above it, and no license header in the file itself -- so the only lawful route was to re-express the idea in arc's own words rather than copy any of it. <!-- src: products/absorb/registry.json -->

The technique -- verify a finding's citation before writing it down, or route it to an appendix instead -- got the extraction report's ABSORB verdict, re-expressible as a requirement on arc's own review surface. The first rebuild attempt landed on one of the three process files engine keeps as its own compiler-fidelity proof, and it turned CI red on seven of nineteen jobs; the owner then ruled the allowlist would not be widened to let the technique through some other way either. <!-- src: initiatives/absorb/evidence/phase-04/extraction-report.md; docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; docs/playbooks/finding-verification.md -->

A second rebuild took a route the same ADR had already called legitimate: a playbook under the allowlisted `docs/playbooks/**`, wired to exactly one caller, `/arc-audit`, so the rule would not sit unused. <!-- src: docs/adr/0602-rebuild-lands-only-on-an-allowlist.md; docs/playbooks/finding-verification.md -->

Tested against three fixtures and 22 candidate findings, built by an agent held blind to the rebuild, the rebuilt rule removed all of the findings whose citation did not resolve, cost six true findings a demotion to an appendix, and moved the main report's precision from 63.6% to 61.5% because six of the nine demoted findings were true. <!-- src: docs/playbooks/finding-verification.md -->

The owner then judged the two reports blind, without knowing which was which, and picked the older report; a second, separate decision then adopted the technique anyway, overruling the retire recommendation that first pick implied -- and the record kept both receipts rather than letting the second overwrite the first. <!-- src: docs/playbooks/finding-verification.md; products/absorb/registry.json -->

The registry now records it: one row, `T-01`, status adopted, review_by 2026-11-09. <!-- src: products/absorb/registry.json -->

### How it connects to the rest of arc

absorb requires exactly two other products, `core` and `hq`. <!-- src: products/absorb/manifest.json -->

Four boundary rulings keep absorb from colliding with its nearest neighbours: an installable artifact is develop's territory and a technique expressed as an edit to arc's own files is absorb's; bench scores and absorb produces, so absorb never scores itself; discover mines ventures where absorb mines techniques, with no overlap to arbitrate; and evolve owns promotion machinery that absorb's tests deliberately do not use, so evolve's first-client seat stays with growth rather than being spent here. <!-- src: docs/adr/0604-absorb-boundary-rulings-recorded-so-nobody-relitigates.md; docs/adr/0605-absorb-ab-tests-run-bench-style-not-through-evolve.md -->

A registry row references develop's `capability-lock.json` by name and version rather than copying its hash or provenance data, so the one ledger for pinned, installed things stays in one place. <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md; .claude/scripts/absorb/registry-ref.mjs -->

absorb's sealed blind judgement shares its spine kind with every other approval in arc rather than inventing a new one: it is a strict payload profile on the same `approval.requested` and `decision.recorded` kinds the rest of arc already uses. <!-- src: docs/adr/0603-owner-judge-receipt-grammar-is-a-sealed-blind-payload-profile.md -->

Its face room sits in the kernel ring alongside engine's, and two of its tools, `pin.mjs` and `trial.mjs`, write only to a new branch through git plumbing -- never a checkout -- so neither tool can ever move the owner's own working tree. <!-- src: products/absorb/manifest.json; products/engine/manifest.json; docs/adr/1340-fv2-kernel-ring-effects-proposal-branches-and-evolve-wiring.md; .claude/scripts/absorb/pin.mjs; .claude/scripts/absorb/trial.mjs -->

## Glossary

| Term | Meaning |
|---|---|
| technique | An idea re-expressible as an edit to arc's own files, not a whole tool to install. <!-- src: docs/adr/0604-absorb-boundary-rulings-recorded-so-nobody-relitigates.md --> |
| extraction report | The write-up the owner reads instead of opening the source itself, one row per technique with its own citation. <!-- src: docs/adr/0601-extraction-report-is-a-fixed-lint-checkable-template.md --> |
| allowlist | The fixed list of folders a rebuild may land on; widening it is an ADR amendment, never a convenience edit. <!-- src: docs/adr/0602-rebuild-lands-only-on-an-allowlist.md --> |
| registry | The one file recording every technique absorb has looked at, whether candidate, trial, adopted, or retired. <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md --> |
| PLANOFF | The old-way-versus-absorbed-way test layout: a protocol, a results table, and an append-only ledger. <!-- src: docs/adr/0605-absorb-ab-tests-run-bench-style-not-through-evolve.md --> |
| sealed blind judgement | A decision where the two options carry made-up labels, and which label meant which stays hidden until after the decision is recorded. <!-- src: docs/adr/0603-owner-judge-receipt-grammar-is-a-sealed-blind-payload-profile.md --> |
| correlation | The id that ties one sealed judgement to its run; a decision can only reveal that judgement's mapping if it names this same correlation. <!-- src: .claude/scripts/hq/lib/validate-absorb.mjs; .claude/scripts/absorb/judgement.mjs --> |
| T-NN id | The zero-padded id a technique's row gets when it is entered in the report's inventory, unique within one report. <!-- src: .claude/scripts/absorb/report-lint.mjs; .claude/commands/arc-absorb.md --> |
| lock_ref | A registry row's pointer at develop's own `capability-lock.json` entry, by name and version only -- never a copy of its hash or provenance. <!-- src: docs/adr/0600-absorb-registry-is-one-lane-owned-json-file.md; .claude/scripts/absorb/registry-ref.mjs --> |
| cap and displacement | The ceiling of adopted techniques per lane, and the rule that the next adoption at the cap must name what it retires. <!-- src: .claude/scripts/absorb/registry-ref.mjs#judgeRegistry --> |
