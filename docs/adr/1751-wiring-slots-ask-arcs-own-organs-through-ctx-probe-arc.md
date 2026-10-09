# ADR 1751 — the wiring slots ask arc's own organs through `ctx.probe.arc`, answered by the runner

**Status:** accepted
**Date:** 2026-10-09
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a wiring slot needs to write to arc (a real passport, a face seat), or a second question joins the
four

## Context

ADR-1711's wiring block is `passport`, `ledger-source`, `face-room` and `teardown-plan`. Their exit criteria are facts
about arc, not about the venture: a dry-run output, a first ingest receipt, the face contract, a rendered exit. An
adapter reaches the world only through ctx, so it can read none of arc's files (ADR-1704, ADR-1715). The kickoff rows
named the venture domain as their host, which none of them needs.

## Decision

- ctx gains `probe.arc(question)`. The worker builds the answers (`lib/arc-probe.mjs`), fresh from arc's tree or
  spine on every call. Only a slot whose catalog `group` is `wiring` may ask; any other slot gets
  `ARC_PROBE_REFUSED`. The four questions:
  - `ledger`: the venture's revenue events on the spine (count, first id, kinds).
  - `passport`: `venture-register --dry-run` with the profile's `kill_lines` and `repository`. Answers the exit code,
    the digest line and the last line of both streams.
  - `face`: where the face contract seats the venture: the ventures room, a planned room, or nowhere.
  - `teardown`: the ordered exit rendered from the board, with its count of recorded resources.
- The four adapters create nothing. Each verify is one question, and the answerer it names is arc's (`arc spine`,
  `arc venture-register --dry-run`, `arc face contract`, `arc teardown render`). The rows keep a host so the lint's
  non-empty rule holds, and their scope says no network is used.
- arc-sandbox's profile gains `repository` and `kill_lines` (90 days without revenue, a 100 monthly traffic floor),
  the inputs a passport needs.

## Consequences

- Two of the four depend on owner acts outside launch. The passport dry run refuses until `ventures.yaml`'s criteria
  receipt is approved. The face seat is the face lane's contract edit, so a rehearsal venture stays unseated unless
  the owner rules where it sits.
