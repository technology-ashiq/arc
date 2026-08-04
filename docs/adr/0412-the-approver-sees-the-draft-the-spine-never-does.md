# ADR 0412 — The approver sees the draft; the spine never does

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
<!-- a draft body committed to the spine is permanent -->
**Revisit trigger:** the inbox gains a private-plane renderer of its own, making the
two-plane split an implementation detail rather than a boundary.

## Context

Two requirements collide. The inbox is **spine-fed** — that is how approval works
everywhere in this repo. And drafts are **PII** — `ADR-0410` says PII never touches the
spine. So the approver needs to read something the spine is not allowed to carry.

## Options considered

1. **Put the draft on the spine** — pros: the inbox works unchanged. cons: violates
   `ADR-0410` permanently and irreversibly. Non-starter.
2. **Approve blind** (spine carries only an id) — pros: trivially PII-safe. cons: an approval
   that has not seen the content is not an approval.
3. **Two-plane: opaque item on the spine, local render from the store.**

## Decision

**Option 3.**

**Spine approval item carries only:** `{draft_ref (opaque), lead_hmac, campaign, lint_status,
draft_sha}`

**`arc-leads review <draft_ref>` renders the actual draft locally from the store**, with the
dossier evidence alongside — so the approver can check the cited facts against their sources,
which is the whole point of `ADR-0404`'s citation mechanism.

**The approve/reject decision receipt carries the opaque ref + `draft_sha`.** Approval binds
the **exact content**. The `ADR-0403` send-moment guard verifies `current draft sha ==
approved sha`; edited-after-approval is refused. This applies evolve's `candidate_sha`
discipline to outreach.

**No PII ever passes through argv.** Raw replies are ingested by file import from the store
or via stdin (`arc-leads ingest-reply --file`), never pasted as a command argument — shell
history and process listings are logs too.

**Two boundary tightenings:**

- **`--file` REJECTS any path that resolves inside the repo directory.** The import source is
  the store, not the tree. Otherwise "save the reply into the repo, then import it" leaves
  raw mail sitting in the worktree — defeating `ADR-0410` by workflow rather than by bug.
- **Parser and ingest errors are loud about WHERE and WHY** (path, byte offset, reason code)
  **but NEVER echo reply content or excerpts.** Terminal scrollback is a log surface too.

**Confidence:** high.

**Rejected because:** Option 1 — permanent PII on a public-bound spine. Option 2 — blind
approval is not approval.

## Consequences

**Easier:** the approval flow keeps every spine property (typed, replayable, idempotent)
while the content stays in exactly one place.

**Harder:** approving requires the store to be present, so approval is machine-local. That is
already true of this lane's execution model (Mode A, one session at a time).

**Fixtures:** draft edited after approval → send refused · approval receipt payload contains
no draft text · argv-pasted reply content → refused with a pointer to `--file` · `--file`
path inside the repo → refused · forced parse error → error output contains **zero** content
bytes from the input.
