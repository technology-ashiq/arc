# Real candidate vetted — madge@8.0.0 — 2026-08-03

Run by hand, outside bats and outside CI (phase-06-spec.md's verification plan): a
19-job 3-OS matrix hitting a live registry on every push is the flakiness this repo's
zero-dep stance refuses. The artifact is the lock entry, not a re-fetch.

## What was fetched, and how

```
npm view madge --json           -> registry.json (8180 bytes)
npm pack madge@8.0.0            -> madge-8.0.0.tgz    # FETCH, not install
tar -xzf madge-8.0.0.tgz        -> src/ (140 files)
```

`npm pack` downloads a tarball. It does not run lifecycle scripts, and nothing in this
run executed a line of madge. arc gained no dependency and has no node_modules.

## Integrity, verified rather than copied

```
registry dist.integrity: sha512-9sSsi3TBPhmkTCIpVQF0SPiChj1L7Rq9kU2KDG1o6v2XH9cCw086MopjVCD+vuoL5v8S77DTbVopTO8OUiQpIw==
sha512 of the bytes:     sha512-9sSsi3TBPhmkTCIpVQF0SPiChj1L7Rq9kU2KDG1o6v2XH9cCw086MopjVCD+vuoL5v8S77DTbVopTO8OUiQpIw==
INTEGRITY MATCHES
```

## The gate

```
BLOCK [human-ok] madge is write-capable and carries no recorded human OK — its source writes, spawns or deletes: src/lib/graph.js:8:const exec = promisify(require('child_process').execFile);
  Expected: `human-ok: <name> <YYYY-MM-DD>` in candidate.json, recorded by the person who agreed
  Found:    (absent)

1 condition(s) refused madge@8.0.0. It was NOT admitted.
The refusal is recorded in /tmp/tmp.vr3JLlInch/throwaway.json so the same candidate is not proposed again blind.
```

## The result, and why it is the interesting one

**madge was REFUSED.** Not on provenance — its hash verified byte-for-byte against the registry
and its publisher is recorded. It was refused because `src/lib/graph.js:8` does
`promisify(require('child_process').execFile)`, which makes it **write-capable**, and a
write-capable capability needs Ashiq's recorded OK by this cycle's non-negotiables.

This is the outcome assumption-ledger row 5 exists to test, and it went the way the ADR said it
must: **the capability is refused rather than the gate weakened.** The phase was written to admit
madge; the gate said no to the very candidate it was built for, on a fact it computed from the
source rather than on anything the package claimed about itself.

Fabricating `human-ok: ashiq <date>` would have satisfied the exit criterion in the same motion
that made the whole promotion machinery worthless. It is one line, and it is his line.

**Open decision for Ashiq:** admit madge as a write-capable capability, or leave it refused. The
lock file already holds every fact needed to decide — pinned version, verified hash, publisher
auth, no build attestation, and the exact line that classes it write-capable. Admitting it means
adding `human-ok: ashiq <YYYY-MM-DD>` to the candidate and re-running the gate. **Vetted is still
not installed either way**: admitting it records a decision, not a dependency.

---

## Admitted 2026-08-03, on Ashiq's recorded OK

He gave it in writing ("madge approve pannu"), and it is recorded as
`human-ok: ashiq 2026-08-03` on the candidate. The gate was re-run against the
same fetched tree and now PASSes:

```
PASS  madge@8.0.0 — write-capable (human OK recorded: ashiq 2026-08-03)
```

`capability-lock.json` moves madge from `refusals` to `capabilities` and keeps
`previously-refused-on: human-ok`, so the record still says the gate refused it
first and what changed. `--audit` reports 1 row, 0 stale.

**arc still has no dependency.** No `node_modules`, no `package.json`, nothing
installed — the lock row is a decision, not an install. That separation is
ADR-0110's whole point, and this is the first time it has been exercised all the
way through: refused on a computed fact, admitted on a human line, and neither
step touched the dependency tree.

The `source` field records `npm:madge@8.0.0, fetched and not retained` rather
than the temp directory it was fetched to. This file is committed, and an
absolute path in it would record one machine and one afternoon rather than the
candidate.
