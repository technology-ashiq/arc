# Design critique — docs/strategy/arc-hq-mockup.html

- target: `docs/strategy/arc-hq-mockup.html`
- screenshot_sha256: `af7b336a08aefac356ae425e054a7c8bb8bb4d25164d1abb98cf6e5b52d9533c`
- viewport: `1440x900@1`
- brief: none declared

## What I looked at
Full-bleed desktop (1440x900, static, no interaction states rendered) capture of "ARC HQ": top status bar + greeting banner, a 6-card KPI row, a left "TODAY — everything the company did" event timeline, and a right column with a 3-card Approval Inbox and the start of an Autonomy Ladder panel. No brief exists for this surface, so the findings below are judged only against what is objectively measurable in the pixels (contrast, target size, clipping, vocabulary, hierarchy) — not against an invented intent.

## Findings

- VIOLATION: Interactive buttons measure ~32px tall, not ≥44px — pixel-scanned the solid-blue fill on "Approve" (rows y=444–475, height 31px) and "Confirm kill" (y=724–755, height 31px) in the source PNG; every button in the Approval Inbox (Approve/Modify/Reject, Approve all/Review each, Confirm kill/Give it 30 days) and the Autonomy Ladder's "Promote" share this height — breaks the a11y floor's explicit ≥44px target-size requirement, on the exact controls the whole surface exists to drive a click toward.
- VIOLATION: L0/L1/L2 trust-level badges and the "BUILD ·", "GROWTH ·", "PORTFOLIO ·" meta labels render in a muted tan/brown (~rgb(122,90,48)) on a near-black card background (~rgb(26–33,26–33,25–32)) — measured contrast ≈2.76:1, computed via WCAG relative-luminance formula from the sampled colors, and confirmed visually in a 5x crop (the "L2" badge on the first timeline row, "BUILD · L1" / "GROWTH · L1→L2 TRIAL" / "PORTFOLIO · HUMAN-ONLY" on the three Approval Inbox cards). This fails AA for both normal text (4.5:1) and UI-component/large-text (3:1) minimums. It's a meaningful break specifically because autonomy-level is the page's core concept — an "Autonomy Ladder" panel exists to track it — yet the L-badges that carry that concept everywhere else on the page are the least legible text on screen.

- WEAKNESS: Timeline category-dot colour is reused across unrelated categories with no legend anywhere on the page — green appears on "discover", "ops", and "retro"; purple on "council" and "arc-oss"; amber/gold on "growth" and "leads" (confirmed by direct swatch comparison down the left column). Ten categories share roughly six colours, so a reader scanning by dot colour alone will group unrelated event types together — the exact opposite of what colour-coding is for. Either cut the categories the palette can't afford, or give each one its own hue.
- WEAKNESS: "YOUR TIME NEEDED" — the one genuinely actionable KPI card ("9 min", "3 decisions in inbox") — uses identical visual treatment (white number, grey caption, same card chrome) to the five purely informational cards beside it (Revenue, MRR, Ideas, Builds, Content). The same fact is then restated a second and third time by the top-bar pill ("● 3 approvals waiting") and the greeting-banner sentence ("9 minutes of your time... await you"), with no single instance carrying more visual weight than the others to serve as the definitive call to action.
- WEAKNESS: Both the "TODAY" timeline and the "AUTONOMY LADDER" panel hard-clip at the bottom of the viewport with no affordance signalling more content exists. The last visible timeline row ("21:00 · retro · Daily retro: 2 playbook rules added...") is sliced mid-glyph by the frame edge, and Autonomy Ladder shows exactly one rung ("content.publish") before the same cutoff — no fade-out gradient, scroll cue, or "N more" indicator anywhere in the rendered state to tell the reader the list continues.

- POLISH: The top-bar status-pill row (sessions live / automated processes / today's cost·return / approvals waiting / date-time) mixes five differently-sized pills with accent dots on only two of them — a small inconsistency in an otherwise disciplined rhythm.

## What is working
Hierarchy at the decision layer is genuinely good: blue is reserved almost exclusively for the one primary CTA per Approval Inbox card, and each card surfaces exactly the evidence (council score, pain score, kill-criteria-met, batch approval history) a reader needs before pressing it — a clean "what must be visible before the action" execution. Content is real-shaped throughout — actual ₹ amounts, specific product names (GST-Recon, InvoiceFly, PromptVault), a natural-language daily summary — with zero lorem ipsum or generic placeholder copy. The dark, dense operator-console type scale (KPI numbers vs. captions vs. timeline body vs. tags) reads as a deliberate decision, not four random sizes.

Gap: no rendered focus, hover, empty, loading, or error state exists for this run, so visible-focus and full state-matrix cannot be judged here — reporting that as an absence of evidence, not a pass.
