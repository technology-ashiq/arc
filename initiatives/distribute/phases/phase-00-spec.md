# Phase 00 — Birth PR, the matrix, the local lies resolved, the claude-code golden declared, and the live OpenCode spike

**Goal (one line):** the `distribute` lane exists on merged main with its band, ADRs and a dated four-row capability
matrix; the main clone's untracked `.codex/`, `.agents/` and `AGENTS.md` are moved aside and no longer ignored; the
`claude-code` golden is pinned to today's sync output; and one arc command, hand-rendered for OpenCode and invoked from
OpenCode, leaves a receipt carrying `harness: opencode` on the canonical spine.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none
**REQs closed here:** none. This phase is the walking skeleton every REQ reads: the matrix (REQ-02), the golden (REQ-04) and the harness field (REQ-03).

## Two deliveries

- **PR A — the birth PR** (branch `feat/distribute-birth` off fresh `origin/main`): the kickoff files (PLAN, PROGRESS,
  5 specs, ADR-2000..2016, `fixed-defects.md`), steps 1–6 below including `evidence/phase-00/agents-skills-verdict.md`
  (test 7 reads it, so it lands in PR A), and `tests/distribute-birth.bats`. Steps 1–2 run in the MAIN clone and only
  their evidence file is committed, from this worktree.
- **PR B — the close PR** (branch `feat/distribute-p00-close`, after PR A merges): the spike evidence, the receipt ids
  written into ADR-2000 and `PROGRESS.md`, the vocab ADR if A-03 fires, and the
  `/arc-phase-done 00` tracker edits.

## Scope (in order)

1. **Move the local lies aside — BEFORE the ignore lines go (ADR-2014).** From the main clone
   `E:/Work_Hub/01_Automemory/arc`: `mkdir -p ~/.arc-private/distribute/local-2026-07-11` and `mv .codex .agents AGENTS.md`
   into it. Then confirm with `git -C E:/Work_Hub/01_Automemory/arc status --porcelain --ignored -- .codex .agents
   AGENTS.md`, which must print nothing. This is a move, not a delete, so A-06 can restore it. The owner's standing
   instruction of 2026-10-07 ("ellame neeye pannu") covers it.
2. **Compare the eight `source-command-arc-*` skills (DST-D, A-06).** For each
   `~/.arc-private/distribute/local-2026-07-11/.agents/skills/source-command-arc-<n>/SKILL.md`, diff its body (the part after
   the frontmatter) against `.claude/commands/arc-<n>.md`'s body with `\r` stripped. Record one table row per skill in
   `initiatives/distribute/evidence/phase-00/agents-skills-verdict.md`, under the header `| Local skill | Verdict | Skill
   lines | Source lines | Only in skill | Only in source |`; column 1 is the skill directory name (`source-command-arc-<n>`
   or `seo-article-writer`) and column 2 is exactly `FAITHFUL` or `DIVERGED`. The comparison is line-set based on the
   body after the frontmatter with `\r` removed: FAITHFUL means equal line counts and 0 lines unique to either side. FAITHFUL files are copied to `tests/fixtures/distribute/goldens/codex-seed/<n>/SKILL.md`, and the
   rest stay only in the private archive. The local `seo-article-writer` is diffed against the tracked
   `.claude/skills/seo-article-writer/`, and the result is recorded. `.codex/hooks.json`'s absolute paths are quoted into
   the same evidence file as the boundary attacker's exhibit.
3. **`.gitignore`:** delete lines 75–78 (`# Codex`, `.codex`, `.agents`, `AGENTS.md`). Run `git log origin/main
   --oneline -5 -- .gitignore` first.
4. **`engine/harnesses.yaml` (DST-C, ADR-2003).** The path is the ROOT `engine/` directory beside `engine/router.yaml`,
   NOT `.claude/scripts/engine/`; `sync-to-project.sh` copies only `.claude/**` and named docs, so the sync golden is
   unaffected and no manifest line is needed (`products/engine/manifest.json` lists no `engine/*.yaml` data file today).
   Use block YAML that `parseYamlSubset` (`.claude/scripts/engine/yaml-subset.mjs`, returns `{ok, value}` or
   `{ok:false, error:{line, what}}`) reads: no flow collections, no CR bytes. Top-level shape, literally:
   ```yaml
   version: 1
   harnesses:
     - id: opencode
       status: verified
       verified: "2026-10-07"
       version: "1.17.18"
       source: "https://opencode.ai/docs/commands/ + opencode --help"
       golden: tests/fixtures/distribute/goldens/opencode/
       golden_pending: P03
       cells:
         commands: "true"
         agents: "true"
         hooks: "partial:plugin tool.execute.before, not arc fragments"
         skills: "true"
         mcp: "true"
         brain_file: "true"
         subagents: "true"
         user_only_invocation: "false"
         argument_substitution: "true"
   ```
   Every cell value is a double-quoted string (`"true"`, `"false"` or `"partial:<note>"`) so the colon inside `partial:`
   never parses as a mapping; the values above are the shape only and are replaced by what the docs read says. Each row has the key
   `id` plus `status: verified|unverified`, `verified: YYYY-MM-DD`, `version:`, `source:` (doc URL or "installed
   binary --help"), `golden:` and `cells:`. The cells are commands · agents · hooks · skills · mcp · brain_file ·
   subagents · user_only_invocation · argument_substitution, each `true | false | partial:<note>`.
   - **Verified rows:** `claude-code`, `codex`, `opencode` and `skills-only`. Each row is filled from `/arc-capability`
     run against the live docs, together with the installed binary's `--help` (`opencode` 1.17.18, `codex-cli`
     0.147.0). The doc URL and the read date go in `source:`. Rows with no binary of their own write `version:` as the
     spec they follow: `claude-code` takes `claude --version` output, `skills-only` takes `"agentskills.io spec 2026-10-07"`.
   - **Unverified rows:** `hermes`, `kimi-cli`, `gemini-cli` and `cursor`, each with `status: unverified`, today's date
     and every cell `false`.
   - **Goldens:** the `claude-code` row's `golden:` is `tests/fixtures/sync-golden/tree-manifest.txt` (ADR-2005: today's
     sync output is already goldened; no second walker). The row also carries a `golden_transform:` line that declares
     what that golden destroys: `\r` stripped (so `core.autocrlf` checkouts hash alike), and `.claude/arc-registry.json`
     excluded; it also states that no compile-side claude-code golden exists until P02. Every other verified row's
     golden is `tests/fixtures/distribute/goldens/<id>/` with `golden_pending: P03`. `golden_transform:` is a plain string
     containing the words `carriage-return` and `arc-registry.json` (no backslash escape, so no parser escape question:
     attack c4e1d7d B8), and test 6 greps for both.
   - **Corrections:** where the live docs contradict PLAN's paths (`.opencode/command/`, `.opencode/agent/`,
     `.agents/skills/`), the row wins, and the correction is written into the PLAN Current state in the same commit.
5. **Board rows + lane birth.** Run `git log origin/main --oneline -5 -- PORTFOLIO.md` first.
   - Replace the band row `| 2000–2099 | next lane to be born |` with `| 2000–2099 | `distribute` — claimed at birth,
     2026-10-07 (**2000–2016 taken**); the claim swept 17 worktrees and 272 remote branches — none held an ADR ≥2000 |`,
     and add `| 2100–2199 | next lane to be born |`.
   - Add the lane row, copying the header values from `initiatives/distribute/PROGRESS.md` (`portfolio-board.bats`
     asserts that they agree).
   - **Face birth rows** (the birth rule, ADR-1311): in `initiatives/face/contracts/expected-set.json` add
     `"distribute": "lane"` to the `lanes` map (NOT the `products` map: distribute has no product, ADR-2012) and
     `"2000": "lane"` to the `adrs` map, then run `node .claude/scripts/core/face-sections.mjs` and commit
     `rooms.generated.json` in the same commit.
   - Then, in ONE commit after `git fetch && git merge origin/main`, run `node .claude/scripts/docs/wiki-build.mjs` and
     then `--check`. Also run `node .claude/scripts/core/face-coverage.mjs` and check that its output names no
     distribute gap. The `PLAN-distribute` room is the face lane's row on PR #361, so do not add it here. If #361 has
     not merged by push time, PR A waits on it, because face-coverage would otherwise be red on PR A.
6. **`initiatives/distribute/fixed-defects.md`**, seeded with the imported classes. Each is a checkable line, to be
   tested in every distribute file:
   - (a) a realpath-both-sides main guard;
   - (b) no `process.exit()` after async I/O (set `exitCode`, then drain);
   - (c) a flag with a missing or empty value is refused and never consumes the next flag;
   - (d) one path-confinement function per tool, and no other `resolve()` on external data;
   - (e) a scanner that cannot read its input prints `COULD NOT SCAN`, never an empty result;
   - (f) "validate one read, compare another": the bytes that are validated are the bytes that are used;
   - (g) the `$ARC_ROOT` or a POSIX path is never interpolated into a node program — use `cd` + a relative path, or argv;
   - (h) no apostrophe, backtick or `$` inside a program embedded in a shell string;
   - (i) a missing key is never treated as an empty value (missing-vs-empty, ADR-0223).
7. **`/arc-attack`** on the local commit of PR A (two surfaces, `fixed-defects.md` in the prompt). Fix the highs and
   mediums, and put the lows in `initiatives/distribute/debt-ledger.md`. Push PR A once, then run a background
   `node .claude/scripts/review/ci-digest.mjs` loop (exit 3 = pending, 120 s) and merge on per-JOB green with the head SHA asserted.
8. **After PR A merges, from the MAIN clone (`git pull` first):**
   - **The ruling.** `decision.recorded` needs `decides` to be an `approval.requested` ULID, so the ruling is two
     receipts. (i) Write `{"what":"ADR-2000: the distribute lane is born — owner ruling 2026-10-07, arc on every
     harness","gate":"lane-birth"}` to a file with the Write tool, then run `node .claude/scripts/hq/arc-event.mjs emit
     approval.requested --payload-file <file> --process distribute`. The kind is positional, and the ULID is printed on
     stdout. The process value must match `name@x.y.z` (`PROCESS_RE` in `.claude/scripts/hq/lib/validate.mjs`; a bare name is
     refused `BAD_PROCESS`, which is what discover's first emit hit), so use `--process distribute@0.1.0` from the first
     emit. A refusal STOPs and its `SpineError` code is recorded; never iterate field names. (ii) The owner stamps it with `node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason
     "distribute lane born 2026-10-07"`.
   - **The spike (A-02, A-03).** Hand-write `.opencode/commands/arc-resume.md` (plural, per opencode.ai/docs/commands read 2026-10-07) in the main clone as an untracked file.
     This is quarantine: it is never committed, and it is deleted after the run. It is a rendering of
     `.claude/commands/arc-resume.md` in OpenCode's command format as read in step 4. Its last instruction writes the payload with the Write tool and emits
     `note.logged` via `node .claude/scripts/hq/arc-event.mjs emit note.logged --payload-file {file} --process distribute@0.1.0` with payload `{"harness":"opencode","command":"arc-resume","note":"P00 spike"}` through
     `arc-event.mjs emit`. Run it non-interactively with `opencode run --command arc-resume` (the `--command` flag is in `opencode run --help`
     1.17.18; a leading `/` is unverified) on the model OpenCode is configured with. Commit the transcript as
     `evidence/phase-00/opencode-spike.txt`, headed `harness-proof: {opencode --version} {session id}`, and the receipt's
     payload carries `"evidence":"initiatives/distribute/evidence/phase-00/opencode-spike.txt"`. If the model does not
     emit, the transcript records `NO-RECEIPT (model)` and the spike re-runs once with an explicit model flag; two misses
     fire A-02.
   - **If `arc-event` refuses `harness`:** record the `SpineError` code verbatim, write the vocab ADR (2017), make the
     smallest `.claude/scripts/hq/lib/validate.mjs` change that admits `harness` on `note.logged` (emitter:
     `.claude/scripts/hq/arc-event.mjs`), and land both in PR B. Re-run the spike after
     PR B merges, and record both attempts.
   - Then PR B, then `/arc-phase-done 00` from the main clone.

## Exit criteria (Definition of Done)

- [ ] `distribute-birth`, `portfolio-board`, `wiki-coverage`, `face-coverage` and `sync` green on CI for PR A, read per JOB via `ci-digest.mjs` with the head SHA asserted
- [ ] the main clone's `.codex/`, `.agents/`, `AGENTS.md` absent and archived; `.gitignore` carries none of the three
- [ ] `engine/harnesses.yaml` has 4 `verified` rows each with a date, version and source, and 4 dated `unverified` rows
- [ ] the ruling `approval.requested` and the owner's `decision.recorded` found by id in `events/`, `_quarantine/` listed with no distribute record
- [ ] ≥ 1 receipt whose payload has `harness: opencode`, found by id in `events/`, plus the spike transcript committed
- [ ] PR B merged; closed via `/arc-phase-done 00` from the MAIN clone; lane header + PORTFOLIO row in the same commit

## Verification plan

- **Test command:** CI bats `tests/distribute-birth.bats`, plus the existing `tests/portfolio-board.bats`,
  `tests/sync.bats` and `tests/face-coverage.bats`, and the `wiki-coverage` job (never run on this box).
  `distribute-birth.bats` has 8 tests (the 7 below plus a registered-count test that asserts 8), with its node probes in
  `tests/distribute/birth-probe.mjs` (never embedded in a shell string):
  1. "band 2000 is distribute's": the `PORTFOLIO.md` row for `2000–2099` names `distribute`.
  2. "no rendered surface is gitignored": `.gitignore` has no line equal to `.codex`, `.agents` or `AGENTS.md`.
  3. "the matrix parses": `parseYamlSubset` on `engine/harnesses.yaml` returns `ok: true` and ≥ 8 rows. It first asserts the file exists and is non-empty (RAN).
  4. "every verified row is dated and sourced": each `status: verified` row has a `verified:` that matches `^\d{4}-\d{2}-\d{2}$`, plus a non-empty `version:` and `source:`. There are exactly 4 such rows.
  5. "every cell is legal": each cell value is `true`, `false` or starts with `partial:`. The count of cells checked equals rows × 9.
  6. "the claude-code golden is today's sync golden": the `claude-code` row's `golden:` equals `tests/fixtures/sync-golden/tree-manifest.txt`, that file has ≥ 400 lines, and `golden_transform:` names both `carriage-return` and `arc-registry.json`.
  7. "the verdict file is complete": `initiatives/distribute/evidence/phase-00/agents-skills-verdict.md` exists (RAN) and its table has exactly 8 `source-command-arc-*` rows plus 1 `seo-article-writer` row, each verdict `FAITHFUL` or `DIVERGED`; the count of `tests/fixtures/distribute/goldens/codex-seed/*/` dirs equals the count of FAITHFUL command rows (0 on 2026-10-07); a mutant arm with one row deleted fails with `verdict incomplete`.
- **Expected failure first:** red-first is evidenced by **commit order plus mutant arms, not by a throwaway push** (push-once rule). The test file is its own commit, ahead of the rows: `git log --format=%h\ %s -- tests/distribute-birth.bats engine/harnesses.yaml` on PR A shows the test commit first, recorded in the evidence. Test 1 fails with
  `band 2000 row does not name distribute`, test 2 with `.gitignore still ignores .codex`, and tests 3–6 with
  `engine/harnesses.yaml missing`. Tests 2 and 4 each also carry a mutant arm that runs the same assertion against a
  temp copy with the ignore line restored, or a `verified:` date removed, and asserts it FAILS with the named message.
  Test 7 carries the deleted-row mutant above. So the single CI run of PR A proves both directions for tests 2, 4 and 7; tests 1, 3, 5 and 6 are structural and their red state is the commit-order evidence. The suite runs inside `selftest` and rides `_default_weight` (16) in `tests/shard-timings.json` like every new suite before it; measured weights for every `distribute-*.bats` are committed at the P04 close from one `weigh-tests.yml` dispatch (PLAN rabbit hole 7).
- **Live demo scenario:** after the merge, from the main clone: `git status --porcelain --ignored -- .codex .agents
  AGENTS.md` prints nothing; `node -e` with `parseYamlSubset` prints the 8 row ids with status; `opencode run
  --command arc-resume` prints a resume summary and the emitted ULID.
- **Real-system check:** the ruling receipts and the spike receipt are in the canonical spine's `events/<date>.jsonl`,
  not in `_quarantine/`; `grep -c '"harness":"opencode"'` ≥ 1.
- **Expected evidence:** `initiatives/distribute/evidence/phase-00/` holds `agents-skills-verdict.md`,
  `opencode-spike.txt`, the receipt ids, the quarantine listing, the `/arc-capability` reports for the four rows, and
  PR A's CI run id with per-job conclusions.

## Rabbit holes in this phase

- Writing the OpenCode adapter "since the spike is open": the spike file is hand-written, never merged, and P03 writes the adapter.
- Verifying more than four rows.
- Hand-merging a generated file after a conflict: re-run the generator.

## Out of scope for this phase

- any renderer, installer, gate or CLI code · `AGENTS.md` as a tracked file (P01) · the REQ-09 settings (P01)

## Your-setup / pending

- Owner after PR A merges: one `arc-inbox approve` keystroke for the ruling.
- OpenCode needs a configured model for the spike. If none is configured, the session uses OpenCode's built-in free model, and the transcript records which model ran.

## Non-negotiables (verbatim from PLAN)

- The Claude source (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`, `.mcp.json`) is not moved, renamed or reformatted; adding the `targets:` key is the only source edit, and a lint pins it (ADR-2001).
- No prose fallback: a construct a target cannot express is dropped only where the matrix cell says so, otherwise `[unsupported]` by name (ADR-2001, ADR-2003).
- Merge-time is the truth: nothing is enforced only in a Claude Code hook, and a git hook is never called the gate (ADR-2002, ADR-2013, ADR-2015).
- The gates phase (P01) precedes every adapter; phase order is never changed; undeclared surfaces are resolved before any new one (ADR-2004, ADR-2014).
- `sync-to-project.sh`'s output stays byte-identical to the golden committed in P00 for every root-mode consumer (ADR-2005).
- `AGENTS.md` is the brain and `CLAUDE.md` only imports it plus marked Claude-only blocks (ADR-2007).
- Subagents degrade to role skills, never to a nested harness call; only the four v1 targets install (ADR-2009, ADR-2010).
- Code lives in `engine` beside `arc-compile` and gates in `core`; no second compiler, no second walker (ADR-2012); new gates run as bats inside existing CI jobs (ADR-2016).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/distribute/fixed-defects.md`; the author is never the attacker; max 2 rounds (ADR-2011).
- Zero npm deps; no `npm publish`; no public README rewrite; no bash port (ADR-2008); no model, driver, router, profile or tier change (ADR-2006).
- Tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
