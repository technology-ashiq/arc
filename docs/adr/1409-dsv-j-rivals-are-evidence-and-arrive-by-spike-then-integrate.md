# ADR 1409 — DSV-J: rivals are evidence, arrive by spike-then-integrate, and never merge

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a rival's output cannot be rendered by arc's own deterministic renderer —
the comparison is then not like-for-like and that rival leaves the jury rather than getting a
special-case render path.

## Context

Cycle 3 could rank arc's three variants against each other and against one reference screen,
but it had no way to answer the question the owner actually asks: *is this as good as what a
purpose-built AI design tool produces from the same brief?* Best-of-three is not a bar.

## Options considered

1. **Build adapters for v0 and Stitch, then run them** — pros: fastest to a comparison / cons:
   a half-built rival pipeline produces fake confidence, and both providers' contracts are
   assumed rather than known.
2. **Compatibility spike first, adapter only after** — pros: auth, request model, output
   retrieval and failure behaviour are facts before any code depends on them / cons: costs a
   phase.

## Decision

Option 2, in two phases. Same brief → one draft per rival → **arc's own renderer** → unlabeled
items in the **same blind jury** as arc's variants.

Before any adapter: a **compatibility spike** on one provider and one fixture, proving auth,
request model, output retrieval and failure behaviour. Spike receipts record **provider version
+ request + output schema**.

A rival win **never becomes a copy**. The director assigns a NEW thesis capturing the winning
direction, and an arc-authored candidate re-enters critique → jury. If a rival outranks every
arc variant, that fact lands on the spine: the bar stays alive and the embarrassment is
receipted, which is the point.

**Evidence (checked 2026-08-23).** v0's Platform API reached **GA on 2026-08-05** (not beta as
the design source recorded), base `https://api.v0.dev`, API-key auth via `V0_API_KEY`, and —
load-bearing for the renderer requirement — `latestVersion.files[]` returns raw file content,
so self-contained source is retrievable rather than preview-URL-only. SDK **`v0-sdk` verified
on the npm registry at 0.16.7**, Apache-2.0, Node 22+ (this box runs Node v24.18.0); the
companion packages `@v0-sdk/react` and `@v0-sdk/ai-tools` are **UNVERIFIED and must not be
used** without a registry check. Google Stitch **does** now expose a programmatic surface,
reversing a 2025 official statement that it did not: **`@google/stitch-sdk` verified on the npm
registry at 0.3.5**, maintained by Google's `google-wombot` bot, with `STITCH_API_KEY` or OAuth
via `STITCH_ACCESS_TOKEN` + `GOOGLE_CLOUD_PROJECT`, tools including `fetch_screen_code`
(raw HTML download) and `fetch_screen_image`; free at 400 daily design credits; India is in
scope via Gemini's supported regions. **Confidence:** high on both SDKs existing and on v0's
output shape; **medium** on Stitch's HTML being self-contained rather than CDN-dependent —
that is the single fact the spike exists to settle, because a CDN-dependent file cannot be
rendered deterministically offline.
**Rejected because:** rivals-in-one-phase was rejected in the design source's own registry
(row 8) — a half-built rival pipeline produces fake confidence.

## Consequences

Easier: the bar becomes external and the "are we actually good" question gets an answer with
receipts. Harder: two third-party contracts now sit inside a gate-bearing loop, and calling
either is subject to
[ADR-1413](1413-a-rival-is-not-called-until-its-terms-clear.md) — v0's API Terms carry an
express prohibition on performance testing without written permission, which this use plausibly
triggers.
