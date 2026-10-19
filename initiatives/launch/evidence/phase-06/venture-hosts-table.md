# Phase 06 -- the hosts each @venture row's adapter fetches (ADR-1765)

Generated 2026-10-20 from `products/launch/launch.providers.yaml` and each adapter's source: every `https://` literal host,
plus `${d}` / `${domain}` interpolations, which are the venture's own domain. A host outside `{brand.domain subtree} ∪
the row's literals` would be a gap that fires ADR-1765's revisit trigger.

| Row | Slot | Row literals | Hosts in adapter source | Gap |
|---|---|---|---|---|
| vercel-managed-tls | tls | api.vercel.com, api.ssllabs.com | (venture domain), api.ssllabs.com, api.vercel.com, domain | domain |
| nextjs-shell | frontend | api.github.com, api.vercel.com, www.googleapis.com | (venture domain), api.github.com, api.vercel.com, www.googleapis.com | none |
| next-route-handlers | backend | api.github.com | (venture domain), api.github.com | none |
| drizzle | orm | api.github.com | api.github.com | none |
| supabase-auth | auth | api.supabase.com, supabase.co, api.github.com, api.vercel.com | (venture domain), api.github.com, api.supabase.com, api.vercel.com | none |
| rls-roles | authz | api.supabase.com, supabase.co, api.github.com | (venture domain), api.github.com, api.supabase.com | none |
| org-invite | tenancy | api.supabase.com, supabase.co, api.github.com | (venture domain), api.github.com, api.supabase.com | none |
| plans-yaml | plans | api.supabase.com, supabase.co, api.github.com | (venture domain), api.github.com, api.supabase.com | none |
| razorpay-checkout | checkout-portal | api.razorpay.com, api.supabase.com, supabase.co, api.github.com | (venture domain), api.github.com, api.razorpay.com, api.supabase.com, checkout.razorpay.com | checkout.razorpay.com |
| razorpay-webhook | webhooks-ledger | api.supabase.com, api.github.com | (venture domain), api.github.com, api.supabase.com | none |
| razorpay-refunds | refunds | api.supabase.com | (venture domain), api.supabase.com | none |
| arc-legal | legal-pages | — | (venture domain) | none |
| next-headers | security-headers | api.github.com, observatory-api.mdn.mozilla.net | (venture domain), api.github.com, api.razorpay.com, checkout.razorpay.com, lumberjack.razorpay.com, observatory-api.mdn.mozilla.net | checkout.razorpay.com, api.razorpay.com, lumberjack.razorpay.com |
| sentry | errors | sentry.io, api.github.com | (venture domain), api.github.com, sentry.io | none |
| venture-register | passport | — | — | none |
| ledger-source | ledger-source | — | — | none |
| face-planned | face-room | — | — | none |
| arc-checkout | arc-harnesses | — | — | none |
| teardown-render | teardown-plan | — | — | none |

Rows: 19 · gaps: 5

## Reviewed: the flagged "gaps" are page text, not fetches

The scan matches every `https://` literal, so it also catches text an adapter writes into, or looks for in, the venture's
own pages. Each hit was read at its line (2026-10-20). None goes through `ctx.fetch`:

- `vercel-managed-tls` · `domain` — a code comment (`within https://domain`, line 120).
- `razorpay-checkout` · `checkout.razorpay.com` — `CHECKOUT_JS` is the `<script src>` the shell writes, and that verify
  looks for in the served `/checkout` HTML (lines 214, 226, 356, 463). The browser loads it; the adapter never fetches it.
- `next-headers` · `checkout.razorpay.com`, `api.razorpay.com`, `lumberjack.razorpay.com` — Content-Security-Policy
  directives the adapter writes (lines 160-165).

**Fetch gaps: 0.** No row needs a literal beside `@venture`, so ADR-1765's revisit trigger does not fire.
