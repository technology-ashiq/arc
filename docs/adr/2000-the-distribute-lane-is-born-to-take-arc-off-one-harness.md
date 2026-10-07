# ADR 2000 — The `distribute` lane is born to take arc off one harness

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** the day-4.5 kill checkpoint (end of Phase 01) answers NO. A planted hook-only blocking rule is not refused on the merge path of the real repository with no harness running. The cycle then STOPs with that finding recorded, and no adapter ships.

## Context

On 2026-10-07 the owner ruled: *"arc Claude-la mattum thaan use panra maari iruku — atha global aakanum: ChatGPT, Kimi, Ollama, DeepSeek, Hermes, OpenCode… market-la iruka ella tools layum work panra maari."* This is the second time the gap has been named. On 2026-08-12 the ECC study found `.codex/` to be a never-installed 23% copy and proposed this lane, and the Build-out Mandate queue then put other lanes ahead of it. The design source `docs/strategy/plans/PLAN-distribute.md` (v1.2, owner-reviewed twice on 2026-10-07) splits the ask into a **model** seat, which is already solved (drivers, router, model-policy v2 profiles), and a **harness** seat, which is the gap. The harness seat has two parts: rendering the Claude dialect for other harnesses, and moving the truth of the blocking gates to the repository's merge path.

## Options considered

1. **Keep arc Claude-only** — no work. But the owner's ruling is explicit, and `.codex/` keeps lying in the meantime.
2. **Kick off now, gates before adapters** — every later phase reads a declared matrix, and no second harness gets arc before arc's rules hold at merge-time.

## Decision

Option 2, under the locked decisions DST-A…K (ADR-2001…2011). DST-L is answered in ADR-2012 and DST-M in ADR-2013. Phase 00 records the ruling on the spine, and every 20xx ADR cites that receipt.

## Consequences

ADR century 2000–2099 is claimed. The sweep on 2026-10-07 covered 17 worktrees and 272 remote-tracking branches, and none held an ADR numbered 2000 or above (highest found: `1916`). No external consumer is claimed (the design source's honesty note). The lane's falsifiable claims are mechanical: REQ-01, REQ-02, REQ-03 and REQ-09.

Receipts: pending. They are emitted from the main clone after the birth PR merges (a worktree's spine refuses emits). The ruling `approval.requested` id and the owner's `decision.recorded` id are written here at the Phase 00 close.
