# ADR 0215 — EXE-H: the trail is the artifact, and drafts are scanned like logs

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** a stored transcript is found to contain a secret shape `DENY_RULES` has no rule for — the scrubber is then the thing that needs work, not the storage policy.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

A human reviewing a runtime's draft is reviewing the wrong artifact if the draft is all they see.
**Injection shows in trails, not in drafts.** A compromised run produces a perfectly reasonable draft
and a transcript full of tool calls to somewhere it should not have gone. Review the draft alone and
the draft looks fine — which is exactly what a successful attack looks like.

The threat research made this concrete and named the gap the rest of this cycle does not close: a
prompt-injected runtime holding network access can exfiltrate through a side channel *during*
generation — a crafted outbound URL, a rendered image reference, data encoded in DNS subdomains —
**that never appears in the draft the human reviews at all.** Drafts-only and human-reviewed protect
against bad visible output; they do not protect against unauthorised side effects while the output is
being made.

## Options considered

1. **Store the draft only.** Cheap; blind to the failure mode above.
2. **Store the raw transcript.** Complete; stores whatever secrets the run touched, forever, in an
   append-only tree.
3. **Store a scrubbed transcript per dispatch, lane-scoped, and review draft plus trail together.**

## Decision

**Option 3.** Every dispatch stores a **scrubbed transcript** as lane-scoped evidence under
`initiatives/engine/evidence/phase-NN/` (ADR-0055). Human review reads the **draft and the trail**,
not the draft alone.

The scrub reuses the spine's own `scanSecrets()` and `DENY_RULES` from
`.claude/scripts/hq/lib/redact.mjs` (14 rules) rather than a second scanner that would drift from it.
**The scan runs on the runtime's outputs — the drafts — as well as on its logs**, because a draft is
an artifact the runtime authored from data arc handed it, and a leaked key does not care which file
it lands in. Every artifact class is covered: stdout, transcript, cost sidecar, spine payload.

The fixture plants three keys matching live `DENY_RULES` and asserts they appear in **no** artifact,
**with a negative control proving the check can fail** — an absence-only pass is not a pass
(retro-log 2026-07-30).

**What this does not do, stated plainly:** storing a trail is detection, not prevention. It makes a
side-channel exfiltration *findable after the fact*; it does not stop it. The only real mitigation is
egress control at the container/proxy layer, which is why ADR-0208 commits to a container-backed
backend, and why certification fixture #7 verifies the live egress configuration against its pin
rather than trusting a policy key. The residual risk that survives all of it is recorded in the
pre-mortem rather than argued away.

**Evidence:** the side-channel gap is the load-bearing finding of the threat research, corroborated
against [Meta's Agents Rule of Two](https://ai.meta.com/blog/practical-ai-agent-security/),
Simon Willison's lethal-trifecta framing, and OWASP's 2026 LLM Top 10, which keeps prompt injection at
#1 for a third year and reframes the goal as blast-radius control rather than prevention.
**Confidence:** high.

## Consequences

**Easier.** absorb inherits real study material for free — transcripts of a contractor doing a job are
exactly what a technique-internalisation cycle needs. And a suspicious draft has a trail to check it
against instead of a judgement call.

**Harder.** Evidence volume grows per dispatch, and a scrubbed transcript is still a document that
records what arc knows — it is lane-scoped and it is not published, but it exists. Reviewing a trail
takes longer than reading a draft, which is a real cost against the batching in ADR-0214 and is the
honest price of the failure mode it catches.
