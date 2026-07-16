# PROGRESS.md — arc-council v3 (cross-model juror)

> Scoped build tracker (arc's root PROGRESS.md untouched). Gate:
> `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v3`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — juror script (fake impl) + artifact/run-record contract + juror lint checks | 1 day | ✅ 2026-07-16 |
| 1 | Real providers (≥2) + protocol integration + dogfood + fabrication probe | 1.5 days | 🔨 key-independent core done (REQ-05 ✅); ≥2-real-provider runs + live dogfood await Ashiq's keys |

## Appetite burn
2.3 of 3 days used (Phase 0 closed + Phase 1 key-independent core; ~0.2d of live-dogfood work parked on keys).

## Done-log
- 2026-07-16 — Kickoff: PLAN + ADRs 0015–0018 + 2 phase specs. Forks user-decided: provider-agnostic OpenAI-compat protocol (any provider/model/key via env — no vendor dependency, free models usable), required-when-configured, ADR-0014 charter scope. Surveyor confirmed codex CLI absent → nothing depends on it. Attack panel (merged A+C) fired ADR-0018's trigger at kickoff → SHA-256 verdict↔artifact binding pulled into scope (REQ-05).
- 2026-07-16 — **Phase 0 CLOSED ✅ (REQ-01/02 validated).** `council-juror.mjs` shipped (fake mode complete: OpenAI-compat envelope parse incl. content-parts + BOM, strict per-id ratings w/ contradiction rejection, empty-set marker, same-path + env-conflict + no-config guards, run-record without secrets; real fetch = named phase-1 error). Juror lint checks shipped red-first: tolerant Juror-line/heading detection + strict value grammar, bidirectional attribution, anchor-set coverage (first-pass Weak/Contested ∪ REBUTTAL LOG — defined once in ADR-0017's reconcile note), multiplicity guards, empty-marker-with-anchors rejection. **Adversarial pass found 12 issues — ALL fixed + pinned** (cosmetic-variant class: bold/bulleted Juror lines, double-space headings, prose mentions, unavailable-grammar dodge; script: same-path destroy, BOM, parts-array, fake-label stamping, self-contradiction; contract: anchor-set mismatch that would have fired on the real v2 dogfood). 13 fixtures; full v1/v2 regression + 11 holes + calibrate clean.

## Now
**Phase 0 CLOSED ✅ + Phase 1 KEY-INDEPENDENT CORE done (2026-07-16).** Shipped: real OpenAI-compat `fetch` path (retry + auth/rate-limit/timeout/network taxonomy, clean exit codes — proven end-to-end against a **local mock server**, 8 requests confirming the retry counts); the SHA-256 verdict↔artifact binding (`Juror-Artifact-SHA256:` + `--juror-artifact` lint flag) catching hash-mismatch, doctored-display, and the **P2 fabrication attack** (REQ-05 ✅); arc-council.md step 5c (juror invocation on the anchor set) + `## JUROR RATINGS`/`Juror:`/`Juror-Artifact-SHA256:` in the step-7 template; `docs/council/README.md` juror config docs. Full v1/v2/v3 regression + 11 holes + calibrate clean. Committed on `feat/council-v3`.
**Only remaining (needs Ashiq): ≥2 OpenAI-compatible API keys (free tiers fine — Groq/Gemini/OpenRouter/DeepSeek), env-only.** With them: run the juror against ≥2 REAL providers (REQ-03) + one live deep-run dogfood through the juror (REQ-04) → Phase 1 + v3 close.
