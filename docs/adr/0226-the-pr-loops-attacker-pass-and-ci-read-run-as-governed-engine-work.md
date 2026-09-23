# ADR 0226 — the PR loop's attacker pass and CI read run as governed engine work, not inside the building session

**Status:** proposed
**Date:** 2026-09-23
**Product:** `engine` — **out-of-cycle** (owner-ruled 2026-09-23, ADR-0220 precedent). Serves every lane's PR loop; raised by `face` Cycle 16 between Phase 05 close and Phase 06 start.
**Reversibility:** two-way
Additive except for four engine fixes (Decisions 7–10) that this feature could not run without: one process, three scripts, one command, one router row, three CLAUDE.md lines. Deleting them restores today's hand-run pass byte-for-byte; the driver fixes are independently correct and stay.
**Revisit trigger:** the logic-surface attacker has run through the ADR-0220 trial seam on the PRs of more than one phase. Past that point it is production use: it needs an ADR-0069 amendment filling the `independent-family-verifier` seat plus a router row, or it stops.

Routed via `/arc-change --lane engine` on 2026-09-23.

## Context

CLAUDE.md carries the PR loop's two costliest laws as prose only — "two fresh agents with different surfaces, carrying the lane's fixed-defects list" and "read CI per JOB, confirm the run's head SHA is local HEAD". Neither has a command, a process file or a script: `.claude/scripts` contains no `gh run` call, and `processes/` has no attack process. face's own probe (`initiatives/face/evidence/phase-05/cli-probe.md`) records the same shape for qa: "no process yaml, so arc-run cannot start it yet".

So both run inside the interactive building session. General-purpose attackers inherit the session's model (opus); the session polls CI and re-reads its whole context on every turn; `initiatives/face/fixed-defects.md` (126,534 bytes on 2026-09-23) rides whole into every attacker, every round. Measured on the owner's account, face Phases 04–05, 2026-09-17..19: 1.38B / 1.09B / 1.54B cache-read tokens per day against 5.9M / 3.4M / 5.3M output — ~233 tokens re-read per token written — and the weekly limit exhausted.

The engine already has the right shape. `arc-run` is headless, one fresh subprocess per run, schema-validated and receipted; `generic-api` speaks the OpenRouter-shaped endpoint the owner's gateway exposes; ADR-0220 gives a receipted per-invocation trial model.

**Measured while building this change, and not in the draft** — four engine limits no earlier process was big enough, or narrow enough, to hit (Decisions 7–10). The first: `drivers/generic-api.mjs` has never sent a process's body. Its request is a one-line system message naming the process plus `JSON.stringify(input)` — no instructions, no output contract. It is unchanged since Cycle 6 (`b9a9e9fd`) and has never carried a real run, so nothing noticed. Any trial through it, for any process, would have measured a model answering a question it was never asked.

## Decision

1. **`processes/attack-diff.process.yaml`**, `tools: []` (ADR-0223: grant nothing). The attacker sees only its input, so "fresh = has not seen the implementation" becomes structural rather than a prompt instruction. No `compile:` block: a generated command would be the attacker prompt itself, so `/arc-attack` is hand-written (Decision 4).
2. **`build-attack-input.mjs`** mirrors `build-pack-input.mjs`: the diff (`--base` or `--since`, read with an args array), the lane's defect patterns, the surface, prior findings for round 2, and `classification: external-ok` declared in the input so the data boundary (ADR-0219) reads it structurally. The repo is public. A `fixed-defects.md` row is `- **pattern** — where (sha) — *rule*`, which has no clean first sentence, so each row contributes **its bold pattern and its italic rule**: rows in equals rows out, none dropped, byte count printed.
3. **Routing.** Boundary surface → router class `attack-diff`, tier `balanced-workhorse`, driver `claude-code`, `fallback: []` (codex is unavailable, and silently swapping an attacker's family is not a fallback). ADR-0069's seat map already places attackers there (`plan-attacker`), so this decides nothing new. Logic surface → explicit `--driver generic-api --trial-model <id>` under ADR-0069(g) / ADR-0220: an explicit driver consults no tier, so the trial is not refused; receipted `model_source: trial`; `generic-api` is in-house, so ADR-0225's grant rule does not apply. No router row for it, no tier change.
4. **`arc-attack.mjs` + `/arc-attack`** build both inputs, run both, write both validated outputs to the lane's evidence dir as `attack-<sha7>-r<k>-<surface>.json` and print one screen. They never fix and never commit. With `ARC_ATTACK_TRIAL_MODEL` unset the logic surface prints **NOT RUN** and the command exits non-zero — never a faked run (E3). `--driver mock` runs both surfaces on the replay driver; it exists so CI can prove the path end to end.
5. **`ci-digest.mjs`** turns the CI law into a script: the latest run for HEAD, its head SHA asserted equal to local HEAD, per-job conclusions, failed-job tails capped at 40 lines. Exit 0 green · 1 red · 3 pending · 4 SHA mismatch.
6. **CLAUDE.md**: both laws name their mechanism; a session-boundary line is added — the building session ends at push, and the next begins with `/arc-resume`.
7. **`generic-api` builds its prompt from the canonical process document**, through the same `canonicalDoc` read `claude-code` uses: body, input, output contract. One reader, so the gate and the prompt see the same bytes.
8. **Amends ADR-0223 clause 4 (owner ruling 2026-09-23).** Under `permissions: declared`, an explicit `tools: []` no longer makes the claude-code driver throw. It dispatches with `--tools "" --strict-mcp-config` — the CLI's real zero: no built-in tool, no MCP server — so the most restrictive declaration reaches the CLI as the most restrictive argv. A non-empty list that renders to nothing (`[ask.human]`) still throws: that is a mapping gap, not a declaration of zero. The whole decision is one function, `dispatchToolArgs` in `adapters/claude-code.mjs`, so the driver holds no second copy. The compile path is unchanged: a generated command has no such zero, because an absent `allowed-tools:` line is unrestricted.

9. **arc-run's secret-scan ceiling scales with what it scans (owner ruling 2026-09-23).** `scanSecrets` gains an optional `maxCandidates`; arc-run passes `sizeScaledCap(text)` = max(200, ⌈len/6⌉ + 8). The flat 200 was sized for spine events: measured over the last twelve merges, a feature PR's diff carries 600–1,811 base64-shaped runs (paths, hashes), so every real attack input was refused before a driver started. The scan stays exhaustive — every candidate is decoded and scanned. Said plainly: candidates are mined from four views no longer than the text, and a run is ≥ 24 characters plus a separator, so no text yields more than ~4·len/25 — above the flat 200 this ceiling is unreachable by construction, and the work is bounded by being linear in the text. (A first cut used one per 64 bytes, which a hex-dense diff could still overflow.) Uncapped, the largest diff (336 KB, 1,811 candidates) scans in 237 ms. The spine emitter keeps 200.
10. **Large inputs travel as files, never argv (owner ruling 2026-09-23).** One argv element is capped at 128 KB on Linux and the whole command line at ~32 KB on Windows, so a 76 KB diff failed with `Argument list too long`. arc-run writes the input into its private per-call temp dir, passes `-` in the input slot and the path in `ARC_DRIVER_INPUT_FILE`; `runDriver` reads it. **Not `@<path>`**: the first cut used it, and the MSYS runtime under Windows `bash` expands any `@file` argument as a response file — it read the JSON and word-split it, so the mock driver received `surface:logic` as its budget. A literal JSON argument still works, so hand-run drivers are unchanged. The claude-code driver sends its prompt on stdin (`-p` with no argument). `codex` and `hermes` still build argv prompts and stay limited to small inputs; nothing routes attack-diff to them.

Fix slices stay in the interactive session on opus (owner ruling 2026-09-23) through `/arc-develop`. "There is no coder subagent" is unchanged by this ADR.

**Bootstrap exception, once.** This PR's own adversarial pass cannot use `/arc-attack`: the tool is not on `main`, and `arc-run` emits no receipts from a worktree. It runs as two fresh general-purpose agents one last time (owner ruling 2026-09-23). The first real `/arc-attack` runs from the main clone after merge.

## Consequences

**Easier.** The attack, review and CI steps leave the building session's context. A PR round becomes: build session → push → `/arc-attack` + `/arc-review` + `ci-digest` → fix session. Every attack is receipted with its model and cost, which is bench fuel. Every `generic-api` trial now asks the model the actual question.
**Harder.** The logic-surface model is unproven. A cheap model may miss what opus caught. Mitigations: the boundary attacker and the opus `code-reviewer` still run; round 2 attacks the fixes; the trial ends at the revisit trigger with a receipted bench verdict, never by default. Any earlier reading of a `generic-api` result is suspect — there are none on record, which is the reason the defect survived.

**The bootstrap pass, as it ran (2026-09-23).** Two rounds, two fresh agents each (the cap). Round 1: 4 logic + 5 boundary findings; round 2, attacking the fixes: 5 logic + 4 boundary. Everything in scope was fixed and pinned in `tests/engine-attack-diff.bats`, except the items below. The shapes that repeated are worth carrying: *an exit code computed with `max()` across unlike facts*, *a whole round refused for one surface's problem* (twice: an existing file, then an ambiguous prior), *an unguarded fs call in a path that owes a receipt* (four sites), and *untrusted text printed without being flattened to one line* (model findings, then CI logs).

**Known debt, named rather than implied.**
- `{{input.X}}` placeholders are rendered only by arc-compile; every driver hands `body` to the model verbatim. attack-diff no longer uses one; `review-diff` and `kickoff-plan` still do, so dispatching either through `arc-run` sends the literal placeholder. An engine fix, not this ADR's.
- The claude-code stdin spy runs on the POSIX legs only: Node will not `execFile` a `.cmd` shim without a shell. The Windows CLI was verified reading stdin with `--tools ""` by hand on 2026-09-23 (one haiku call); nothing on the Windows leg pins it.
- `codex` passes no tool argv at all and, with `hermes`, still carries its prompt on argv. Nothing routes attack-diff to either.
- A failed write of the driver input file (as opposed to a missing temp dir) is guarded but not pinned by a test; forcing ENOSPC portably on three CI legs is not worth its fixture.

## Alternatives rejected

- **Codex CLI driver** — no ChatGPT plan (owner, 2026-09-23).
- **`/arc-change` inside face Phase 06** — its spec puts new router classes out of scope (engine lane).
- **A new kickoff cycle** — face holds the live slot; this is 1.5d and additive.
- **Trimming fixed-defects by dropping rows** — breaks the carried-list law; each row's pattern and rule are kept instead, none dropped.
- **Carrying the attacker instructions inside the input** instead of fixing `generic-api` — the prompt would live in two places and drift; the driver defect would stay for every other process.

## Related

ADR-0069 (a)(g) · ADR-0219 · ADR-0220 · ADR-0223 · ADR-0225 · ADR-1326 (the session door starts `arc-run`, so `/arc-attack` becomes a face button with no face code) · CLAUDE.md attacker and CI laws.
