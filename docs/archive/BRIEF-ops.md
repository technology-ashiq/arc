# BRIEF — ops v1 (keep-it-running engine)

> **Trigger (pull):** ≥2 live ventures make manual checks painful, OR support volume >
> ~5 tickets/week. **Prereqs:** spine + inbox; /arc-canary already exists (extend, don't
> duplicate — Constitution A5).

**Goal:** the boring guardian — scheduled-able health sweeps across all ventures, support
inbox triage with drafted replies (L1), incidents as first-class events, and a weekly
per-venture health report rendered from the spine.

**REQs (measurable):**
1. `arc ops sweep` checks every registered venture (uptime, cert, error-page, checkout
   alive) in one run; failures → `incident.raised` events with evidence; sweep is
   idempotent (re-run ≠ duplicate incidents — supersedes discipline).
2. Support triage: inbound (mail export/file-drop v1) classified (bug/billing/question/
   angry) → reply DRAFTS in inbox with the relevant context attached; nothing auto-sends.
3. Incident loop: raise → acknowledge → resolve, all events; unresolved >24h surfaces in
   the brief's needs-you group automatically.
4. Weekly health report per venture (uptime %, incidents, tickets, canary history) —
   generated from the spine reader only, ≤1 screen each.
5. One real week guarding ≥2 ventures; every incident that week traceable end-to-end.

**Appetite:** 1 week.
**Phases sketch:** 0 sweep runner (extends arc-canary; adapters per venture) → 1 incident
events + brief integration → 2 support triage + drafts → 3 real week + retro.

**Non-negotiables/no-gos:** extend arc-canary, never fork it · reader-only spine access ·
support replies L1 (drafts) until trial-ledger promotes · no PagerDuty-class alerting
infra (the brief + inbox ARE the alerting) · no auto-remediation v1 (report, don't touch)
· venture creds in their own env files, never centralized plaintext.

**Pre-mortem top-3:** (1) sweep false-alarms train Ashiq to ignore it → tune thresholds +
supersedes discipline, alert quality is a REQ not a hope; (2) support drafts wrong-tone →
tone rules in the triage prompt + human send; (3) ops becomes a monitoring-tool hobby →
no-gos + appetite cap.

**Open decisions at kickoff:** support inbound path (mail export vs forward) · sweep
cadence · per-venture check list.

**Kickoff prompt:**
```
/arc-kickoff ops v1 — keep-it-running engine
Design source: docs/strategy/plans/BRIEF-ops.md (trigger: <N> live ventures / support
volume). Expand to full PLAN; extend arc-canary per the brief; REQs/no-gos locked.
STOP after PLAN + specs for my approval.
```
