# PROGRESS.md — arc-council v3 (cross-model juror)

> Scoped build tracker (arc's root PROGRESS.md untouched). Gate:
> `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v3`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — juror script (fake impl) + artifact/run-record contract + juror lint checks | 1 day | ✅ 2026-07-16 |
| 1 | Real providers (≥2) + protocol integration + dogfood + fabrication probe | 1.5 days | ✅ 2026-07-16 |

## Appetite burn
2.7 of 3 days used (BOTH phases closed; 0.3d slack unspent). On budget, no scope cut.

## Done-log
- 2026-07-16 — Kickoff: PLAN + ADRs 0015–0018 + 2 phase specs. Forks user-decided: provider-agnostic OpenAI-compat protocol (any provider/model/key via env — no vendor dependency, free models usable), required-when-configured, ADR-0014 charter scope. Surveyor confirmed codex CLI absent → nothing depends on it. Attack panel (merged A+C) fired ADR-0018's trigger at kickoff → SHA-256 verdict↔artifact binding pulled into scope (REQ-05).
- 2026-07-16 — **Phase 1 CLOSED ✅ (REQ-03/04/05 validated) — LIVE cross-model juror.** Real `fetch` path (retry + auth/rate-limit/timeout/network taxonomy, natural-drain clean exit — proven vs a local mock server: 8 requests confirming retry counts). SHA-256 verdict↔artifact binding (`Juror-Artifact-SHA256:` + `--juror-artifact`): catches hash-mismatch, doctored-display, and the P2 fabrication attack (REQ-05). arc-council.md step 5c + template + README config. **Live proof:** the SAME script produced SHA-bound artifacts from TWO real providers changing only env — Gemini `gemini-2.5-flash-lite` + OpenRouter `gemma-4-26b:free` (REQ-03); a live Gemini juror re-graded the v2 dogfood anchor set (A1/S4 Plausible, A4 Weak — independently corroborating the panel) → `dogfood/verdict.md` + artifact pass the hardened gate, and a live 1-rating tamper is caught (REQ-04/05). Key-in-artifact grep clean on every run. Binding adversarial pass in flight at close; SHA-line detection pre-aligned to the hardened Juror-line tolerance. Full v1/v2/v3 regression + 11 holes + calibrate clean.
- 2026-07-16 — **Phase 0 CLOSED ✅ (REQ-01/02 validated).** `council-juror.mjs` shipped (fake mode complete: OpenAI-compat envelope parse incl. content-parts + BOM, strict per-id ratings w/ contradiction rejection, empty-set marker, same-path + env-conflict + no-config guards, run-record without secrets; real fetch = named phase-1 error). Juror lint checks shipped red-first: tolerant Juror-line/heading detection + strict value grammar, bidirectional attribution, anchor-set coverage (first-pass Weak/Contested ∪ REBUTTAL LOG — defined once in ADR-0017's reconcile note), multiplicity guards, empty-marker-with-anchors rejection. **Adversarial pass found 12 issues — ALL fixed + pinned** (cosmetic-variant class: bold/bulleted Juror lines, double-space headings, prose mentions, unavailable-grammar dodge; script: same-path destroy, BOM, parts-array, fake-label stamping, self-contradiction; contract: anchor-set mismatch that would have fired on the real v2 dogfood). 13 fixtures; full v1/v2 regression + 11 holes + calibrate clean.

## Now
**arc-council v3 FEATURE-COMPLETE ✅ — both phases closed, all 5 REQs validated (2026-07-16).** The cross-model juror closes ADR-0014's single-author fabrication residual in practice: `council-juror.mjs` (any OpenAI-compat provider by env) writes a SHA-bound artifact; `council-lint --verdict --juror-artifact` ties the verdict to what a DIFFERENT model actually said. Live-proven with real Gemini + OpenRouter (REQ-03 env-only switch; REQ-04 dogfood juror corroborated the v2 anchor grades; REQ-05 the P2 fabrication attack + doctored-display caught, live tamper bites). On budget (2.7/3 days). Committed on `feat/council-v3`.
**Caveat (honest):** the P1 binding **adversarial pass was still in flight at close** — the SHA-line detection was pre-emptively aligned to the hardened Juror-line tolerance (the cosmetic-variant class); any workflow findings fold as a follow-up commit, same pattern as prior phases where the adversarial pass hardened already-green gates.
**Next step:** project retro → open the v3 PR (Ashiq pushes `feat/council-v3`; PR stacks on #25 — merge #25 first). v4 backlog: stakes tiers, asker-context slot, LC-privacy default, specialist template.
