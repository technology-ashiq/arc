# Arc — The Face Of The Factory (design concept)

A front-of-house design for the **arc** repo: a particle human face that
listens, thinks over the repo's real knowledge, and **replies out loud** —
about all 6 products, 22 commands, 23 agents, the council, the gates, the
autonomy ladder and the HQ vision.

> Design-only concept. Intentionally **not** committed to the arc repo.

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL in Chrome
```

- **Voice input** (mic) needs Chrome/Edge on `localhost` or `https` and mic
  permission. Typing always works in every browser.
- **Voice output** uses the browser's built-in speech synthesis — no keys,
  no backend, everything runs locally.

## What is what

| Piece | Origin |
| --- | --- |
| `src/sections/S1_FaceOfArc.jsx` | **Face module ported from Ashiq's chosen concept** — jiro.build "Human Synthesis Header – The World": 90×90 particle cyber-mask (eye cutouts, mouth slit, nose/lip sculpting), 14k-particle ambient cloud, UnrealBloom, mouse repulsion physics, Anybody typography. Layered on top: the talking mouth (speech-energy driven), listening color morph, thinking drift, captions + voice dock. |
| `src/lib/voice.js` | New — mic (SpeechRecognition) → local brain (keyword matching) → speech synthesis; `bus` drives the face animation. |
| `src/data/arcKnowledge.js` | New — generated from the repo's real docs (README, usermanual, manifests, all commands + agents, strategy docs). Regenerate by re-reading the repo when things change. |
| `S2_Products … S6_Footer` | New design in the same visual language (black / cyan `#00ffd1` / Anybody + JetBrains Mono). |

## Sections

1. **The Face** — hero, sticky scroll-zoom, voice conversation
2. **Products** — the six installable products
3. **Commands** — all 22, terminal wall with live detail panel
4. **Agents** — council ring of 12 jurors + the field floors
5. **The Loop** — pipeline tape, gates, L0–L4 autonomy ladder
6. **Receipts** — vision cards, stats, the closing quote

## Try asking the face

- "What is Arc?" · "Enna products iruku?"
- "What does /arc-kickoff do?" (every command answers by name)
- "How does the council work?" · "Who built you?"
- "Explain the autonomy ladder" · "Where is this heading?"
