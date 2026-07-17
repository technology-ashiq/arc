# ADR 0015 — Manifests are JSON read only by one Node resolver; sync twins consume a line protocol

**Status:** accepted
**Date:** 2026-07-17
**Reversibility:** two-way
**Revisit trigger:** a manifest feature emerges that the line protocol cannot express for the
PowerShell twin (e.g. conditional copies) — then revisit the twin-side logic split.

## Context

Selective install (`--products`) needs both sync-to-project twins (.sh and .ps1) to agree on
exactly which files each product owns. The twins have already drifted once in production:
sync-to-project.ps1 leaks `.claude/state/` into targets while the .sh excludes it correctly,
and both leak `.claude/scheduled_tasks.lock`. Every twin-parsed format doubles the parser
surface — and parsers are arc's proven bug class (council v2+v3 adversarial passes found 43
holes in gate code that passed its own tests).

## Options considered

1. **Each twin parses manifests itself** (awk in bash, -match in PowerShell, Node in lint) —
   pros: no new component; cons: three independent parsers of the same format, the exact
   recurring-drift class already observed.
2. **Single Node resolver (`arc-products.mjs`) emits a COPY/MKDIR/ENVBLOCK line-protocol
   plan; both twins consume it as dumb while-read/foreach copy loops** — pros: one parser,
   twins stay trivially auditable; cons: Node becomes a hard dependency of selective install
   (already a repo requirement for kickoff-lint/council-lint).
3. **Flat awk-parseable yaml manifests (house arc.gates.yaml style)** — pros: house style;
   cons: that style exists BECAUSE bash parses gates.yaml directly — with a resolver in the
   middle, the constraint vanishes and structured JSON (lists, nesting, no whitespace
   ambiguity) is strictly safer for a security-relevant file map.

## Decision

Option 2 with JSON manifests (folding option 3's question): `products/<name>/manifest.json`,
zero-dep JSON, explicit paths (no globs in v1), parsed ONLY by `arc-products.mjs`; the twins
never see JSON — they consume the emitted plan line-by-line. One parser to harden, one place
for the adversarial fixture corpus (path traversal, duplicate names, CRLF/BOM, case
collisions), and the twin-drift bug class dies at the root.

## Consequences

Easier: hardening (one parser), auditing the twins (dumb loops), adding manifest fields.
Harder: selective install requires Node ≥18 present (full-suite default sync keeps working
without it — resolver only runs for `--products`/`--list`). The line protocol becomes a
stable internal contract: changes to it must update both twins in the same commit, guarded
by sync.bats + a ps1 smoke test.
