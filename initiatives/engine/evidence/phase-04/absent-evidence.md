# Phase 04 — the two files this bundle's Verification plan names and does NOT contain

`phase-04-spec.md` § Verification plan lists nine expected files. Seven are here. These two are
not, and each is a finding rather than an omission. A named absence is recoverable; a quietly
shortened list is how a bundle stops being evidence.

---

## 1. `smoke-usage.json` — the runtime's usage sidecar

**Status: CANNOT BE PRODUCED RELIABLY. See ADR-0221.**

REQ-00 required *"the `--usage-file` sidecar exists"*. The bundle was audited against its own
Verification plan on 2026-08-16 and the file was missing. The driver comment explaining that
absence read *"No usage flag is passed that has not been verified against the vendor"* — implying
no such flag existed. **That was false.** The vendor documents it on the pinned image's own
`--help`:

```
--usage-file PATH     One-shot mode only: after the run, write a JSON usage
                      report (estimated cost, token counts, model,
                      api_calls) to PATH. The report is written even when
                      the run fails, so pipelines can always account for spend.
```

Five runs, all exit 0, image `sha256:16788311e2fa…3712c9e` / `Hermes Agent v0.20.0 (2026.8.3)`:

| # | Path asked for | Volume | Wall | Report? |
|---|---|---|---|---|
| 1 | `/opt/data/probe.usage.json` | warm | 129s | no |
| 2 | `/tmp/hermes-usage.json`, `docker diff` over whole container FS | warm | ~130s | no |
| 3 | `/opt/data/probe.usage.json` | warm | 78s | **yes, 410 bytes** |
| 4 | `/opt/data/clean.usage.json` | fresh volume, config only | 145s | no |
| 5 | `/opt/data/keepme.usage.json` | warm | 301s | no |

Run 2 does not count against the flag: the image enforces `HERMES_WRITE_SAFE_ROOT=/opt/data` and
denied the write. That correction is itself evidence Phase 06 fixture 1 wants.

**Run 3's 410 bytes were destroyed by the probe's own teardown before anyone read them.** The one
observation that could have separated *the flag wrote it* from *the agent wrote it, having seen the
filename in its argv* was thrown away — a method failure, recorded as one. The probe no longer
deletes anything.

**So this file is absent because the mechanism that would produce it is unresolved, not because the
step was skipped.** `tests/engine-usage-flag-probe.mjs` now watches for it and goes red the day one
appears, keeping the file.

---

## 2. `capability-lock.diff` — the vetting diff

**Status: DOES NOT EXIST, BY DECISION. The runtime is pinned and verified out-of-band, and NOT
gate-admitted.**

The `/arc-capability` gate could not admit this candidate honestly. `capability-vet.sh` advertises
OCI digest support and the path was unreachable; the fix was routed via `/arc-change`, written,
attacked by two fresh agents, and **reverted** (`a1148f7` → `8f4c3d2`) because the pass found the
fix had regressed a pinned hole, its central justification was factually wrong (SRI is base64-44,
OCI is hex-64), it wrote an unverified tag coordinate into the production lock, and four mutants of
the added lines survived all 55 tests. The OCI path also has **no name binding** — a Docker Hub tag
body carries no repository identity, so one recorded response certifies any allowlisted name — and
closing that needs a design call, not a patch.

The allowlist entry and lock row were reverted with the change. **Nothing is admitted that the gate
cannot stand behind**, so there is no lock diff to attach.

Four criticals that predate this cycle and survive the revert are filed as **issue #167**, including
a content-scan bypass by filename verified on the real script: a candidate placing hostile code in
`src/registry.json` gets `PASS — read-only`, exit 0.

**What stands in its place:** `install-method.md` and `backend-config.md` record the digest pin, the
exact `docker run` line, and why a host `curl`-pipe install was refused. That is provenance, not
admission, and it is labelled as provenance.
