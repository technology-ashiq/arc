# ADR 1514 — DOC-N: truth lives in generated blocks; a narrative is drift-checked and owner-read, not verified block by block

**Status:** proposed (the owner's `/arc-change --lane face` of 2026-09-27, second pass)
**Date:** 2026-09-27
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** the owner finds a narrative stating something false about arc that the drift check passed.
Then `narrative-verify` goes back to being a gate for the pages that carry that kind of claim.
**Amends:** ADR-1513 §1 and §2. §3 (the owner reads for understanding) stands and becomes the main gate.

## Context

ADR-1513 let model-drafted narrative ship on three conditions: every factual block anchored, an independent verifier
passing every block, and the owner's read. The first two held for all 34 pages, and the owner still rejected them
(ADR-1348). The method measured the wrong thing. It proved that each sentence was supported. It never asked whether
a person could understand the page.

The method also pushed the writing toward the failure. A sentence that restates a source file is easy to anchor and
easy to verify. An analogy ("engine is the dispatch office") is neither. Drafting agents learned to restate, and
pruning what the verifier rejected made the pages drier still. Roughly 40% of a week's tokens went on draft, verify
and fix rounds.

## Decision

1. **Hard facts are generated, not written.** Counts, names, versions, ADR lists, gates, lane status and exit codes
   come from the extract through ADR-1348's generated sections. A narrative explains. It does not re-list.
2. **A narrative is drift-checked.** `narrative-anchors` keeps one hard rule: every file path, command, agent,
   process, script, gate and ADR that a narrative names must resolve in the extract or the tree. The rule that every
   block carry a `src` or `plain` marker is retired. Markers that are present are still resolved, and still stripped
   before rendering.
3. **The per-block verifier becomes advisory.** `narrative-verify` stays as a tool the owner or a session may run on
   a page. Its receipt is no longer required to ship. The explanation-debt count stays (ADR-1513, "every feature is
   explained").
4. **The owner's read is the gate.** A page ships when the owner has read it in the room and accepted it:
   `narrative-anchors --accept <dir>/<id>` records his acceptance against the narrative's sha256. An edit after
   acceptance shows the page as awaiting-owner again. Phase 07 closes when that count is 0.
5. **The narrative is drafted directly by the session, from the sources.** It is still model-drafted, and ADR-1508's
   concern is answered by points 1, 2 and 4 together. No fleet of agents, no verify rounds and no pruning are used.

## Consequences

- An analogy and a story ("the life of a bug") can be written freely. They are what the owner asked for.
- A wrong number can no longer hide in prose, because the numbers come from generated sections. A wrong claim in
  prose is caught by the owner's read or by nothing. That is the accepted risk, and it is named in the revisit
  trigger.
- `tests/docs-narrative.bats` loses the arms for the every-block marker and the verify receipt, and gains the arms
  for acceptance-hash and drift. Each new arm FAILs from birth with its mutant.

## Amendment 1 (2026-09-29, `/arc-change --lane face`): `--accept` carries an owner proof

**Why.** The round-2 attack (B6) showed section 4 rests on a premise nothing enforces: `--accept` stamps `by: "owner"`
for any caller. An agent session could accept all 34 pages and take awaiting-owner to 0, and the gate Phase 07 closes on
would read as an owner's act when it was not. The owner chose to close this in code, not to park it (2026-09-29).

**Decision.** `narrative-anchors --accept <dir>/<id> --approval <ULID>` writes an entry only when the spine holds:
1. an `approval.requested` with `gate: narrative-accept` whose payload lists that page and its **current** sha256;
2. a `decision.recorded` for it with verdict `approve`, written through `arc-inbox approve` (the owner's stamp).

Anything else is refused with a plain sentence, exit 1, nothing written: no `--approval`, an unknown ULID, an undecided or
rejected request, a request for another page, or a hash that no longer matches (an edit after approval needs a new one).
The entry records the ULID. The gate FAILs an entry that names none, so a hand-edited `accepted.json` does not pass either.

**How the request is made.** `narrative-anchors --request-accept <dir>/<id>...` computes the pages' hashes and asks the main
clone's `arc-event` to emit the `approval.requested`; the owner runs `arc-inbox approve` there. One request may name many pages
(the 34 existing acceptances are re-stamped under one batch request).

**The worktree constraint.** The spine refuses reads and writes inside a linked worktree (`WORKTREE_SPINE`), and the canonical
spine is in the main clone. So both new steps locate the main clone from git's common dir and use it read-only for `--accept`
and through its own `arc-event` for the request. Nothing else reaches across, and `ARC_SPINE_ROOT` stays test-only.

**Not decided here, checked in the build.** Whether `arc-event` accepts a new `gate` string on `approval.requested` as it
stands, or `validate.mjs` needs a row (an hq-lane file, so the change would land as a small additive edit). If it needs more
than a row, the build stops and this amendment returns to the owner.

**Cost.** About 0.75 day: the two commands, the spine read, a fixture per refusal (each FAILs against the old code), one
attack round. Charged to Phase 07. **Revisit trigger:** the owner reads a page in the room and cannot accept it without a
terminal, which would make the proof a chore and the room the place to record it.

### What Amendment 1 proves, and what it does not (added after the round-3 attack)

The owner proof is a **deliberate-step proof, not authentication.** It makes an accepted page cost one thing an agent cannot
do by accident: a request the owner decided through `arc-inbox`, naming the page's exact hash. It does **not** prove that a
human wrote that decision, for two reasons the attack found and this ADR states instead of hiding:

1. **CI cannot re-verify it.** The gate checks that an entry carries a well-formed ULID and no more, because the spine is
   gitignored and absent on a CI runner. A hand-edited `accepted.json` with an invented ULID therefore reads as accepted on
   CI. On CI the awaiting-owner count is **advisory**; the real check runs only inside `--accept`, on the owner's own clone.
2. **Anything that can run `arc-event` from the main clone can write both events.** `arc-inbox approve` and a direct
   `decision.recorded{decides, verdict: approve}` are indistinguishable to the reader. Closing that needs an owner-only token
   that only `arc-inbox` can stamp and the validator can require, which is a new authentication design in the hq lane. It is
   **not built here** and is the owner's call.

So the guarantee is: an agent cannot accept a page by running `--accept` alone, or by pointing `ARC_SPINE_ROOT` at a spine of
its own (refused by name), and any forgery leaves two receipts on the real spine that a reader can see. It is not: an agent
with a shell in the main clone cannot forge them. **Revisit trigger, added:** the owner asks for the owner-only token.

## Amendment 2 (2026-09-30, `/arc-change --lane face`): the owner proof becomes authentication

**Why.** Amendment 1 states its own limit: it is a deliberate-step proof. The round-3 boundary attack (B1, B2) named the two holes it leaves: CI cannot re-verify the ULID, and a shell in the main clone can write `approval.requested` and `decision.recorded{approve}` with `arc-event`, indistinguishable from `arc-inbox approve`. The owner chose to close both before Phase 07 closes (2026-09-30, "owner-token first").

**The constraint that shapes the design.** The agent and the owner run as the same operating-system user on the same box, so any secret that is only a file or an environment variable is readable by the agent. Only two things are out of an agent's reach: a passphrase typed by a human at a real terminal, and a terminal the agent cannot drive. So the design must be: a key sealed by a passphrase, unsealed only at an interactive prompt.

**Decision (proposed, awaiting the owner's OK).**
1. **An owner key pair.** `arc-inbox owner-key init` (run once, at a real terminal) makes an Ed25519 key pair, seals the private key with a passphrase the owner types (encrypted PKCS8, node's own crypto, no dependency) and stores it outside the repo (`~/.arc-private/owner/`). The **public key is committed** at `.claude/owner-key.pub`. Losing the passphrase means a new key pair and a re-approval; nothing else depends on it.
2. **A signed decision.** For `gate: narrative-accept` only, `arc-inbox approve` refuses unless stdin and stdout are a terminal, asks for the passphrase (input not echoed), and adds one optional key, `sigs`, to `decision.recorded`: an object page -> base64 Ed25519 signature, one signature per page the request lists, each over `arc-narrative-accept-v1 | the approval ULID | the page | the sha256 of the page text` (one message per page so CI can rebuild it from an `accepted.json` entry alone, without the spine). `assertDecision` in `.claude/scripts/hq/lib/validate.mjs` accepts `sigs` (an additive optional key on a closed shape: keys are page ids, values the exact length of an Ed25519 signature). It cannot see the request's gate, so it does not require `sigs`; the requirement lives in items 3 and 4. Rejecting needs no signature, and every other gate approves exactly as before.
3. **The entry carries the proof.** `--accept --approval <ULID>` reads the decision, requires the decision's `sigs` to carry a signature for the page, verifies it against the committed public key over the approval, the page and the hash of its current text, and copies `{approval, sig}` (that page's signature) into the `accepted.json` entry.
4. **CI checks something committed.** The gate verifies each entry's `sig` against `.claude/owner-key.pub` over the entry's own approval, page and hash, and FAILs `[no-owner-signature]`, `[bad-owner-signature]` or, with no public key file, `[no-owner-key]`. An invented ULID, a hand-edited entry or a copied `sig` for other text now FAILs on CI. Only the holder of the passphrase can make an entry that passes.

**Scope, on purpose.** This covers `narrative-accept` only. Extending it to `phase-done`, `kickoff` and the other gates is the same mechanism and a later decision; nothing here changes them.

**What it costs the owner.** Approving pages is done in a terminal window (not through `!` in the chat, which has no terminal), once per batch, with a passphrase typed each time. That friction is the point.

**What it still does not prove.** A key logger, or an agent that drives a pseudo-terminal AND learns the passphrase, defeats it; so does the owner reading the passphrase to the agent. It moves the bar from "two commands" to "the passphrase", which is the most a same-user box can offer. The 34 existing entries, given under Amendment 1, are re-signed under one batch approval.

**Cost and risk.** About 1.5 days: the key command, the terminal prompt, the validator key (an hq-lane file, additive), the signature in the gate and `accepted.json`, a fixture per refusal, one attack round. Risk: a bug in `assertDecision` could refuse legitimate decisions for every gate, so the `sigs` rule is not in the validator at all (it is keyed on the request's gate in the reader and the gate) and a fixture pins that `phase-done` and `kickoff` decisions still pass unchanged. **Revisit trigger:** the owner cannot approve without leaving the chat and asks for the room to record it (a passphrase field in the face).

**Lighter alternative, not chosen unless the owner says so.** Require a terminal for `arc-inbox approve` on this gate and record `via: tty`, with no key and no CI check: about half a day, stops a Bash-tool agent, leaves CI advisory.

**Correction to the paragraph above, added before the build (2026-09-30): the key can be swapped.** Anything on a same-user box, including the committed public key, is writable by the agent. An agent that makes its own key pair, replaces `.claude/owner-key.pub` and signs its own entries passes the gate on CI. So the honest guarantee is: invented ULIDs, hand-edited entries, a bare `--accept`, a fake spine and a copied `sig` all fail; a **deliberate key swap does not fail, but it is loud**. The build therefore adds a `[owner-key-changed]` finding to the gate: when `.claude/owner-key.pub` differs from the version at the base ref (a new key where none existed at the base is the first-time bootstrap and is allowed), the gate prints one WARN line and counts it in the summary, and the session that sees it does not merge without telling the owner. What actually stops a swap is a review no agent can give: the owner turns on GitHub CODEOWNERS review for `.claude/owner-key.pub`, `.claude/scripts/docs/narrative-anchors.mjs` and `.claude/scripts/hq/lib/narrative-proof.mjs`. That is a repository setting outside every file here, so it is the owner's step, not code. The validator only accepts an optional `sigs` key (it cannot see the request's gate, so it cannot require it); the requirement lives in the reader (`--accept`) and the CI gate, where a decision with no valid signature is simply not a proof.
