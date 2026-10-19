# ADR 1765 — `hosts[]` carries a `@venture` token, resolved from the venture's own `brand.domain`

**Status:** accepted
**Date:** 2026-10-19
**Product:** `launch`
**Reversibility:** one-way
**Revisit trigger:** a provider needs a venture-derived host that is not `brand.domain` itself, such as one of its subdomains (for example
a per-venture `*.vercel.app` alias or a Supabase project ref). That host shape then needs its own named token, never a
wildcard.

## Context

The first real venture, `myfitfolio` (`honesty_class: real`, `brand.domain: myfitfolio.com`), failed `frontend` with
`verify:HOST_REFUSED: myfitfolio.com is not in this provider's hosts[] (sandbox.automemory.ai)` (receipt
`01M5AJF0VN61VDTE9D2FJ2HWMT`). 19 rows in `products/launch/launch.providers.yaml` hold the literal
`sandbox.automemory.ai`, because Cycle 1 ran only on the rehearsal venture. `ctx.fetch` matches a host exactly or as a
subdomain of an entry (`lib/ctx.mjs` `hostAllowed`). The vetting digest hashes the adapter `.mjs` bytes only
(`lib/scan.mjs` `adapterDigest`), so a `hosts[]` edit does not raise `DIGEST_DRIFT`.

## Options

1. **A `@venture` token in the row, resolved at `makeCtx` time from the venture profile's `brand.domain`.** The literal
   is replaced by the token, and the match rule is unchanged.
2. **A per-venture host overlay file.** Data outside the vetted row would widen the allow-list.
3. **A runtime union of every row's hosts with `brand.domain`.** All 37 rows, including API-only rows such as
   `razorpay`, would gain the venture host without the row saying so.

## Decision

Option 1. In a row, `@venture` is a whole entry in `hosts[]`, never part of an entry. `makeCtx` replaces it with the
profile's `brand.domain`, lower-cased. The literal `sandbox.automemory.ai` is removed from all 19 rows, and on
`arc-sandbox` (whose `brand.domain` is `sandbox.automemory.ai`) the resolved list is byte-identical to today's.

The token fails closed. It resolves to nothing, and the call is refused `HOST_REFUSED` with reason
`VENTURE_HOST_UNRESOLVED`, when `brand.domain`:
- is missing, or is `unassigned`;
- is not a bare hostname of 2 or more labels (lint rule `hosts-bare` applied to the resolved value);
- carries a scheme, port, path, wildcard, or a trailing dot;
- is a public suffix or a shared multi-tenant suffix, as defined by the one module
  `.claude/scripts/launch/lib/public-suffixes.mjs`: `vercel.app`, `github.io`, `pages.dev`, `netlify.app`, `web.app`,
  `herokuapp.com`, `workers.dev`, `supabase.co`, plus any 2-label `{co|com|net|org|gov|ac|edu}.{2-letter TLD}`. This is
  deliberately not a full PSL, because the lane carries zero dependencies. Without this, `brand.domain: vercel.app` would pass both
  checks and hand 19 rows every tenant under that suffix (kickoff attack A4).

It is refused with reason `VENTURE_HOST_COLLIDES` when the case-folded `brand.domain` equals any literal host in any row of
the registry, or is a parent or a subdomain of one. Both reasons ride a `HOST_REFUSED` refusal. Without this check, a venture named `github.com` would hand every `@venture` row the GitHub API.

The resolution replaces the token in place, so the list keeps its order. The collision and suffix checks also run in
`launch-lint` over the committed registry and every profile under `products/launch/ventures/`, so a later row that
collides with a venture fails CI rather than that venture's next live run.

`launch-lint` accepts `@venture` as a `hosts[]` entry. Its self-test gains mutants for `@venture.evil.com`,
`x.@venture`, `@VENTURE` and a duplicated token, and refuses each of them.

**Amended 2026-10-20 (Phase 06 attack 9d10382 B1):** the resolved venture host matches **exactly**, never as a
subdomain base. `hostAllowed` admits every subdomain of an entry, so a dangling `x.{brand.domain}` that someone else took
over would have been inside every `@venture` row's allow-list. No adapter fetches a venture subdomain: the Phase 06
hostname table shows every one of them calls the apex.

## Consequences

- No re-vet. Adapter bytes do not change, so the 33 digests stand. The owner's approval of this ADR at kickoff is the
  record that the 19 rows' scope changed from one fixed host to "the venture's own domain".
- The rehearsal path is re-proven by a CI fixture that resolves all 19 rows for `arc-sandbox` and asserts the list is
  equal to the Cycle 1 literal. No paid live run is needed for that.
- Negative controls live in `tests/launch-trust.bats`: `evilmyfitfolio.com`, `myfitfolio.com.evil.com`, an IP literal,
  `sandbox.automemory.ai` called from `myfitfolio`, and `unassigned` are each refused, and each case asserts the fetch
  ran before asserting the refusal.
- A security gate change. It gets a two-surface `/arc-attack` before its PR merges.

**Evidence:** `lib/ctx.mjs:11-13,53-57` (match rule), `lib/scan.mjs:112-117` (digest scope), `launch-lint.mjs:96-101`
(hosts grammar), receipt `01M5AJF0VN61VDTE9D2FJ2HWMT`. Codebase survey 2026-10-19.
**Confidence:** high.
