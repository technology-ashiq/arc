# ADR 0410 — Lead PII lives outside the repository directory entirely

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
<!-- git history is permanent; a leaked commit cannot be un-published -->
**Revisit trigger:** the repo is definitively confirmed to be staying private forever — which
would relax nothing, because the store also protects against `git clean`.

## Context

**The repo is headed public** (owner strategy). Git history is forever. Any lead PII
committed today is permanently published the day the repo opens.

The design source's first draft said "a gitignored dir inside the worktree". That is a
contradiction, and it was the sharpest catch of its review rounds:

1. An ignored directory is one `.gitignore` regression or one `git add -f` from a permanent
   leak.
2. **`git clean -xfd` DELETES ignored files.** It is a routine command. Lead data must never
   live anywhere git considers disposable — the risk runs in *both* directions.

## Options considered

1. **Gitignored dir inside the worktree** — pros: convenient, colocated. cons: both failure
   modes above. Rejected as self-contradictory.
2. **Encrypted-at-rest inside the worktree** — pros: a leak is ciphertext. cons: `git clean`
   still deletes it, and key management is a new problem to hold.
3. **Outside the repo directory entirely, owner-controlled.**

## Decision

**Option 3.** The private store lives **outside the repository directory**, resolved at
runtime:

```
ARC_LEADS_STORE  (environment)  →  default ~/.arc/leads/
```

**The store path is never hardcoded in tracked config.** A personal filesystem path in a
future-public repo is itself a leak.

**The store holds:** dossiers (names, emails, drafts, notes, reply content) · the `ADR-0400`
HMAC secret · the `ADR-0411` send journal.

**The repo holds ONLY:** schemas, fake fixtures, non-secret config, and opaque refs
(`draft_ref` / `lead_hmac`).

Full email bodies exist only in the store and at the provider — never on the spine, never in
receipts, never in the tree.

**The hygiene lint is a TRIPWIRE, framed honestly, with an explicit exception model:**

- declared fixture paths may contain **only** reserved-domain addresses (`example.com`,
  `.test`, `.invalid` — RFC 2606), so even a fixture cannot hold a real address
- email-shaped strings **anywhere else** in tracked files (code, docs, config, lane data) FAIL
- a resolved store path appearing in any tracked file FAILS

**The lint is the alarm, not the wall.** Location isolation is the primary defense. The lint
detects the common accident; it cannot prove arbitrary prose PII-free, and it is not claimed
to.

**Delete-on-request** = dossier purge + `lead.suppressed` receipt, **with the suppression
HMAC retained**. Minimal-data suppression: without the retained HMAC, the same person
resurfacing in a future research list would be contacted again.

**Confidence:** high.

**Rejected because:** Option 1 — self-contradictory; ignored files are both leakable and
deletable. Option 2 — solves the leak half and not the `git clean` half, at the cost of key
management.

## Consequences

**Easier:** the question "could lead PII be in the repo" has a structural answer rather than
a review answer.

**Harder — and named out loud:** outside the repo there is **no git safety net**. Store and
secret backup is an owner concern. **Losing the HMAC secret breaks suppression matching**
(`ADR-0400`) — a person who unsubscribed could be re-contacted. Backup is an owner
obligation, not a system guarantee.

**Ordering constraint:** the store, the secret, and the tripwire lint land in **Phase 0,
before any dossier exists.** Building the researcher first would mean creating PII before
the thing that protects it.
