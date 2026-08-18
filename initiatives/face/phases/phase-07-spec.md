# Phase 07 — Ask arc (the governed brain)

**Goal (one line):** the brain dock answers ≥20 golden questions from live L2 with
receipt citations, as a governed engine process with zero write tools.
**Appetite:** 3 days (the LLM path is block C's designated cut — deterministic-only ships
if squeezed)
**Depends on:** phase-04

## Exit criteria (Definition of Done)

- [ ] `processes/face-ask.process.yaml` + router row `face-ask` (tier per ADR-0069,
      `hosted:` class per ADR-0219 — **local-only by design in v1**, ADR-1307) +
      `hq.policy.yaml` `process:face-ask` row **in the same change** (POL-I birth rule) +
      budget; `process-lint` green
- [ ] `run.completed` receipt with cost on every answered question (emitted by `arc-run`
      from the main clone)
- [ ] **zero write tools** — tool-list fixture proves the DECLARED list is empty AND a
      runtime probe (the process attempts an actual write-tool call inside `face-ask`) is
      rejected by the engine's runtime allowlist, not the declaration alone (ADR-0224: a
      declared toolset is not the runtime's allowlist until the runtime is sent it — the
      same gap PR #211 fixed company-wide)
- [ ] 20/20 golden questions answered from live L2 with citations; a citation that does
      not resolve to a ULID via L2 marks the answer *unverified* (never silently kept)
- [ ] offline/no-key fallback answers the deterministic subset (open approvals, burn,
      overdue jobs, kill distance) from L2 alone
- [ ] navigation ("open growth as-of 08-14") and decision drafting ("prepare a REJECT for
      01KZ… with reason …") work — the draft flows to the Stamp; the brain never emits,
      never approves, never runs a command
- [ ] shared-root-organ pre-edit check RUN and recorded (not assumed clean):
      `git log origin/main --oneline -5 -- engine/router.yaml hq.policy.yaml` before
      adding the `face-ask` rows — both files are root organs owned by no lane
      (ADR-0053) and the LIVE engine lane rewrote them this week (ADR-0224); on
      conflict, take the stronger version (lanes.md merge rule)
- [ ] tests green on CI per job; tracker updated

## Verification plan

One coarse line, refined at phase start via `/arc-change`: golden-questions fixture
(20/20 with citations) + zero-write tool-list fixture + offline-subset fixture.

## Rabbit holes in this phase

Voice (deferred, ADR-1315) · a "command palette that runs commands" · prompt engineering
beyond the golden set.

## Out of scope for this phase

Voice input/output (ADR-1315) · chat-mcp's MCP tool surface (its own brief wakes after
this lane ships — it reuses this L2, never forks it) · hosted drivers (ADR-1307 revisit
trigger).

## Your-setup / pending

Owner: install and verify a local LLM runtime (ollama-class per ADR-0219) — pull a model
and answer one smoke prompt — BEFORE the golden-questions DoD is attempted; nothing in
the arc repo or the OS installs this today. (The deterministic offline subset needs no
runtime and is built regardless.)

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
