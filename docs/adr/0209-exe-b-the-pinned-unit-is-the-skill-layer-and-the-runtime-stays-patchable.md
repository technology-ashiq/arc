# ADR 0209 — EXE-B: the pinned unit is the skill layer, and the runtime stays patchable

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** two-way
**Revisit trigger:** a runtime auto-update changes observable behaviour mid-cycle — at which point the version becomes part of the pin and the tradeoff below is re-argued with that receipt in hand.

Decided under the owner's **Build-out Mandate (2026-08-09)**.

## Context

The design source's EXE-B pins "the runtime install + config + vetted skill/plugin list + its
egress/network settings" as one unit, lockfile-hash style. That instinct is right about *what*
carries risk and wrong about *which part to freeze*, and the difference matters because the two
halves have opposite failure modes.

The skill layer is where the attacks have actually landed. ClawHavoc mass-uploaded roughly 1,184
trojanised skills to an agent marketplace whose publish bar was one file and a week-old account;
Snyk's ToxicSkills audit of 3,984 skills found 36.82% carrying a security flaw, 13.4% critical, and
91% of the confirmed-malicious ones pairing code malware with prompt injection embedded in the
skill's own description. Eight confirmed-malicious skills were still live at publication.

The runtime binary is where the *patches* land. This runtime class ships security fixes fast — a
localhost WebSocket authentication bypass in a sibling project was patched inside 24 hours — and
freezing the binary means declining those fixes.

## Options considered

1. **Freeze everything** — runtime binary, config and skills at one hash. Maximum reproducibility;
   silently declines gateway and authentication patches, which is where the severe bugs are.
2. **Freeze nothing, record everything** — fingerprint what ran, pin nothing. Honest receipts, zero
   supply-chain control over the layer that is actually attacked.
3. **Pin the skill layer by fetched hash; keep the runtime on security updates and record its exact
   version on every receipt.**

## Decision

**Option 3.** The pinned unit is the **vetted skill/plugin list, pinned by a hash the repository
fetched itself**, plus the runtime's **configuration file and its egress/network policy**. The
runtime binary is **recorded, not frozen**: its exact version and a hash of its pinned config ride
the MP-F model seat on every `run.completed` receipt (ADR-0212), which is what model policy needs —
a record, not a freeze.

**This reuses the existing mechanism instead of building a second one.** `.claude/scripts/develop/`
already holds `capability-vet.sh`, `capability-allowlist.txt` and `capability-lock.json`, governed by
**ADR-0110** (`docs/adr/0110-capability-vetting-blocks-on-provenance-not-popularity.md`), which
already decides every hard part: BLOCK unless allowlisted; hash and provenance read from the
underlying package registry and never from the candidate's own repo; for a skill, "pinned" means a
**git commit SHA** because skills publish no version or hash in their own format; two provenance
fields kept separate; the source **fetched, not installed**, because `npm install` and `pip install`
run lifecycle scripts before any scanner sees the code; write-capability **computed** by static scan
with inconclusive defaulting to write-capable; and a 30-day staleness re-check. A runtime's skill is
the same shape of untrusted input as an MCP server, and a parallel vetting path would drift from
this one.

The allowlist currently holds exactly one entry (`madge`). Admitting the runtime and any skill it
needs is therefore a **visible, reviewed act with the owner's OK recorded**, which is the control
working rather than an obstacle.

**Evidence:** ClawHavoc and ToxicSkills verified against primary sources —
[Koi Security](https://www.koi.ai/blog/clawhavoc-341-malicious-clawedbot-skills-found-by-the-bot-they-were-targeting) ·
[Unit42](https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/) ·
[Snyk](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/), all fetched 2026-08-12.
Hermes Agent independently ships `skills/.hub/lock.json` recording source, trust level, scan verdict,
**SHA-256 content hash** and file list, quarantining on hash mismatch — convergent evidence that
hash-pinning the skill layer is the right unit. ADR-0110 read in full before relying on it.
**Confidence:** high on the skill layer being the attacked surface; medium on keeping the runtime
unfrozen, which is a live tradeoff rather than a settled one.
**Rejected because:** freeze-everything — trades supply-chain stability for missing fast patches to
gateway and authentication bugs, which is the worse of the two risks for a young, fast-moving
codebase. Freeze-nothing — leaves the one layer with a documented mass-compromise uncontrolled.

## Amendment, 2026-08-12 (pre-approval, from the runnability recon)

A reconnaissance pass against the vendor's own release API found something this decision has to
account for: **tag `v2026.8.3` carries `"assets": []`.** Nothing is attached to it. The release notes
for that very version record that the **npm and PyPI channels were retired**, and `install.ps1` /
`install.sh` are **not tracked files** in the repository tree at that tag — they are served
dynamically from the docs site and default to installing *latest*, not the pinned tag.

So the ordinary pin has nothing to grip. There is no registry entry whose `dist.integrity` or
`digests.sha256` can be read the way ADR-0110 requires, and a `curl`-piped installer fetched live from
a website is the single worst install shape available for a runtime with a contested security record —
it is the exact "fetched, not installed" hazard ADR-0110 was written about, one layer earlier.

**The runtime is therefore obtained as a container image, and the image digest is the pin.** A digest
is content-addressable by construction: it is the one handle this vendor offers that names an exact
artifact rather than a moving label. The exact image reference is read from the vendor's current
documentation at install time and **recorded** in Phase 04's `install-method.md` alongside the
resolved digest, in the same read-it-and-write-down-what-you-ran discipline the rest of that phase
uses. This also removes the host from the blast radius entirely, and it converges with ADR-0208's
container-backed requirement instead of sitting beside it.

The host PowerShell installer is **not** used. If the container channel turns out not to exist for
this runtime, that is an EXE-A finding and it fires the Phase-04 STOP — an unpinnable runtime is
refused by a pin-required class, which is this ADR's own rule applied to the runtime itself.

## Consequences

**Easier.** No new vetting mechanism, no second lockfile format, no parallel allowlist. The runtime
keeps receiving security patches. `capability-lock.json` gains rows and stays the single source of
truth for what this repository has admitted.

**Harder.** An unfrozen runtime means a receipt's runtime version can differ between two runs in the
same cycle, so comparisons must read the fingerprint rather than assume it. A pin-required class
refuses an unpinned runtime, and "unpinned" must be recorded as such rather than silently tolerated.
The 30-day staleness re-check now has a second consumer and will fire on this hire.
