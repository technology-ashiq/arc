# Phase 05 — the capped wrapper, the harness stamp, one live smoke receipt (Cycle 2 steel thread)

**Goal (one line):** `opencode-session.mjs` runs the rendered `arc-commit` headless in OpenCode on `openrouter/deepseek/deepseek-v4-flash-0731` under a $0.10 cap, and one `commit.done` stamped `harness: opencode` with the committed transcript as `evidence` is found by id on the main clone's spine.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**REQs closed here:** REQ-11, REQ-12

## Scope

1. `.claude/scripts/engine/opencode-session.mjs` per ADR-2019 (refuse-before-spend, transcript header + verbatim JSONL, cost sum, kill at cap, `COST-UNREADABLE`, timeout), setting `ARC_HARNESS=opencode`, `ARC_EVIDENCE`, `ARC_MODEL` and the computed `ARC_SPINE_ROOT` for the child (ADR-2020).
2. `arc-event.mjs`: the `ARC_HARNESS` / `ARC_EVIDENCE` stamp (ADR-2020); unset = byte-identical.
3. `tests/fixtures/distribute/fake-opencode.mjs` (scripted modes via env: `ok`, `overspend`, `nocost`, `stall`; writes a marker file when invoked) and two suites: `tests/distribute-opencode-session.bats` (REQ-11) and `tests/distribute-harness-stamp.bats` (REQ-12), each with a measured shard-weight entry.
4. A session worktree `E:/Work_Hub/01_Automemory/wt-oc-req03` on branch `feat/distribute-c2-oc-session`, `.opencode/` rendered there by `node bin/arc.mjs init --target opencode` (never committed), and **one live smoke**: the wrapper runs the rendered `arc-commit` on a one-line change, cap $0.10. The transcript is committed at `initiatives/distribute/evidence/phase-05/transcripts/smoke-arc-commit.jsonl`.
5. The REQ-05 dirty scan learns what the compiler writes (each source target render, matched by bytes): its planned set had stayed empty since P02, so an OpenCode render inside an arc checkout made the pre-commit refuse every commit (fixed-defects (bu)); pinned by a new `tests/distribute-dirty.bats` fixture.
6. Products manifest / sync golden rows for the new synced files, if `product-lint` asks; wiki regenerated if a page is owed.

## Exit criteria (Definition of Done)

- [x] REQ-11 and REQ-12 bats green on all 3 CI legs per job (`ci-digest` on the pushed head)
- [x] the smoke receipt id is found in the main clone's `events/` with `payload.harness == "opencode"` and `evidence` = the committed transcript path; `_quarantine/` listed, 0 from the run
- [x] smoke spend read from the transcript ≤ $0.10 (50% tripwire); tripwire answer written in PROGRESS
- [x] attack pass (`/arc-attack`, max 2 rounds) on the phase commit, findings fixed or ledgered
- [x] tracker updated (PROGRESS row + done-log); the phase close itself runs from the main clone after the cycle's merge

## Verification plan

- **Test command:** CI `selftest` jobs running `tests/distribute-opencode-session.bats` and `tests/distribute-harness-stamp.bats`, read with `node .claude/scripts/review/ci-digest.mjs`
- **Expected failure first:** before the wrapper exists, `distribute-opencode-session.bats` fails at its first RAN assertion with `opencode-session.mjs: No such file` (node `MODULE_NOT_FOUND`); before the stamp, the `ARC_HARNESS` arm of `distribute-harness-stamp.bats` fails on `payload.harness` being `null`
- **Live demo scenario:** in the session worktree, `node .claude/scripts/engine/opencode-session.mjs --cap-usd 0.10 --model openrouter/deepseek/deepseek-v4-flash-0731 --command arc-commit --transcript <evidence path> -- "commit the staged change"` → prints `opencode-session: ok spent=<≤0.10> session=ses_… transcript=…`; then from the main clone `grep -h <receipt id> .claude/state/hq/events/*.jsonl` shows the stamped receipt
- **Real-system check:** the main clone's spine and `_quarantine/` listing; OpenCode version in the transcript header; one live overspend control — the wrapper runs real OpenCode with `--cap-usd 0.002` and must exit 3 `cap-breach` with the child gone, or exit 4 `COST-UNREADABLE`, never 0 (its spend counts toward the cycle cap)
- **Expected evidence:** `evidence/phase-05/transcripts/smoke-arc-commit.jsonl` (+ `.stderr`), `evidence/phase-05/smoke.md` (receipt id, spine line, quarantine listing, spend), CI run id per job

## Rabbit holes in this phase

- The smoke's commit must not include `.opencode/` (OpenCode writes `node_modules` there): the change is staged before the run, and the transcript shows `git status` clean of `.opencode/` paths.
- A transcript holding the owner's key or a home path with PII: the wrapper writes only stdout events; grep the transcript for `sk-or-` and the owner's contact values before commit.

## Out of scope for this phase

`arc-ship` (P06) · review and negatives (P07).

## Your-setup / pending

None: `OPENROUTER_API_KEY` is set in the environment (checked 2026-10-13); the owner may add a credit limit on that key as a second ceiling.

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
