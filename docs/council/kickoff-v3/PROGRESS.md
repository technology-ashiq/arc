# PROGRESS.md — arc-council v3 (cross-model juror)

> Scoped build tracker (arc's root PROGRESS.md untouched). Gate:
> `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v3`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — juror script (fake impl) + artifact/run-record contract + juror lint checks | 1 day | ✅ 2026-07-16 |
| 1 | Real providers (≥2) + protocol integration + dogfood + fabrication probe | 1.5 days | pending |

## Appetite burn
1 of 3 days used (Phase 0 closed; phase appetites sum to 2.5).

## Done-log
- 2026-07-16 — Kickoff: PLAN + ADRs 0015–0018 + 2 phase specs. Forks user-decided: provider-agnostic OpenAI-compat protocol (any provider/model/key via env — no vendor dependency, free models usable), required-when-configured, ADR-0014 charter scope. Surveyor confirmed codex CLI absent → nothing depends on it. Attack panel (merged A+C) fired ADR-0018's trigger at kickoff → SHA-256 verdict↔artifact binding pulled into scope (REQ-05).
- 2026-07-16 — **Phase 0 CLOSED ✅ (REQ-01/02 validated).** `council-juror.mjs` shipped (fake mode complete: OpenAI-compat envelope parse incl. content-parts + BOM, strict per-id ratings w/ contradiction rejection, empty-set marker, same-path + env-conflict + no-config guards, run-record without secrets; real fetch = named phase-1 error). Juror lint checks shipped red-first: tolerant Juror-line/heading detection + strict value grammar, bidirectional attribution, anchor-set coverage (first-pass Weak/Contested ∪ REBUTTAL LOG — defined once in ADR-0017's reconcile note), multiplicity guards, empty-marker-with-anchors rejection. **Adversarial pass found 12 issues — ALL fixed + pinned** (cosmetic-variant class: bold/bulleted Juror lines, double-space headings, prose mentions, unavailable-grammar dodge; script: same-path destroy, BOM, parts-array, fake-label stamping, self-contradiction; contract: anchor-set mismatch that would have fired on the real v2 dogfood). 13 fixtures; full v1/v2 regression + 11 holes + calibrate clean.

## Now
**Phase 0 CLOSED ✅ (2026-07-16).** The juror steel thread is built, adversarially hardened, and fully regression-clean. Committed on `feat/council-v3`.
**Next step:** Phase 1 (real providers ≥2 via env-only switch + arc-council.md juror step + SHA-256 binding + live dogfood + fabrication probe). **Needs Ashiq: ≥2 OpenAI-compatible API keys (free tiers fine — Groq/Gemini/OpenRouter/DeepSeek) at dogfood time, env-only.**
