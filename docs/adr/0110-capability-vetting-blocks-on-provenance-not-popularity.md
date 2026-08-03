# ADR 0110 — Capability vetting BLOCKs on provenance, never on popularity

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** two-way
**Revisit trigger:** a candidate that passes every provenance check is later found malicious — the
content scan then needs to become a real static analysis, not a pattern list.

## Context

The capability scout searches live ecosystems — skills registries, the MCP registry, community
agent definitions — and proposes things to install. That is an untrusted-input path into this
repository, and it is the one place in arc where a mistake is not merely wrong but hostile.

Two failure modes matter and they are not the same. **Slopsquatting**: a package name that does not
exist, invented by a model, registered by someone else. And **a real package that does something
extra**: exfiltration, `curl | sh`, tool scopes it never declared.

Stars, downloads and repo age are the metrics closest to hand and they answer neither. A popular
package is a package many people installed before anyone checked.

## Options considered

1. **Popularity thresholds** (stars, downloads, age) — easy to compute, and rejected: it measures
   adoption, not safety, and adoption is exactly what a supply-chain attack manufactures.
2. **Human review of every candidate** — safe and unscalable; it also puts the judgement at the
   moment of least patience, which is when the tool is wanted.
3. **Provenance + pinning + content scan, BLOCK by default** — mechanical checks that answer the
   two failure modes directly.

## Decision

Option 3, **as corrected by the research below** — the first draft of this decision was wrong in
one load-bearing way and imprecise in three others. `capability-vet.sh` BLOCKs unless **all** hold:

- the candidate is on the **allowlist**;
- its version is **pinned**, and its **hash** and **provenance** are read from the **underlying
  package registry, never from the MCP registry or the candidate's own repo**: npm's
  `dist.integrity`, PyPI's `digests.sha256`, or an OCI digest. `server.json` carries a hash only
  for MCPB packages; a plain npm/PyPI/OCI entry has none, so a gate trusting `server.json` alone
  would pass unhashed code. Skills publish no version or hash at all in their format — for a skill,
  "pinned" means a **git commit SHA**;
- **two provenance fields, recorded separately and never collapsed into one boolean**:
  `publisher-auth` (the MCP registry's namespace authentication — who may publish under this name)
  and `build-attestation` (npm/Sigstore — which CI built this artifact). They answer different
  questions and most packages have only the first;
- the fetched source passes a **content scan** — exfiltration patterns, `curl`-pipe-`sh`, undeclared
  behaviour. **Fetched, not installed:** `npm install` and `pip install` run lifecycle scripts
  before any scanner sees the code, so vetting uses `npm pack`, a direct tarball fetch or a clone;
- **write-capability is COMPUTED, never read from the candidate.** See below;
- and if it is write-capable, Ashiq's OK is recorded.

### Write-capability is computed, and silence means yes

The first draft said "undeclared tool scopes", assuming a manifest declares them. **It does not.**
MCP's `ToolAnnotations` (`readOnlyHint`, `destructiveHint`) exist, but the specification states
plainly that they are hints, are *"not guaranteed to provide a faithful description of tool
behavior"*, and that clients *"should never make tool use decisions based on ToolAnnotations
received from untrusted servers"* — and in practice they appear only in a live `tools/list`
response, so reading them means running the server first. Skills have no scope field whatsoever.

So the gate **static-scans the fetched source** for filesystem writes, subprocess spawns and
outbound network calls, and **defaults to write-capable whenever the scan is inconclusive** — a
compiled binary, an opaque Docker layer, anything it cannot read. An absence of red flags is not a
pass. This is the same principle as the popularity rule one paragraph down, applied to the
candidate's own self-report.

### Existence-verification does not defeat slopsquatting — the allowlist does

The first draft implied it did. It does not, and the distinction matters: a slopsquatting attacker
**registers a real package under the hallucinated name**, so an existence check passes it with
flying colours — that is the entire point of registering it. Existence-verification defeats a
name that resolves to nothing. The **allowlist** — a known-good name decided in advance rather than
discovered live — is what defeats a name that resolves to the attacker.

**Stars, downloads and repo age may be shown as context and can never be a pass criterion.** The
lint blocks any capability used without a PASS row. **Staleness is re-checked after 30 days**, and
that re-check is load-bearing rather than housekeeping: `postmark-mcp` behaved correctly for 15
versions and shipped an email-exfiltrating BCC on v1.0.16. Pinning protects against the version you
pinned changing; only re-checking protects against the next version.

**Evidence:** MCP Registry docs — About, Package Types, Authentication (preview, checked 2026-08);
`registry/docs/reference/server-json/draft/server.schema.json`; MCP Specification 2025-06-18 §Tools
and `schema/2025-06-18/schema.ts` (`ToolAnnotations`); `modelcontextprotocol/mcpb` `MANIFEST.md`;
npm Docs "Generating provenance statements"; `registry.npmjs.org/left-pad/latest` and
`pypi.org/pypi/requests/json` (both fetched live, `dist.integrity` and `digests.sha256` confirmed
present); `github.com/anthropics/skills` and agentskills.io for the SKILL.md required-frontmatter
set. Incidents: Snyk / The Hacker News / The Register on `postmark-mcp` (three independent reports,
Sept 2025); Snyk "ToxicSkills" audit of 3,984 skills (13.4% with a critical issue, 76 confirmed
malicious); USENIX Security 2025 on package hallucination; Cloud Security Alliance and Aikido on
live slopsquatting cases (`unused-imports`, `react-codeshift`).
**Confidence:** high on the four enforceable conditions and on the write-capability gap — both were
verified against primary specs and live registry responses, not inferred.
**Rejected because:** popularity thresholds measure adoption, which supply-chain attacks
manufacture; per-candidate human review puts the judgement at the moment of least patience.

## Consequences

Easier: the decision to admit a capability becomes reviewable after the fact, because the lockfile
records what was admitted and on what basis.

Harder: legitimate small capabilities with thin published metadata will fail the gate. That is the
gate working — assumption row 5 in the Cycle-6 plan tests exactly this, and if it fires the answer
is to refuse the capability, not to soften the check.

What we would revisit if this goes wrong: a pattern list is a floor, not an analysis. If something
passes it and is still hostile, the content scan becomes real static analysis of the definition.
