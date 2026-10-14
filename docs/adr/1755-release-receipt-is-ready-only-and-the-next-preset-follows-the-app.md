# ADR 1755 — `release`'s receipt is READY only; the Next.js preset arrives with the app

**Status:** accepted
**Date:** 2026-10-13
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a hosting provider that builds an empty repo green under a framework preset, or a release that must tag a commit with no static output

## Context

ADR-1730 let `release` count a production deployment in state ERROR as its deploy receipt while `main` held no app:
the project was created with the Next.js preset, so every build before `frontend` landed failed, and that failure was
the expected shape. On the first real run (`arc-sandbox`, 2026-10-13) the board showed `release` verified with
`evidence.state: "ERROR"`. The Vercel log was `NEXT_NO_VERSION` (no `next` in package.json). A receipt that reads
"the deploy failed" is not a receipt. The same failure turned the `environments` preview red (its PR branch had no app
yet). Separately, `frontend`'s 404 came from Vercel refusing a vulnerable Next pin (fixed in efba4ac7), not from this.

## Options considered

1. **Strict READY, nothing else changes** — simplest / every new venture deadlocks: release fails until frontend lands, and frontend depends on release.
2. **READY of the tagged commit or any later production deployment** — no hosting change / release cannot verify on a fresh venture, so the runner's dependency order has to change.
3. **hosting creates the project with no framework preset; frontend sets the Next.js preset just before it commits the shell; release accepts READY only** — a commit with no app builds READY as a static site, and a failed build is never a receipt.

## Decision

Option 3, chosen by the owner. `hosting` sends `framework: null` when it creates the project. `frontend` reads the
project by the repo's name, refuses one linked to another repo (FOREIGN_PROJECT), and PATCHes `framework: "nextjs"`
before it pushes the shell: Vercel builds a commit with the preset the project holds when the push lands, so the order
matters. `nextjs-shell` gains `VERCEL_TOKEN` and `api.vercel.com`. `release`'s verify accepts READY only; ERROR is
`production build <id> of <sha> failed (ERROR)`. This supersedes ADR-1730's "or ERROR while main has no app yet".

## Consequences

A project hosting found rather than created keeps whatever preset it had, and frontend sets Next.js on it all the same.
`arc-sandbox` was created under the old rule, so its tagged commit's production build stays ERROR; its release is
re-verified only after that commit is rebuilt under no preset. Pinned by `launch-contract: the steel thread ...`
(preset `null` then `nextjs`, set before the shell's push, release READY), `launch-contract: a failed production build
is never a release receipt ...` (the arc-sandbox mutant, `next-preset-empty`) and `launch-contract: frontend never sets
the preset of a vercel project linked to another repo`.
