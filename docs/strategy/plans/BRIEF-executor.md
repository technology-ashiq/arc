# BRIEF — executor (the hired hands: agent-runtime drivers)

> **Added 2026-08-04 (owner-approved from a Cowork session draft) — sleeping until its
> remaining trigger fires.** Engine-lane work, per the engine plan's own precedent
> ("local-model driver = separate brief"): an agent runtime is the same shape — a new
> driver class, not a new module, no second routing owner. The `engine/router.yaml`
> delta is REQ-4 of this brief, landed as one reviewed diff in this cycle.

> **Current state (verified 2026-08-04, board + files):** engine Cycle 6 **CLOSED**
> 2026-08-03 (merged b9a9e9f / PR #103) — `arc-run`, drivers, and `engine/router.yaml`
> v1 are **LIVE** (schema read directly: `models:` tier→driver→model · `tiers:` the four
> ADR-0069 policy names · `classes:` name → {tier, driver, fallback} · `default:`).
> Engine's ADR century = 0200–0299 (0200–0206 taken). **Prereq "engine v1 shipped" =
> MET.**
>
> **Trigger (pull, remaining):** a **receipted need** — a develop Capability Proposal or
> an absorb extraction report concluding **INTEGRATE** (a capability no current driver
> has: browser-native work, messaging-channel presence, long multi-step web tasks), or
> pilot evidence that an external runtime materially beats current drivers on a class
> arc actually runs. No receipt, no kickoff (Constitution A8).

**Goal:** `arc-run --process X --driver <runtime>` executes an arc process on an
external agent runtime (Hermes Agent, OpenClaw, or similar) under the **same contract
as every other driver** — hard budgets, schema-validated output, full `run.completed`
receipts, data-boundary enforcement — so external agents become receipted contract
employees instead of shadow IT.

**Policy-first rule (the router file's own law):** router.yaml's header says a routing
question ADR-0069 doesn't answer is a signal to **amend the ADR, not invent an answer in
the file**. Agent-runtime drivers are exactly such a question. So this kickoff's **first
act** is a one-paragraph amending ADR to 0069 (the engine plan's "trigger-three
amendment" precedent) naming: agent-runtime drivers as a driver class · their action
ceiling (`L1-drafts` until the policy-engine brief wakes) · their pinning rule (EXE-B).

**REQs (measurable):**
1. **Driver shim per ENG-D:** `drivers/<runtime> run <process> <input-json> <budget>` →
   output JSON on stdout · exit map 0/2/3/4/5 honored · answers `--version` (runtime
   version + pinned config hash). Engine's "<1h new-driver stub" north-star is the bar.
2. **Isolation:** the runtime runs with its **own credentials and workspace** — no arc
   repo write access, allowlisted egress, no secrets beyond its own key.
   `internal-only` data routed toward it → **exit 5 refusal**, fixture-proven.
3. **Receipts:** every dispatch emits `run.completed` with the full REQ-05 payload —
   runtime name + version + config hash in the MP-F fingerprint's model seat; absent
   fields stay absent (0069 b(5)). **No new event kinds.** Win-rate per class is then
   derivable from receipts by a reader script (no dashboard — display stays the
   dashboard sleeper's job).
4. **Routing delta (one reviewed diff to the LIVE router.yaml):** runtime rows in
   `classes:` carry three new fields — `cap:` (`L1-drafts` ceiling v1, mandatory on
   runtime rows) · `judge:` (`deterministic|owner` — consumed by A/B scoring; grammar =
   absorb's ABS-D) · `hosted:` (`local|cloud`; `internal-only` data + `hosted: cloud` →
   refuse, exit 5). Missing `cap:`/`data:` discipline on a runtime row → router load
   fails loud naming the row. Runtime rows are born from evidence: row comment cites the
   receipt that justified it. Runtimes take no `models:` entry — they pin via EXE-B, or
   run recorded-as-unpinned exactly like codex/generic-api today.
5. **One real job end-to-end:** the build-in-public **draft** process (draft, not post —
   publishing stays human) runs via the runtime ≥3 times with full receipts. Feeds
   growth's future trigger; does **not** start growth.

**Appetite:** 1 week. **Tier: S/M.**
**Kill criteria:** runtime API/CLI churn eats >2 days → bank the shim as documentation,
note "demand-triggered retry", fall back to existing drivers. Isolation not
fixture-provable → stop; an unprovable boundary is a no.

**Decisions to ADR at kickoff (engine century, next free 02xx):**

| ID | Decision |
|---|---|
| EXE-A | Which runtime first — **exactly one** in v1, chosen by the receipted evidence (criteria: headless invocability · output capture · version pinning · self-hostable). Second runtime = its own trigger |
| EXE-B | Pinning: runtime version + config hash ride the fingerprint; unpinned runtime = recorded as such, and a pin-required class refuses it |
| EXE-C | Long-running semantics: wall-clock budget → timeout = `fail/budget` (exit 3); no fire-and-forget — a dispatch without a collected result is a defect |
| EXE-D | Credentials in env (`.env.example` row), never in repo or runtime skill files; runtime persistent-memory stays **OFF** for arc tasks (state lives in arc receipts, not the contractor's head) |
| EXE-E | The ADR-0069 amendment (policy-first rule above) — drafted and merged before any routing row lands |

**Non-negotiables:** ENG-D contract untouched — the runtime adapts to arc, never the
reverse · emitter/reader discipline · ENG-E ladder inherited exactly (one same-tier
retry → fail loud + proposal receipt; no auto-escalation) · adversarial pass on the
shim's output parser (runtime output is hostile input) · human-started runs only (no
scheduler until that brief wakes; policy engine precedes any L2+ action) · router edits
are reviewed diffs citing ADR-0069 — runtimes never self-register.

**No-gos:** no 24/7 daemon mode · no skill-marketplace installs on the runtime beyond a
vetted pinned list (capability-vet discipline; ClawHavoc/ToxicSkills is the named threat
model) · no L2+ actions v1 (drafts and read-only outputs only) · no second runtime · no
runtime-side cron/webhooks pointed at arc · no messaging-channel bindings v1 (the
runtime is a worker here, not a chat surface) · no auto-updating router (unchanged law).

**Pre-mortem top-3:** (1) prompt-injection through the runtime's browsing surface →
L1-drafts cap + data-boundary + a human reviews every output (it's a draft by
definition); (2) runtime nondeterminism breaks output schema → ENG-E catches loudly;
mock driver keeps CI keyless; (3) upstream churn/abandonment (creator-joins-OpenAI-class
events) → shim is one file; absorb's extraction report already banked the technique
knowledge in-house.

**Open decisions at kickoff:** EXE-A shortlist · which class routes first · whether the
pilot config becomes the pinned v1 config.

**Kickoff prompt:**
```
/arc-kickoff --lane engine executor — agent-runtime driver (the hired hands)
Design source: docs/strategy/plans/BRIEF-executor.md (trigger fired: <the receipted
need — proposal/report/pilot ref>). Engine-lane work under the live ENG-D contract — no
new module, no second routing owner. First act: the one-paragraph ADR-0069 amendment
(EXE-E). REQ-4 lands as ONE reviewed router.yaml diff. Decisions EXE-A..E directional —
finalize, assign numbers from the engine century. Isolation fixtures (exit 5) and the
L1-drafts cap are non-negotiable. STOP after PLAN.md + phase specs for my approval.
```
