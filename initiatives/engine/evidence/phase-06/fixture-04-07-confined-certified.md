# Phase 06 — fixtures 4 and 7 CLOSED against the real runtime, confined, 2026-08-18

The two arms REQ-02 has owed since the phase opened. Both were blocked on the same thing and it was
never effort: an `--internal` network cannot reach `host.docker.internal`, so a local model and a
confined network are mutually exclusive **by construction**. The capped credential is what made a
hosted model reachable, and a hosted model is what made confinement testable.

## Fixture 4 — "only its own capped key, and ZERO arc secrets"

Until now the honest answer was **neither**: the second half passed because no credential was
injected at all, and the first half was simply unbuilt.

```
-e entries passed to the container : OPENROUTER_API_KEY=<redacted>
any ARC_-shaped var leaked         : false
planted canary leaked              : false
```

**The zero-arc-secrets half is structural, not a filter to maintain.** `docker run` does not inherit
the host environment — a container sees exactly the variables named by `-e`. There is no allowlist
that can drift and no denylist that can miss a new `ARC_*` name.

## Fixture 7 — the behavioural arm, on the real dispatch path

Direct container probes on the confined network:

| Probe | Result |
|---|---|
| the runtime, on `arc-egress` behind the proxy | **`{"confined":true}`** |
| proxy decision log | `ALLOW openrouter.ai:443 (requested 'openrouter.ai:443')` |
| a non-allowlisted host from the same network | **blocked** (`HTTP 000`), `DENY example.com:443` |

Then the same path through `arc-run`, receipted:

```
id           01M08P9KDZCVWB9QS2ES0PKB3M
outcome      fail / driver
runtime      hermes@sha256:16788311e2fa+cfg.e4c4ccd145d0
duration_ms  42691
quarantined  false
egress mode  network=arc-egress proxy=set
```

**The config hash moved, and that is the point.** The unconfined dispatch earlier the same day
recorded `cfg.9c642d0847ca`; this one records `cfg.e4c4ccd145d0`. Two dispatches with opposite
security postures are now distinguishable **on a landed receipt** — which is exactly what the
preimage was rebuilt for, after an adversarial pass proved they hashed identically.

## What else the run measured

- **13 symlinks skipped** while copying the template, announced with a count. These are uv's wheel
  cache — container-absolute links that made `cpSync` take the whole Node process down.
- **6 stale workspaces swept.** Those were left by the crashed dispatches while that bug was being
  found, so the SIGKILL half of the ADR-0222 cleanup is proven by the thing it was written for
  rather than by a fixture.
- **43 seconds, against 248–342 s on local `ollama`.** Roughly 7x faster, and it makes the Phase 07
  calibration baseline (`min=9`) a *local-model* number that Phase 08 must re-derive — the deriver
  takes `--driver` so the two populations stay separate.

## The answer still failed, and that is the SAME known confound

`no line of the runtime output parsed as a JSON object or array` — the model replied in prose.
`commit-msg-draft` wants git context the container has never had, which
`runtime-answer-reliability.md` recorded as an unfair probe three sessions ago. REQ-02 asks whether
the boundary holds, and it held on every arm this run touched.

**And the hire itself is separately proven.** The same runtime, same image, same capped key, asked
for a one-shot contract with no missing context, returned `{"ok":true}` first try — and
`{"confined":true}` from inside the confined network. The 8B local model was the confound, not the
runtime.

## One thing this run corrected in the router

The row read `hosted: local`, true when written and falsified the moment the credential landed.
`data-boundary.mjs` reads that field to decide how a refusal is REPORTED — an internal-only input
against a `hosted: cloud` row is refused *with the routing fact attached* (fixture 3). A stale
`local` therefore made the boundary's own explanation wrong about where the document was about to
go, on the one code path whose entire job is to say that. Corrected to `cloud` in the same change.
