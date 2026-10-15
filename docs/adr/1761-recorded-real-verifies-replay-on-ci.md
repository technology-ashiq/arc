# ADR 1761 — Recorded real verifies replay on CI, redacted at a refusing gate

**Status:** accepted
**Date:** 2026-10-14
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** an adapter's verify changes the requests it makes. Its recording no longer matches and the replay
test names the unmatched request, so the slot is re-recorded from arc-sandbox.

## Context

REQ-03 and the Phase 01 Definition of Done ask for every Phase 01 adapter's recorded real response, redacted, to
replay through its real code path on CI. The fakes were corrected to what the real providers answered on arc-sandbox,
but a fake is our model of a provider, not the provider's own answer. The arc repo is public, while a real answer names:

- private resources: the Supabase project ref and organisation, Vercel ids, the owner's other projects in a listing;
- secrets: the service and anon keys, session cookies, magic-link tokens;
- the owner: name and address.

## Decision

- **Record.** The verify-mode worker records every exchange `ctx.fetch` makes when the operator sets
  `ARC_LAUNCH_RECORD` to a directory outside any repo. A record holds the method, URL, status, headers, `Set-Cookie`
  and body, with the inputs verify ran on (profile, resources, upstream) and its answer. Apply mode never records.
- **Redact.** `tests/launch/replay/redact.mjs` turns raw records into the committed fixtures:
  - every value from the private env file is masked, keeping its shape;
  - so is every token shape, every session cookie and every magic-link token;
  - the venture's Supabase ref, taken from what launch recorded, never from the hosts an answer names, becomes the
    fixture ref;
  - Supabase organisation ids, Vercel ids, uuids and 32-hex ids are numbered, the same everywhere;
  - a listing keeps only the venture's own project or domain;
  - profile fields no probe reads are dropped, and every address outside the venture's probe users becomes a
    placeholder.

  The pass **writes nothing** when a known private value survives.
- **Replay.** `tests/launch/replay/replay.mjs` runs the adapter's own `verify()` with `ctx.fetch` answered from the
  record, in order, by method and URL. The clock is frozen at the recording time, and waits do not wait. A request the
  record does not hold is answered 599 and named.
- **Gate on CI.** `launch-contract.bats` replays all 16 Phase 01 slots and asserts each replay passes, the recording
  passed, at least one exchange was used and nothing was unmatched. The same file runs `scan.mjs` over the
  recordings, together with a negative control: a planted token, project ref and address must fail it.

## Consequences

A provider changing its answer shape shows up on the next re-record, not on CI. A probe changing its requests fails
CI at once. The recordings are 16 files of about 750 KB. Re-record after a Phase 01 adapter's probe changes, using
the branch runner with `ARC_LAUNCH_RECORD` set, then run `redact.mjs` and `scan.mjs`.
