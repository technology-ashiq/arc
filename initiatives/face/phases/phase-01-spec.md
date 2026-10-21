# Phase 01 — Records tab, pickers, the first-verb CI gate, and the logic attacker

**Goal (one line):** REQ-02…05 — long rooms open short with their records on a Records tab, fields that name an existing thing are pickers, CI fails a buried verb, and every PR gets both attack surfaces.
**Appetite:** 2 days ((a) Records 0.75d · (b) pickers 0.5d · (c) CI gate 0.25d · (d) logic attacker 0.25d · attack + CI 0.25d)
**Depends on:** phase-00
**Serves:** REQ-02, REQ-03, REQ-04, REQ-05
**Branch:** `feat/face-v3-01-records-pickers`
**Preconditions (STOP if absent):** the owner stamped this kickoff; Phase 00 is closed; `git log origin/main -5 -- face/src/shell/RoomFrame.tsx .claude/scripts/hq/face-ops.mjs face/scripts/flows.mjs` read before the first edit.

## Exit criteria (Definition of Done)
- [ ] **(a) Records (ADR-1365):** `frameTabs` returns `records` when the room's fold declares a collection; a shared `RecordsTable` draws each declared collection capped at 8 rows; "show all N" renders at most 200 rows then reads "N more -- narrow the search"; search is a literal, case-insensitive substring match over the declared fields (a regex metacharacter query matches itself, never throws); 0 rows draws an empty state naming the collection; a failed read draws the error beside a retry; a 5,000-row fixture renders in < 1 s and ≤ 208 `tr`. Ventures, money and story move their long lists to declarations and each measures Overview ≤ 3,000 px at 1366×768; org's Overview (chart + header) is measured BEFORE its lists move into `evidence/phase-01/heights.md`, and if the chart alone exceeds 3,000 px org's bound is re-stated by `/arc-change`, never by dropping the room.
- [ ] **(a) Shape check:** a node check FAILs a declaration naming a column its rows lack, a cap ≤ 0, or a search field that is not a column; `face-pure` 37/37 green.
- [ ] **(b) Pickers (ADR-1369):** every op field naming an existing venture, model, agent or campaign is a `select` whose options come through `/api/ops` (`FIELD_SOURCES`); month fields offer the last 12 months from a pure `.mjs` function taking an injected `now` (fixtures 31 Dec, 1 Jan, 29 Feb); fields naming a NEW thing stay text; `POST /api/op/:id/plan` with a picker value outside the served options returns 400 naming the field and value, and apply re-reads the options and refuses a value that left the list; an empty source renders the field disabled ("none yet -- create one first") and the Plan button disabled; 32/32 ops plan 200 with their placeholders on the CI fixture tree, and on a zero-source tree every picker op reads not-ready; stale-list and skipped-membership mutants each FAIL `tests/face/work-door.mjs`.
- [ ] **(c) CI gate (REQ-04):** the face browser suite asserts first-verb `top` < 768 px at 1366×768 in both moods for every room with verbs and prints a RAN marker first; the mutant is a node-level fixture over the frame-layout decision in `face/src/lib/frame.mjs` (section order returned as data: strip index < View index), run by `tests/face/l3-logic.mjs` on the install-free legs — the browser assertion is the live twin and is not mutated (no second build, no test flag in a View).
- [ ] **(d) Logic attacker (ADR-1368):** before the real run, a smoke on the trial model with a tiny `attack-diff` input returns a JSON object in under 60 s, or the model is swapped and the swap named in PROGRESS; with the owner's env set, `/arc-attack` on this phase's PR prints `LOGIC:` and writes `attack-SHA-r1-logic.json` with `model_source: trial`; a round-1 LOGIC failure re-runs as round 1 on a second-family fallback before any fix lands; a grep finds no key in the tree. If the env is absent by the phase's last day, the slice is `blocked-owner` and REQ-05 carries to Phase 02 (kill criteria).
- [ ] Harness updated in the same PR for every UI change (`flows.mjs`, `smoke.mjs`); generators re-run (`face-sections`, `wiki-build`, sync golden by its recipe) and each `--check` green.
- [ ] Two attack surfaces (round 1 + round 2 on the fixes), one push, CI green per job; the owner reads ventures, money, story and org in the face; `/arc-phase-done 01`.

## Verification plan
- **Test command:** CI per job via `node .claude/scripts/review/ci-digest.mjs`; the node checks `node tests/face/l3-logic.mjs`, `node tests/face/work-door.mjs`, `node tests/face/face-pure.mjs` (install-free legs); the browser suite `tests/face-browser.bats` on CI.
- **Expected failure first:** three reds, each shown before its code changes. (1) REQ-04: `main` @ `6012c36` already passes the first-verb assertion (27/27 at 126 px), so the red is the node mutant that returns the strip after the View from `frame.mjs` — `l3-logic.mjs` FAILs it with `strip index >= View index`; the browser twin prints `first verb at N px` per room. (2) Records: the shape check FAILs a fold declaring a column its rows lack (`unknown column NAME in COLLECTION`), and the 5,000-row fixture FAILs an uncapped table. (3) Pickers: `work-door.mjs` FAILs the stale-option mutant before `FIELD_SOURCES` serves the options.
- **Live demo scenario:** open `#/ventures`, `#/money`, `#/story`, `#/org` at 1366×768: Overview fits in ≤ 3,000 px; the Records tab shows 8 rows, "show all N" and search; open `ventures.kill-review` from the strip and pick the venture from a list.
- **Real-system check:** the owner's main clone with the canonical spine; one real `/arc-attack` against DeepSeek via OpenRouter.
- **Expected evidence:** `evidence/phase-01/heights.md` (before/after per room), shots of the four rooms, the logic attack JSON, CI run id.

## Rabbit holes in this phase
Server-side search or pagination; declaring every room's records now (four rooms only); tuning the attack prompt (engine's).

## Out of scope for this phase
`qa-run` / `ship-run` (Phase 02); agent tiers and the hunt op (Phase 03); the ADR-0069 production row for the attacker (ADR-1368 trigger).

## Your-setup / pending
`ARC_LLM_ENDPOINT`, `ARC_LLM_API_KEY`, `ARC_ATTACK_TRIAL_MODEL` (the DeepSeek id via OpenRouter) in the shell that runs `/arc-attack` or in the face's Keys tab — never in the repo.

## Non-negotiables (verbatim from PLAN)

- The module contract stays four files and a `View.tsx` holds no branch (ADR-1320, ADR-1359).
- `POST /api/decide` stays byte-parity with `arc-inbox` (`tests/face/dash-parity.mjs`).
- Zero new spine kinds; picker options and agent tiers ride EXISTING routes (`/api/ops`, `/api/roster`).
- Every write verb plans first and applies on the plan id (ADR-1339); every session starts only from a click as `arc-run --process NAME --driver NAME` (ADR-1326).
- Nothing in the face deploys, publishes or pushes (ADR-1366, AGENTS.md).
- Generated files are regenerated, never hand-edited (rooms.generated.json, docs/wiki, sync golden, compiled commands).
- No key, token or credential in the tree; the logic attacker's credentials live in the owner's environment (ADR-1368).
- Branch-only writes; `main` untouchable from the face; merge is the owner's.
