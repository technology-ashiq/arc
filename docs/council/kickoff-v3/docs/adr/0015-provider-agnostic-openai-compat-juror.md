# ADR 0015 — Provider-agnostic juror via the OpenAI-compatible chat-completions protocol

**Status:** accepted (supersedes, for the juror only, v1/v2's "no external paid APIs" no-go)
**Date:** 2026-07-16
**Reversibility:** one-way
**Revisit trigger:** a provider the user genuinely needs has no OpenAI-compatible endpoint and cannot be
proxied (e.g. via OpenRouter), or ≥2 target providers drift from the compat request/response shape —
either forces a per-provider adapter layer.

## Context
The cross-model juror inherently needs an external model — the first council feature that does, so the
v1/v2 "no external paid APIs" no-go is explicitly superseded here (juror only; research still uses the
built-in WebSearch/WebFetch). The codex CLI is confirmed NOT installed on this machine, and the user's
requirement is explicit: **no single-provider dependency** — "provider, model, api key kodutha athu use
pannikanum" — including free-tier models (Gemini, Groq, DeepSeek, NVIDIA NIM, OpenRouter free routes).

## Options considered
1. **OpenAI-compatible protocol + env config** — a zero-dep node `fetch` speaking `POST /chat/completions`,
   configured by `JUROR_BASE_URL` + `JUROR_MODEL` + `JUROR_API_KEY` — pros: one protocol covers OpenAI,
   xAI/Grok, DeepSeek, Groq, NVIDIA NIM, Together, OpenRouter, and Gemini's compat endpoint (free tiers
   included); no install; unset key degrades cleanly; cons: providers that lack a compat endpoint need a proxy.
2. **Install the codex CLI** — matches the arc-second-opinion precedent — cons: not installed, adds a
   toolchain dependency, and locks the juror to one vendor.
3. **Pluggable `JUROR_CMD` (any CLI)** — maximum flexibility — cons: output parsing varies per CLI, the
   contract becomes untestable as one surface.
4. **Per-provider SDKs** — cons: npm dependencies (breaks the zero-dep script idiom) and an adapter zoo.

## Decision
Option 1, per the user's explicit choice. `council-juror.mjs` speaks the OpenAI-compatible
chat-completions protocol via plain `fetch`; the provider is whatever `JUROR_BASE_URL`/`JUROR_MODEL`/
`JUROR_API_KEY` point at. The carrying reason: one well-established protocol buys nearly every provider —
including free models — with zero installs and zero vendor lock-in.

## Consequences
Easier: switching juror models is an env change; contract testing targets ONE request/response shape;
free-tier experimentation is trivial. Harder: non-compat providers are out of scope for v3 (proxy or
revisit trigger); response-format discipline must be enforced in the prompt since different model
families format output differently (assumptions ledger carries the trigger). Keys live in env only —
never committed, never echoed into artifacts or run-records.
