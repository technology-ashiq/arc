---
description: Find a tool the harness lacks, and vet it. Reports and refuses — it never installs.
argument-hint: <what you need> | --vet <dir> | --audit
---

# /arc-capability

Two halves, and the order matters. The **scout** finds candidates and writes nothing. The
**gate** refuses by default. Between them sits you, because admitting something into this
repository is a decision and not a step.

**This command installs nothing, ever.** Not the scout, not the gate, not a "just to inspect it"
shortcut. `npm install` and `pip install` run lifecycle scripts before any scanner sees the
code, so vetting fetches (`npm pack`, a tarball, a clone) and reads the result as data. If you
decide to install something afterwards, that is your hands on the keyboard, deliberately.

## `/arc-capability <what you need>` — scout

Dispatch the `capability-scout` agent (Task `subagent_type: capability-scout`) with the stated
need. It returns one table — need · candidate · source · quality evidence · verdict — and it has
no write tools.

Read the table yourself before acting on it. Two cells are the ones that matter and neither is
popularity: whether an integrity **hash** is published, and whether **namespace authentication**
exists. `unknown` in either is a finding, not a formality.

## `/arc-capability --vet <dir>` — the gate

```bash
bash .claude/scripts/develop/capability-vet.sh \
  --candidate <dir> \
  --allowlist .claude/scripts/develop/capability-allowlist.txt \
  --lock .claude/scripts/develop/capability-lock.json
```

`<dir>` holds the FETCHED candidate: `candidate.json` (the claimed facts), `registry.json` (the
registry response you actually received), and `src/` (the extracted source).

It BLOCKs unless every one of these holds, and it reports every failure rather than the first:

| check | what it means |
|---|---|
| `existence` | a registry lookup was recorded, and it names this candidate |
| `allowlist` | the name was decided in advance, not discovered live |
| `version` | pinned exactly — a range is not a pin; for a skill, a git commit SHA |
| `hash` | an integrity string from the underlying package registry |
| `provenance` | TWO recorded fields: who may publish, and which CI built it |
| `content-scan` | the fetched source, against exfiltration and `curl \| sh` |
| `human-ok` | required whenever the source is write-capable — or unreadable |

**Write-capability is computed, and silence means yes.** A compiled binary, an opaque layer,
anything the scan cannot read is write-capable — an absence of red flags is not a pass. A
candidate's own `readOnlyHint` is reported and never believed.

**Existence-verification does not defeat slopsquatting.** The attacker registers a real package
under the hallucinated name, so that check passes by design. The **allowlist** is the control,
and adding a name to it is a human decision made in advance.

A PASS writes one row to `capability-lock.json`. A BLOCK admits nothing and records the refusal
with its reason, so the same candidate is not proposed again blind.

## `/arc-capability --audit` — staleness

```bash
bash .claude/scripts/develop/capability-vet.sh --audit --lock .claude/scripts/develop/capability-lock.json
```

Reports any admitted capability last checked more than 30 days ago. A row whose date cannot be
parsed counts as stale, not as fresh.

## Vetted is not installed

ADR-0110 separates them on purpose. Vetting produces a **record**; installing produces a
**dependency**. arc has run a real candidate through this gate and gained a lock entry and no
dependency, which is the arrangement working as designed rather than a formality.
