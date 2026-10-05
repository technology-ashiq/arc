# Phase 00 — Birth PR, the ruling on the spine, and the audit memo

**Goal (one line):** the `discover` product exists on merged main (policy row, manifest, face room, golden, wiki, ADRs), the lane's ruling sits on the canonical spine as an owner-stamped decision, and the market-agent audit memo is written, so Phase 01 builds on a governed, visible product.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** none
**REQs closed here:** REQ-10
**Why it lands alone and first (attack B1):** the ruling and every later receipt are emitted from the MAIN clone with `--process discover`, which needs the `process:discover` policy row on merged main, and the birth rows touch shared files that live lanes edit.

## Two deliveries

- **PR A — the birth PR** (branch `feat/discover-birth` off fresh `origin/main`): kickoff files (PLAN, PROGRESS, 4 specs, ADR-1900..1912, `fixed-defects.md`), steps 1–4 below, `tests/discover-birth.bats`.
- **PR B — the close PR** (branch `feat/discover-p00-close`, after PR A merges): the receipt ids written into ADR-1900 and `PROGRESS.md`, the evidence bundle, the audit memo, and the `/arc-phase-done 00` tracker edits, all in one commit.

## Scope (in order)

1. **Cross-lane ask (ADR-1911).** Write `initiatives/discover/handoffs/growth-hn-fields.md`, a paste-ready `/arc-change --lane growth` prompt: keep `points · num_comments · created_at_i · story_text` on each candidate when present, additive only, existing consumers unchanged, plus one growth bats arm. The owner pastes it into growth's session. Detecting the merge: `git log origin/main --oneline -- .claude/scripts/growth/lib/adapters.mjs` shows a commit after 2026-10-06 whose diff adds those keys. Deadline is Phase 01 day 1 (A-02).
2. **Century claim + board rows** (`git log origin/main --oneline -5 -- PORTFOLIO.md` first). Re-sweep: `git worktree list --porcelain` → `ls {each}/docs/adr | grep '^19'`, and `git for-each-ref refs/remotes/origin` → `git ls-tree --name-only {ref} docs/adr/ | grep 'adr/19'`; any hit → STOP. Then in `PORTFOLIO.md`: replace the band row `| 1900–1999 | next lane to be born |` with `| 1900–1999 | `discover` — claimed at birth, 2026-10-06 (**1900–1912 taken**); claim swept 17 worktrees and every origin branch — none held an ADR ≥1900 |`, and add `| 2000–2099 | next lane to be born |`. Add the lane row under the board header `| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |` as `| discover | LIVE | arc-discover (Cycle 1, opened 2026-10-06) | 00 | 8d / 0d | — | **Next: Phase 00 birth PR** |`, with the values copied from `initiatives/discover/PROGRESS.md`'s header (`portfolio-board.bats` asserts they agree).
3. **Birth rows (venture-scope lane, ADR-1909).** *Amended at build 2026-10-06: no `hq.policy.yaml` row (ADR-1913 supersedes the policy bullet below) and the product maps to the generic `lane` room, with the face section written by `face-sections.mjs` (ADR-1914 supersedes the manifest face values below); the committed `tests/discover-birth.bats` (7 tests) replaces the 6-test list in the Verification plan.* Run `git log origin/main --oneline -5 -- {path}` on each path first.
   - `hq.policy.yaml`: add under the process rows, copying the shape of `"process:attack-diff":` (line ~203):
     ```
     "process:discover":
       e2: []
       read: { level: L3 }
       write: { level: L1 }
       shell: { level: L0 }
       network: { level: L1 }
       message: { level: L0 }
       publish: { level: L0 }
       deploy: { level: L0 }
       spend: { level: L0 }
     ```
     A comment above it cites ADR-1904/1906: network L1 = public HN reads, write L1 = `--out` + `products/launch/ventures/`, spend L0 until REQ-07's owner OK.
   - `products/discover/manifest.json`: copy `products/org/manifest.json`'s key set (`name · version · requires · commands · agents · scripts · files · docs · face`) with `name: "discover"`, `version: "0.1.0"`, `requires: ["core","hq","council","growth","launch"]`, `commands: [".claude/commands/arc-hunt.md"]`, `scripts: [".claude/scripts/discover/arc-discover.mjs"]`, the others `[]`, and `face: {"room":"discover","ring":"money","kinds":["idea.captured","council.verdict","approval.requested","decision.recorded","run.completed"],"sanctioned":[],"stations":["hunt","miner","normalize","dedupe/cluster","score.yaml","council","approval (stamp)","venture.yaml"],"concepts":[]}`. `stations` takes over `planned-rooms.json`'s `line`, with "one-pager" replaced by "venture.yaml" (ADR-1905).
   - `.claude/scripts/core/arc-products.mjs:182`: add `"discover"` to `CATALOG` in alphabetical position.
   - `initiatives/face/contracts/planned-rooms.json`: delete the object whose `room` is `"discover"`. Check the edited file with `node -e "import('./.claude/scripts/core/json-strict.mjs').then(m=>m.parseStrict ? m.parseStrict(require('fs').readFileSync(process.argv[1],'utf8'),'planned-rooms') : console.log(Object.keys(m)))" initiatives/face/contracts/planned-rooms.json` (read the module's export name from the first run if it differs), and do the same for `expected-set.json` if face-sections touches it.
   - `.claude/scripts/discover/arc-discover.mjs`: a stub only, with a realpath-both-sides main guard. Every verb prints `not built yet — Phase 01` to stderr and sets `process.exitCode = 2`.
   - `.claude/commands/arc-hunt.md`: a hand-written command doc (not one of the three compiled ones) whose body runs `node .claude/scripts/discover/arc-discover.mjs hunt "$ARGUMENTS"`.
   - Generators, in this order, in ONE commit after `git fetch && git merge origin/main`: `node .claude/scripts/core/face-sections.mjs` (commit `initiatives/face/contracts/rooms.generated.json`) → the sync golden: `bash sync-to-project.sh {scratch target}` then `_arc_tree_manifest {scratch target} > tests/fixtures/sync-golden/tree-manifest.txt` (the same two calls as `tests/sync.bats:141-142`; `_arc_tree_manifest` comes from that suite's helper), run with untracked files absent from the source (`git ls-files --others --exclude-standard` must list nothing under synced paths; the `.claude/.headroom_wrap_*` files are moved to the scratchpad and back), and `git diff tests/fixtures/sync-golden/tree-manifest.txt` showing only `discover` lines → `node .claude/scripts/core/product-lint.mjs` → `node .claude/scripts/docs/wiki-build.mjs` LAST, then `node .claude/scripts/docs/wiki-build.mjs --check`. A conflict on any generated file is resolved by re-running its generator, never by hand.
4. **`initiatives/discover/fixed-defects.md` seeded** with the imported classes, each a checkable line to test in every discover file: (a) a realpath-both-sides main guard in `arc-discover.mjs` and every CLI-shaped file; (b) no `process.exit()` after a fetch (set `exitCode`, then drain); (c) a flag with a missing or empty value is refused and never consumes the next flag (`--out`, `--offline-fixture`); (d) one confinement function for the `--offline-fixture`/`--out` paths, and no other `resolve()` on external data; (e) section regexes anchored, no `$` under `/m`; (f) hostile fixture text lives in files, never in a shell string or a bats test name (ASCII-only names; each bats file asserts its own test COUNT); (g) a scan that cannot read its input reports `COULD NOT SCAN`, never an empty result. In Phase 00, only (a), (b) and (c) have code (the stub) and are checked by the attack. (d)–(g) are carried to Phase 01.
5. **`/arc-attack`** on the local commit of PR A (two surfaces, `fixed-defects.md` in the prompt); fix highs and mediums, and put lows in `initiatives/discover/debt-ledger.md` (created on the first low). Push PR A once, then run a background `node .claude/scripts/review/ci-digest.mjs` loop (exit 3 = pending, 120 s), and merge on per-JOB green with the head SHA asserted.
6. **After PR A merges, from the MAIN clone (`git pull` first):**
   - The emit interface: `node .claude/scripts/hq/arc-event.mjs emit approval.requested --payload-file {path} --process discover`. The kind is the positional after `emit`, and the receipt ULID is printed on stdout. The canonical spine is the main clone's `.claude/state/hq/`, with events in `events/{YYYY-MM-DD}.jsonl` and quarantine in `events/_quarantine/` (`spine-io.mjs:141-142`). "Found by id" means `grep -l {ULID} .claude/state/hq/events/*.jsonl` hits a dated file, and `ls .claude/state/hq/events/_quarantine/` shows no file containing the ULID or `process":"discover`.
   - The ruling. `decision.recorded` is closed to `decides · verdict · reason`, and `decides` must be the ULID of an `approval.requested` (`validate.mjs` `assertDecision`), so the ruling is two receipts. (i) Emit `approval.requested` with `--payload-file {ruling.json written with the Write tool} --process discover`, whose payload is `{"what": "ADR-1900: the discover lane is born to feed launch — owner ruling 2026-10-03 (no venture idea, no Nilluvai), fired early 2026-10-06 by the owner's kickoff paste", "gate": "lane-birth"}`. The payload is exactly `what` + `gate`, the two fields launch's `approval.requested` at `runner.mjs:188` starts with. If `arc-event` refuses it, the printed `SpineError` code is the contract: record it in the evidence bundle and STOP; do not iterate field names. (ii) The owner stamps `node .claude/scripts/hq/arc-inbox.mjs approve {ULID} --reason "discover lane born 2026-10-06"`, which writes the `decision.recorded`. Both ids are found in `events/` and `_quarantine/` is listed.
   - The audit memo (ADR-1908). If the owner gave the path, write `initiatives/discover/evidence/phase-00/market-agent-audit.md` with these sections: *Location & version · What it scores · Signals it reads · Weights / formula · License & deps · Portable to discover? (port / rebuild, per signal) · Recommendation*. **If it already covers scoring → propose port-not-duplicate and STOP for the owner's call before Phase 02.** If the owner has not given the path by the time PR A merges, write the memo as `NOT LOCATABLE` and list the searched paths (copied from PLAN's Current state). Do not wait (A-01).
   - PR B (see "Two deliveries"), then `/arc-phase-done 00` from the main clone.

## Exit criteria (Definition of Done)

- [ ] REQ-10: `face-coverage`, `wiki-coverage`, `product-lint`, `portfolio-board`, `sync` and `discover-birth` green on CI for PR A, read per JOB via `ci-digest.mjs` with the head SHA asserted
- [ ] the ruling's `approval.requested` and the owner's `decision.recorded` found by id in `events/` (not `_quarantine/`), with `_quarantine/` listed and showing no discover record
- [ ] audit memo committed (findings or `NOT LOCATABLE`); if it found scoring, the owner's port-vs-build ruling is recorded as a `decision.recorded`
- [ ] PR B merged; closed through `/arc-phase-done 00` from the MAIN clone; lane header + PORTFOLIO row in the same commit

## Verification plan

- **Test command:** CI bats `tests/discover-birth.bats` plus the existing `tests/face-coverage.bats`, `tests/portfolio-board.bats`, `tests/sync.bats`, and the `wiki-coverage`/`product-lint` jobs (never run on this box). `discover-birth.bats` has 6 tests and asserts its own count:
  1. "the discover room is solid, not planned": parse `initiatives/face/contracts/planned-rooms.json`, and no entry has `room == "discover"`.
  2. "the manifest carries the money/discover face": `products/discover/manifest.json` has `face.room == "discover"` and `face.ring == "money"`.
  3. "process:discover is governed": `hq.policy.yaml` contains the line `"process:discover":` and `spend: { level: L0 }` within its block.
  4. "discover is in the CATALOG": `.claude/scripts/core/arc-products.mjs` lists `"discover"`.
  5. "the stub refuses": `node .claude/scripts/discover/arc-discover.mjs hunt x` exits 2, and stderr contains `not built yet`.
  6. "band 1900 is discover's": the `PORTFOLIO.md` band row for `1900–1999` names `discover`.
- **Expected failure first:** written before the rows. Test 1 fails with `discover still listed in planned-rooms.json` and test 3 with `no process:discover row`, because neither change exists yet. Red-first is evidenced by **commit order plus a mutant arm, not by a throwaway push**. The red test is its own commit, ahead of the rows. In the same file, tests 1 and 3 each carry a negative arm that runs the same assertion against a temp copy with the row restored or removed, and asserts it FAILS with the named message. So the one CI run of PR A proves both directions (push-once rule kept).
- **Live demo scenario:** after the merge, from the main clone: `node .claude/scripts/core/face-coverage.mjs` lists `money/discover` with no planned marker; `/arc-hunt x` prints `not built yet — Phase 01` and exits 2; `node .claude/scripts/hq/arc-inbox.mjs inbox` shows the ruling request until the owner stamps it.
- **Real-system check:** both receipts are in the canonical spine's `events/` for today's date, not in `_quarantine/`.
- **Expected evidence:** `initiatives/discover/evidence/phase-00/` holds the two receipt ids, the quarantine listing, the audit memo, and PR A's CI run id with per-job conclusions.

## Rabbit holes in this phase

- Building any miner code "while the PR is open": Phase 01 waits for the merge.
- Hand-merging a generated file after a conflict: re-run the generator.

## Out of scope for this phase

- miner, normalizer, clusterer, scorer, exporter (the CLI is a stub)

## Your-setup / pending

- Owner at phase open: the `saas-market-analysis-agent` path · pasting `initiatives/discover/handoffs/growth-hn-fields.md` into growth's session · naming the REQ-07 niche.
- Owner after PR A merges: one `arc-inbox approve` keystroke for the ruling.
- Soft dependencies (not phase deps): growth's merge (A-02 fallback), the agent path (A-01).

## Non-negotiables (verbatim from PLAN)

- Miner, normalizer, clusterer and exporter are parser-class: hostile web text must never reach a shell, an eval or the yaml, proven by injection fixtures in BOTH the clusterer and the exporter (twin-fix rule).
- The `venture.yaml` is written by a serializer, never string-built, and carries exactly the LAU-J fields (ADR-1905).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/discover/fixed-defects.md`; the author is never the attacker.
- Deterministic pipeline: the same snapshot gives identical clusters, scores, order and yaml bytes on all 3 OS legs against a committed golden hash; no float, locale sort, CRLF, wall-clock or absolute path in any hashed output.
- Evidence links are preserved end to end: a score without clickable sources is invalid, and a `venture.yaml` without a linked `.hunt.md` is invalid.
- Zero new spine kinds and no edit to any council payload; reads go through the spine reader only (ADR-1906, ADR-1910).
- growth's adapter and launch's contract are imported, never copied or edited (ADR-1901, ADR-1912).
- Zero npm deps; central `tests/`; tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
- Model tiers are named by ADR-0069 tier names; no quiet `model:` edits.
