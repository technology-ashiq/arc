# arc — Speak To The Company (v0.4 · the WORKING HQ)

Not a site about arc — **arc, operating**. Two layers over one persistent
particle face (the only element kept from the original concept, by request):

- **landing** — the face at full presence → ENTER HQ
- **hq** — the command room: eleven rooms over the dimmed face, where
  **everything on screen derives from a live event spine** and the face
  talks with a **real model brain** you plug in.

## Run it

```bash
npm install
npm run dev        # full experience (+ real-spine dev API)
```

Or open `dist/index.html` straight from disk (pre-built; everything works
except the real-spine dev API, which needs the dev server).

## The three "real"s

**1 · Real events, not static panels.** An in-browser spine: append-only
event store + virtual clock (⏸/1×/10×/60× in the top bar). A seeded
simulator streams a virtual arc day — discover hunts, council verdicts,
phases closing, capped outreach, canary sweeps, revenue (labeled
`revenue.simulated`; real ₹ stays 0 and says so), day.closed, next day.
Every panel is a derived view over the log; approving/rejecting/promoting
APPENDS events (`decision.recorded`, `autonomy.changed`) — history is
never mutated. Optionally render **your real spine** (read-only): copy
`.env.example` → `.env.local`, set `ARC_SPINE_DIR`, `npm run dev`,
then Engine room → connect.

**2 · Real brain.** Engine room → pick a driver, paste a key:
**Claude · ChatGPT · Gemini · OpenRouter · any OpenAI-compatible URL**
(z.ai, DeepSeek, ollama, LM Studio…). Streaming answers, spoken sentence
by sentence. The system prompt carries the full arc knowledge base plus a
LIVE STATE snapshot (inbox, KPIs, timeline, ladder, room), so it answers
about *now* — and it can OPERATE the HQ via an action protocol: open
rooms, approve/reject with your voice, change sim speed. Money-touching
and kill decisions are refused by prompt contract (E2 — human
sovereignty). Keys live in localStorage on this machine only; calls go
browser → provider directly. No key → the offline matcher still answers
(including live-state questions), honestly labeled.

**3 · Real interaction.** Approval cards carry the three facts the HQ
design brief demands (council verdict · ₹ at stake · kill-criteria state)
ON the card; approve/reject-with-reason land in a done log with receipt
ids; `j/k` moves between cards, `a` approves, `r` rejects. Every ⌗ opens
the receipt drawer (payload, day, immutability notes). The council room
convenes live sessions; the autonomy room promotes/demotes with evidence;
gates switch profiles; charts hover; the ladder, pipeline and portfolio
all move with the log.

## The rooms

| # | room | functionality |
| --- | --- | --- |
| 00 | overview | brief (≤40 lines) · KPI row · live timeline · approval inbox (j/k/a/r) · done log |
| 01 | the spine | full log + filters + legend · receipt drawers · 8 spine laws (ADR-0024…0031) · integrity notes · data source |
| 02 | factory | live cycle C3 phases · gates + profile switch (WARN→TRIAL→FAIL) · 8 modules · all 23 commands (searchable) · all 24 agents · golden loop |
| 03 | council | convene live sessions (seats → verifier grades → verdict lands as council.verdict) · session 001 (real) · Brier calibration (honest 0) |
| 04 | portfolio | idea→money pipeline · venture cards + kill-distance meters (LexOS real receipts) · portfolio math |
| 05 | autonomy | full ladder with promote/demote → autonomy.changed · forever-human list · trial-ledger logic |
| 06 | money | 14-day revenue chart (hover) · real ₹0 vs simulated split · cost/return · north-star · milestones |
| 07 | learn | playbook rules + recall search (memory preview) · evolve champion/challenger · juror calibration · sleeping queue |
| 08 | the law | constitution: precedence · E1–E3 · A1–A10 · amendment friction · adoption state |
| 09 | story | the ten explainer chapters (the v0.3 informative layer, kept) |
| 10 | engine room | the multi-model brain config · data source · voice · privacy — arc's "models are parts" ideology, running |

## Map

```
src/spine/    kinds · store (event log + clock + actions) · sim (seeded day) · derive (all views)
src/brain/    llm (4 wire formats, streaming) · persona (knowledge + live state + action protocol) · brain · localBrain
src/hq/       Landing · HQ shell · bits · rooms/ (11)
src/face/     FaceStage — the kept particle face, presence-driven, voice-woken
src/lib/      voice (ears+mouth, sentence streaming) · stage · uiBus
src/chapters/ the story room's ten chapters
```

> Design-only concept. Intentionally **not** committed to the arc repo —
> and the real-spine mode only ever READS.
