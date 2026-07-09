# ADR 0010 — Quality Passport: signed per-commit/release evidence artifact

**Status:** proposed · 2026-07-10

## Context
Evidence bundles (Phase 2) prove gates ran, but they are a directory of files — hard to share,
verify, or point an auditor at. The moat is enforced discipline; the passport is its receipt:
one artifact that answers "show me why release X was trusted" in one click. Fork: keep the
bundle-directory as the interface, or add a single signed manifest on top?

## Options considered
1. **Status quo** (evidence dir + ledger) — pros: exists; cons: not portable, not tamper-evident,
   no summary, nothing to hand to an auditor or badge a release with.
2. **Signed passport manifest** — pros: portable single file, tamper-evident, natural carrier for
   confidence score + control refs; cons: signing/key UX, format versioning.
3. **Full attestation stack (in-toto/SLSA provenance)** — pros: industry standard; cons: heavy
   for solo/small teams, tooling friction — revisit when arc has external verifiers.

## Decision
Option 2. `passport.json` (schema-versioned) generated at `/arc-phase-done` and on tagged
releases: commit SHA, gate list + verdicts + evidence hashes (sha256 of each artifact),
confidence block (ADR-0009), suppression count with justification refs, review-ledger stamp,
and a **reserved `control_refs` field** (empty until policy packs, ADR-0012 — designed in now
so packs are an annotation, not a format change). Signature = git tag/commit signing when
configured; minisign optional adapter; unsigned → `signature: none` explicitly, never silent.
Committed under `docs/evidence/passports/`.

## Consequences
+ "Evidence over assertion" becomes shippable: releases carry proof, not claims.
+ Policy packs (ADR-0012) become a mapping layer on an existing field.
+ Escaped-defect tracking (north-star metric) gets a stable per-release anchor.
− One more artifact to keep in sync — generated only by the gate-runner path, never by hand.
− Key management stays the user's problem; arc only records what was (or wasn't) signed.
