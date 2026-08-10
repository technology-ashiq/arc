# 02 — review-cache-mjs

Subject: a three-module ESM review cache — `schema.mjs` (defaults + key validation),
`cache.mjs` (read/write with TTL), `index.mjs` (the CLI caller).

Discriminates: **can a rule keep a finding that lives between two files and only
appears at runtime?** F3 is that case: `computeVerdict` returns `null` for markdown,
`writeCache` persists it, `readCache` hands it back, and `verdictFor` reads `null` as
a miss — so the cache never hits for markdown. Every line involved is correct on its
own, so there is nothing to quote. F5 is the mirror: the most convincing-looking
finding in the set (path traversal via the cache key) is false, because
`assertSafeKey` one line above the cited line blocks it.

Under **Rule OLD** all 7 enter the report, 3 of them false.
Under **Rule NEW** F1, F4, F5, F6 reach the main report (F5 and F6 are false);
F2 (cite one line off), F3 (unquotable) and F7 (cite past EOF) go to the appendix.
Correct result: F3 survives as a tracked defect without a quote.
