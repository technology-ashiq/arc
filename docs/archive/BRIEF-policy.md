# BRIEF — policy engine (capability vectors, enforced)

> **Trigger (pull):** ≥3 action kinds running at ≥L2 (real autonomy exists to police),
> OR the first scheduler lands (headless runs need machine-checked permissions).
> **Prereqs:** spine + inbox + trial-ledger promotion culture. Until this exists, policy
> lives as human discipline + per-module caps — that is fine at small scale.

**Goal:** `hq.policy.yaml` becomes enforced law — per action-kind capability vectors
(read/write/shell/network/message/publish/deploy/spend × L0–L3) checked at the runner
wrapper (headless) and PreToolUse hooks (interactive), deny-by-default, with promotions
via trial-ledger evidence and auto-demotion on incident.

**REQs (measurable):**
1. Policy file schema + policy-lint (hostile fixtures: unknown capability, contradictory
   grants, missing kind → exit 2; adversarial pass — this is parser-class AND
   security-class).
2. Enforcement: a headless run attempting an act outside its vector is BLOCKED and events
   `incident.raised` — fixture per capability class (write/shell/network/message/spend).
3. Deny-by-default proven: an action kind absent from the file can do nothing but read —
   fixture.
4. Promotion/demotion as events: level changes only via recorded decisions (human, with
   trial-ledger citation); incident → automatic one-level demotion within the same run —
   fixture-proven.
5. Money guard: `spend` capability enforced against per-day caps summed from spine events
   (not per-run memory) — a second run cannot double-spend the day's cap, fixture-proven.
6. Migration: existing per-module caps (leads sends/day etc.) move INTO the policy file —
   one source of truth (A5), zero behavior change proven by the modules' own fixtures.

**Appetite:** 1 week. **This is security-critical — the adversarial pass gets 2 full days.**
**Phases sketch:** 0 schema + lint + adversarial → 1 runner-wrapper enforcement + fixtures
per class → 2 hook-side (PreToolUse fragment) + promotion/demotion events → 3 migrate
existing caps + real week + retro.

**Non-negotiables/no-gos:** deny-by-default, no wildcard grants · Constitution E2 list
hardcoded un-grantable (pricing/refunds/real-trading/kills/name-publishing can NEVER
appear at >L1 — lint rejects the file itself) · enforcement in code paths that agents
cannot bypass (wrapper + hooks, not prompts) · no RBAC/multi-user ambitions · no network
policy beyond domain allowlists v1.

**Pre-mortem top-3:** (1) a bypass path exists (agent shells around the wrapper) →
enforcement at the ONLY execution entry points + hooks; red-team fixtures try bypasses
explicitly; (2) policy file drifts from reality → migration REQ-6 makes it the single
source; (3) demotion never fires → fixture proves the incident→demote path.

**Open decisions at kickoff:** vector granularity for network (domains vs categories) ·
cap accounting windows (calendar vs rolling day).

**Kickoff prompt:**
```
/arc-kickoff policy engine — enforced capability vectors
Design source: docs/strategy/plans/BRIEF-policy.md (trigger: <L2 kinds / scheduler>).
Expand to full PLAN; deny-by-default + E2-ungrantable + bypass red-team are locked.
Security-class: adversarial pass budget is 2 days minimum. STOP after PLAN + specs.
```
