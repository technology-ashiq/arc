# Phase 06 — Capability acquisition: find it, pin it, and refuse it by default

**Goal (one line):** when the harness lacks a tool, it finds candidates and reports them — and
nothing enters this repository without a pinned version, a hash, recorded provenance and a read of
the definition itself.
**Appetite:** 0.75 days
**Depends on:** phase-00

Serves **REQ-07** (the scout), **REQ-08** (the vet gate).

## What this phase actually builds

- **`.claude/agents/capability-scout.md`** — triggered, never ambient. Runs when a Build Brief
  declares a capability gap, when a pinned dependency is stale, or on explicit `/arc-capability`.
  Returns a proposal table: need · candidate · source · quality evidence · verdict. **It installs
  nothing** and has no write tools.
- **`.claude/scripts/develop/capability-vet.sh`** — the BLOCK gate (ADR-0110).
- **`capability-lock.json`** — what was admitted, pinned, and on what basis.
- **`.claude/commands/arc-capability.md`** — the explicit entry point.

## The gate refuses by default (ADR-0110)

BLOCK unless **all** hold:

- the candidate is **allowlisted**;
- **version pinned**, with a **hash** and recorded **provenance** in `capability-lock.json`;
- the **fetched** source passes a content scan — exfiltration patterns, `curl`-pipe-`sh`.
  **Fetched, not installed:** `npm install` and `pip install` run lifecycle scripts before any
  scanner sees the code, so vetting uses `npm pack`, a tarball fetch or a clone;
- **write-capability is COMPUTED by static scan, never read from the candidate** — MCP's
  `ToolAnnotations` are hints the spec says never to trust from an untrusted server, and reading
  them means running it. An inconclusive scan (compiled binary, opaque layer) means write-capable;
- and if it is write-capable, Ashiq's OK is recorded.

Hash and provenance are read from the **underlying package registry** — npm `dist.integrity`,
PyPI `digests.sha256`, an OCI digest — never from the MCP registry, whose `server.json` carries a
hash only for MCPB packages. Skills publish no version or hash at all in their format, so for a
skill "pinned" means a git commit SHA. Provenance is **two separate fields, never one boolean**:
who may publish under the name, and which CI built the artifact.

Existence-verification is recorded, and its limit is recorded with it: **it does not defeat
slopsquatting.** The attacker registers a real package under the hallucinated name, so an existence
check passes it by design — that is why it was registered. The **allowlist** is the control that
stops that; existence only defeats a name resolving to nothing.

**Stars, downloads and repo age may be displayed as context and can never be a pass criterion.**
Popularity measures adoption, and adoption is what a supply-chain attack manufactures.

> **This phase's research finding governs its scope.** A researcher checked what the skills and MCP
> ecosystems actually publish. If a condition above cannot be enforced from published data, the
> honest response is to refuse the capability, **not to soften the gate** — a gate that passes
> everything reads as safety and provides none. The assumption ledger carries this and this phase
> tests it.

## Exit criteria (Definition of Done)

- [ ] `/arc-capability <need>` returns a proposal table and writes nothing outside its report
- [ ] `capability-vet.sh` BLOCKs a candidate missing any one of: allowlist, version, hash,
      provenance, clean content scan — asserted **once per missing condition**, not once in total
- [ ] a write-capable candidate BLOCKs without a recorded human OK, and passes with one
- [ ] the content scan catches a planted exfil pattern and a planted `curl | sh` — separate fixtures
- [ ] **write-capability is computed, and an unreadable candidate is treated as write-capable** — a
      fixture whose source cannot be scanned must route to the human-OK path, not pass
- [ ] a candidate whose own manifest claims `readOnlyHint: true` while its source writes files is
      still classed write-capable — the self-report never overrides the scan
- [ ] a candidate that does not exist is refused at the existence check, before anything else runs
- [ ] **the vet script never installs** — asserted: a fixture with a hostile `postinstall` is
      fetched and scanned without that script ever executing
- [ ] **a REAL candidate is vetted, and not installed** — the madge / dependency-cruiser gap
      Cycle 5 recorded as debt is run through the gate for real: actual published version, actual
      hash, actual provenance, actual content scan, written to `capability-lock.json`. Vetting is
      not installing (ADR-0110 separates them), so arc gains a lock row and **no dependency**. This
      is the only thing that tests assumption row 5 instead of asserting it, and it is what stops
      the gate being a rubber stamp proven on a candidate built to pass it
- [ ] `capability-lock.json` records version, hash, provenance and the date checked; staleness past
      30 days is reported
- [ ] every BLOCK has a negative control proving it can fail, and a matched fixture that must PASS
- [ ] the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
- [ ] `products/develop/manifest.json` lists `capability-vet.sh` under `scripts`,
      `arc-capability.md` under `commands` and `capability-scout.md` under `agents` — Cycle 5's CI
      caught exactly this omission when a script shipped without its manifest entry
- [ ] root `CLAUDE.md` gains `/arc-capability` in its `## Commands` list — a new top-level entry
      point that is absent by construction until something adds it
- [ ] tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats over
`capability-vet.sh` against committed candidate fixtures — one clean, and one per refusal condition
— plus the planted-hostile-content fixtures. **The bats suite is entirely offline** and CI never
reaches a registry: the fixtures are local files. The one REAL candidate the exit criteria require is
fetched and vetted **once, by hand, outside bats and outside CI**, and its `capability-lock.json` row
is committed as the artifact rather than re-fetched — a 19-job 3-OS matrix hitting a live registry on
every push is precisely the flakiness this repo's zero-dep stance refuses.

## Rabbit holes in this phase

- **Building a package manager.** The scout reports; the gate refuses; installing is a separate
  human act. Nothing here downloads and runs anything.
- **A trust score.** Five mechanical conditions, each pass or fail. No composite.
- **Chasing every registry.** The scout reports what it can verify and says plainly what it could
  not — an unknown is a finding, not a gap to fill with plausible detail.
- **Making the content scan a real analyser.** A pattern list is a floor. ADR-0110's revisit trigger
  is a candidate that passes it and is still hostile.

## Out of scope for this phase

- Actually installing anything.
- A capability that writes — the gate handles it, but this cycle admits none.
- Re-vetting existing arc tooling; this gate governs what arrives from outside.

## Your-setup / pending

**One thing from Ashiq:** the initial allowlist. An empty allowlist means the gate refuses
everything, which is the correct default and also means nothing can be admitted until you name
what may be.

**Tripwire:** at 0.6 days — 0.15d before the 0.75d appetite is spent, ship the vet gate and the lockfile and cut the scout agent. The gate is
the control; the scout is convenience, and a scout without a gate is the dangerous half.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.
