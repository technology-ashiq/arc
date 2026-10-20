# Phase 06 — live runs from the main clone

## 2026-10-20 — `frontend` on `myfitfolio`, first run on merged `@venture` code

- Main clone at `0bbe7dc8` (PR #443 merge; head `89520c47`; CI run 39321893373, 19/19 green).
- Owner ran `apply frontend --venture myfitfolio --venture-root E:\Work_Hub\01_Automemory\myfitfolio` (pid 40708, 02:50 IST).
- Answer: `frontend: failed (verify:https://myfitfolio.com/ answered 525, not 200) -- attempt 2, receipt
  01M5B0PVX6H2KG8FNV7GGYGMR4`, `STOP at frontend (exit 1)`.
- The Cycle 1 failure was `verify:HOST_REFUSED: myfitfolio.com is not in this provider's hosts[]` (receipt
  `01M5AJF0VN61VDTE9D2FJ2HWMT`). The request now leaves ctx and reaches the venture's domain, which is REQ-13's
  allow-list half, proven live.

## Why 525 (read-only probes, 2026-10-20)

| Probe | Answer |
|---|---|
| DoH `myfitfolio.com` A | `104.21.1.99 172.67.129.3` (Cloudflare proxy range) |
| DoH `myfitfolio.com` AAAA | `2606:4700:3030::ac43:8103 2606:4700:3030::6815:163` |
| DoH `myfitfolio.com` NS | `meera.ns.cloudflare.com. noel.ns.cloudflare.com.` |
| `GET https://myfitfolio.com/` | 525, `server: cloudflare`, `cf-ray` present |
| `GET https://myfitfolio.vercel.app/` | 200, `server: Vercel` |

The apex record is proxied. Cloudflare's edge cannot complete TLS to the Vercel origin, and Vercel needs a DNS-only
record (Cycle 1 tier-L evidence). **A-15 fired.** REQ-13's live clause moves to Phase 07 after `dns`.

`cloudflare-dns` refuses records it did not tag (`FOREIGN_RECORD`, `providers/dns/cloudflare-dns.mjs:89-91`), so the
owner removes the apex and `www` A/AAAA records in the Cloudflare dashboard before `dns` runs.

## 2026-10-20 — read-only key probes (`~/.arc-private/launch/myfitfolio.env`; values never printed)

```
probe cloudflare: pass 200        (GET /zones?name=myfitfolio.com -> exactly 1 zone; A-09 holds)
probe resend: pass 200
probe supabase: pass 200
probe razorpay-test: pass 200     (key id is rzp_test_)
probe razorpay-webhook (signing key named in the env file, value not read)
probe vercel: pass 200            (GET /v9/projects/{hosting's vercel-project}/env)
probe sentry: pass 200
probe pagespeed: pass 200
```
