# ADR 0208 — EXE-A: the runtime is Hermes Agent, pinned, and container-backed

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** the `review_by:` date on its `router.yaml` row (2 weeks, ADR-0216) — or, sooner, a maintenance discontinuity of the kind this project's own class has already produced twice: a rename, a founder departure, or a governance handover.

Decided under the owner's **Build-out Mandate (2026-08-09)**, which is the receipted decision that fired this cycle. Recorded on the spine as `decision.recorded` in Phase 04.

## Context

Executor v1 hires exactly ONE external agent runtime as an engine driver. The design source
(`docs/strategy/plans/PLAN-executor.md`, Appendix B) requires the scorecard to be filled with a
**fresh market check on kickoff day** — an earlier snapshot would be stale — and makes the outcome
binary: **no candidate green on every must-have is a STOP**, not a compromise. A bad hire is worse
than no hire; the mandate orders building, never forced hiring.

The four must-haves: headless invocability (no TTY), structured output capture, version + config
pinning including egress settings, and self-hostable. A "probably" on a must-have is a RED.

## Options considered

1. **Hermes Agent** (`github.com/NousResearch/hermes-agent`, MIT) — `hermes -z "<prompt>"` is a
   documented one-shot entry that puts the final response on stdout and nothing else, with a
   `--usage-file <path>.json` cost sidecar written **even when the run fails**. Six execution
   backends; picking any but `local` is real container isolation as a configuration choice.
2. **OpenClaw** (`github.com/openclaw/openclaw`, MIT) — `openclaw agent exec --json` is documented
   as the headless entry point, and the flag is real.
3. **Agent Zero** (`github.com/agent0ai/agent-zero`, MIT) — Docker-native by default, a `headless`
   CLI connector, `--output jsonl`.
4. Dismissed without a full matrix: elizaOS, SuperAGI, AutoGPT, Letta.

## Decision

**Hermes Agent, pinned at the release tag live at kickoff (`v2026.8.3`, published 2026-08-03), run
ONLY through a container-backed execution backend — never the bare `local` backend.** Owner's call,
2026-08-12, on the scorecard below.

The container clause is not a preference, it is what makes the hire certifiable. Both finalists'
own security documentation says the same thing in different words: OpenClaw's `workspaceAccess`
scoping is enforced by the **container engine's bind-mount flags**, and with `sandbox.mode: "off"`
everything runs on the host; Hermes Agent's `SECURITY.md` says plainly that *"the only security
boundary against an adversarial LLM is the operating system."* Tool-name allowlists, output
redaction and approval regexes are described **by the vendors themselves** as heuristics, not
containment. A configuration key that claims confinement with no container underneath it is
enforcing nothing, and certifying it would be the unprovable-fixture trap this cycle's REQ-02
exists to refuse.

**Evidence:** repository, official docs and release lists fetched live 2026-08-12 —
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) ·
[docs](https://hermes-agent.nousresearch.com/docs/reference/cli-commands) ·
[open issue #4170](https://github.com/NousResearch/hermes-agent/issues/4170) (terminal-egress gap in
the default backend, maintainer-tracked, still open) ·
[openclaw/openclaw](https://github.com/openclaw/openclaw) ·
[open issue #65846](https://github.com/openclaw/openclaw/issues/65846) (fetched directly: open, no
maintainer response) · [agent0ai/agent-zero](https://github.com/agent0ai/agent-zero). Both projects
verified to exist under these exact names with fetched canonical sources and dated release tags;
neither is a hallucinated package name.
**Confidence:** medium — the pick is sound on the must-haves and **contested on security history**.
Two independent researchers disagreed and the disagreement is recorded rather than averaged: one
found ≥12 distinct 2026 CVEs against Hermes Agent, several met with documented vendor silence; the
other fetched `github.com/NousResearch/hermes-agent/security/advisories` live on 2026-08-12 and
found **zero published advisories**, judging the aggregator CVEs likely products of the documented
2026 "AI slop" CVE-submission problem. Both readings agree on the one checkable fact — the vendor
has published no advisories — and that fact is equally consistent with "nothing to publish" and
"does not engage with disclosure". Unresolved, tracked as an assumption in `PLAN.md` with a trigger.
**Rejected because:** OpenClaw — `openclaw agent exec` writes the correct result JSON and then
**hangs in `livenessState: "working"` instead of exiting** (issue #65846, open; the same teardown
hang is reported for `openclaw cron` and `openclaw status`). A process that must always be
force-killed can never emit its own exit code, which breaks ADR-0203's contract at the root. This
disqualification survives ADR-0219's correction of the exit map: a process that never exits emits
neither the five codes the design source imagined nor the three that actually exist. Its ClawHub
marketplace is separately the subject of the ClawHavoc campaign (~1,184 trojanised skills) and
Snyk's ToxicSkills audit (36.82% of skills flawed, 13.4% critical). Agent Zero — must-haves 2 and 3
reached only medium/low-confidence secondary sources, and a "probably" is a RED. elizaOS — treasury
drained by litigation this month. SuperAGI — stalled, unaddressed vulnerabilities. AutoGPT —
drifting to a paywalled platform, muddying self-hostability. Letta — a stateful-memory SDK, not a
runtime of this class, and mid-deprecation of its own V1 server.

## Consequences

**Easier.** `hermes -z` plus a `--usage-file` sidecar maps almost one-to-one onto ADR-0203's
existing driver contract, so REQ-01's adapter is genuinely a shim rather than a translation layer.
MIT with no CLA found. The container backend is a configuration choice, not infrastructure this
cycle has to build.

**Harder.** The container backend is now a hard dependency: Docker is installed on this machine but
its daemon is **not running**, so Phase 04 cannot smoke-test the runtime until it is started. The
default `local` backend has no egress filtering at all (issue #4170), so "we configured Hermes
Agent" and "we configured it safely" are different claims and only the second one certifies. And the
security record is contested, which is precisely why the ceiling stays L1-drafts regardless of how
green the certification suite comes back.

**What we would revisit if this goes wrong.** If the container backend cannot be made to work
inside two days of adapter effort, the kill criterion applies: bank the shim and the certification
suite as documentation, record "demand-triggered retry", and the build-out moves to the next
module. The scorecard's runner-up is not OpenClaw until #65846 is verified closed.
