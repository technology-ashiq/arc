# ADR 0205 — a canonical process carries one shared body, and no per-target passthrough

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** one-way
**Revisit trigger:** a pilot cannot reach byte-identical because a byte is genuinely
target-specific and belongs in no shared body — the residue is named, and its size decides
whether a bounded per-target field is added or the pilot is declared non-migratable and banked
as documentation (which the kill criteria already price as a legitimate outcome).

## Context

REQ-02 demands byte-identical regeneration of three hand-written command files. Read
`.claude/commands/arc-review.md`: thirty lines of specific prose — *"Do NOT use `general-purpose`
agents and do NOT invent your own reviewers (adversarial hunter, test critic, etc.)"*. No abstract
step taxonomy produces that sentence. If the canonical file does not hold that prose, byte-identity
is unreachable on day one, and REQ-02 fails by construction rather than by discovery.

So the canonical file must carry the prose. The fork is **how**, and the two shapes have very
different consequences: a per-target passthrough field (`x-claude-code-raw:`) reaches byte-identity
immediately and hollows out the canonical file into a wrapper around dialect text, taking REQ-03's
second dialect with it. A single shared body reaches byte-identity only if the prose is genuinely
target-neutral — which is a real constraint, and a useful one.

ENG-C (ADR 0202) is what makes the shared body sufficient: the byte-diff is a **migration** gate.
Its job is to prove the move lost nothing, not to prove the prose was derived from abstractions.

## Options considered

1. **Per-target passthrough field** — pros: byte-identity is easy. Cons: every pilot becomes a
   dialect blob with a YAML hat; the codex target can only re-emit claude-code text, so REQ-03
   passes mechanically while failing its intent.
2. **No prose at all — everything from the taxonomy** — pros: maximal abstraction. Cons: cannot
   reproduce the existing files, so REQ-02 is unreachable and the cycle's central proof never runs.
3. **One shared `body:` block scalar, rendered by every adapter** — pros: byte-identity is
   reachable, and the body stays canonical because all targets render the same text. Cons: prose
   that is genuinely claude-code-specific has nowhere to hide, and will surface as a compile
   failure.

## Decision

**A canonical process carries exactly one `body:` block scalar** holding target-neutral markdown,
plus structured fields (`name`, `version`, `intent`, `inputs`, `steps`, `tools`, `output`,
`evals`). **Every** adapter renders the same body. **Per-target raw passthrough fields are
forbidden** — `process-lint` rejects any key matching `x-<target>-*`.

Everything outside the body is **derived by the adapter, from a mapping table the adapter owns**:

- `allowed-tools:` is derived from the abstract `tools:` list (`Bash(git diff:*)`, `Task`, `Write`
  are claude-code renderings, never canonical values) — **but only when the process declares
  `permissions: declared`.** Verified at `7abeda1`, `arc-kickoff.md` carries no `allowed-tools:`
  line at all (it and `arc-develop.md` are the only 2 of 24 commands without one) while still
  needing `agent.invoke`, `shell.run`, `fs.write` and `ask.human`. An unconditional derivation would
  ADD a line the baseline lacks and fail the byte-diff structurally rather than on prose. Whether a
  process declares an explicit permission set or runs unrestricted is a property of the **process**,
  so it is modelled canonically — and this is emphatically not the per-target passthrough forbidden
  below: it is one target-neutral enum, not a slot for dialect text;
- `argument-hint:` is derived from `inputs:`;
- `description:` is `intent`.

**If a byte cannot be produced from `(derived frontmatter + shared body)`, the compile FAILS.**
There is no bypass. That failure is a genuine finding about the file, and pre-mortem row 1 already
prices the outcome it points at: a documented canonical file beside a hand-written dialect file is
banked value, and the kill criteria name that exit explicitly.

**Confidence:** medium — the claim that the pilots' prose is target-neutral is untested until
Phase 1 runs the diff. It is carried as an assumption with a trigger rather than asserted.

## Consequences

**Easier.** One body means one place to improve a command's wording, and a codex target that
renders real content rather than a foreign blob. Reviewing a dialect change is reviewing the
adapter's mapping table once.

**Harder.** Any claude-code-specific sentence in the pilots becomes a compile failure with nowhere
to put it. That is the point — but it means Phase 1 may end with a residue that has to be
adjudicated, and `arc-kickoff.md` at 132 lines is the likeliest place for it.

**What we'd revisit if this goes wrong.** The revisit trigger above: name the residue, measure it,
and let its size decide between a bounded per-target field and declaring that pilot non-migratable.
Deciding that in advance, in either direction, would be guessing.
