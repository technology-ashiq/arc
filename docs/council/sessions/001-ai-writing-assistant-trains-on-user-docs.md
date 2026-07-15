# arc-council — Launch a paid AI writing assistant that trains on users' documents? (2026-07-15)

Roster: advocate, skeptic, neutral, strategist, risk-analyst, marketer, policy-analyst; dropped (ceiling 4): engineer, designer.
Verifier evidence-corrections: Garante €15M OpenAI fine ANNULLED (Court of Rome, 18-Mar-2026); EDPB 8-Jul-2026 AI-training guidance is draft/in-consultation; the "43 days" figure was raise-to-launch not collapse; FTC disgorgement cases all involved unlawfully-collected data.

## VERIFIER RATINGS
- A1: Plausible — per-tenant data as a moat is real, but conflates shared-training with per-tenant data
- A4: Supported — privacy-as-trust-wedge, honestly scoped to per-tenant architecture
- A5: Weak — "higher survival base rate" unsupported, contradicted by thin-wrapper mortality
- S1: Supported — Jasper thin-wrapper collapse verified ($1.5B cut; $120M→$55M)
- S4: Supported — CAC + awareness-moat data back "acquisition blocks the user base the moat needs"
- S5: Supported — horizontal shape contradicts the vertical/proprietary-data moat
- N2: Contested — bounded-downside holds for Regime B, understates the Regime-A legal/ruin tail
- ST1: Supported — "chat with your docs" is now a free bundled platform feature (NotebookLM, Projects, Copilot)
- ST2: Supported — CAC economics back "can't win paid acquisition vs free features"
- ST3: Supported — durable edge = vertical workflow + per-customer data, not model quality
- ST4: Supported — cleanest Regime A/B fork: per-tenant = enterprise asset; shared-model = landmine
- RK1: Contested — asymmetry directionally reasonable, but evidence compromised (annulled fine, draft EDPB)
- RK2: Supported — ~16-month median SaaS CAC payback + low incumbent price ceiling verified
- MK1: Supported — Grammarly ~30-40M DAU, ChatGPT ~800M WAU; awareness moats unbuyable by two people
- PO3: Supported — FTC algorithmic-disgorgement cases verified (scoped: unlawful collection)
- PO4: Supported — can't honor erasure from shared weights, but CAN do opt-in per-tenant RAG

## VERDICT
PREDICTION: CONDITIONAL / Medium (recorded at intake, before the research and the verifier) → RESULT: CONDITIONAL / Medium — prediction held; the evidence sharpened the reasoning (the decisive Regime-A-vs-B distinction, and the verifier gutting an annulled-fine citation), but this was a model-knowledge run, so per ADR-0010 the confidence is held at Medium — offline priors cannot carry High.
DECISION: CONDITIONAL
CONFIDENCE: Medium
Research mode: model-knowledge

KEY REASONS:
- [ST1] "Chat with your documents" is now a free, bundled platform feature (NotebookLM, ChatGPT/Claude Projects, Copilot) — a horizontal paid assistant sells what the platforms give away, so [S5] the horizontal shape has no defensible moat.
- [ST3] The one durable edge is a specific vertical workflow + accumulated per-customer data (switching costs), not model quality — so the winnable version is narrow, not horizontal.
- [S4] Two bootstrapped founders can't win paid acquisition against free, bundled incumbents ([MK1] Grammarly ~30-40M DAU, ChatGPT ~800M WAU; [RK2] ~16-month median CAC payback); only a niche reachable organically survives ([ST2]).
- [ST4] Privacy is a positioning fork: [PO4] per-tenant personalization (RAG, opt-in, NO shared-model training) captures the proprietary-data moat AND is the safe, buildable path, whereas [PO3] shared-model training risks algorithmic disgorgement (the FTC ordering deletion of the model itself) — existential for a 2-person team. Done per-tenant, [A4] the same "your data" fact becomes a trust wedge.

DISSENT (strongest surviving opposing point):
- [A1] Training on the user's OWN data is exactly the proprietary-data moat that commoditizing base models make more valuable, not less — so the "no" is only to the horizontal, shared-training version. Pick one real vertical, build it per-tenant, and this is a genuine, defensible business with downside bounded to founder time.

CHEAPEST TEST TO DE-RISK:
- Before building: (1) name ONE narrow, high-value vertical where you already have distribution or domain credibility and get 3-5 paying design partners to commit (proves willingness-to-pay above free tools); (2) fix the architecture as per-tenant RAG/personalization with explicit opt-in consent and NO shared-model training (removes the Regime-A ruin vector). Can't find design partners in a nameable niche, or can't commit to per-tenant → don't launch.

---
> **Correction (2026-07-15, ADR-0010).** CONFIDENCE lowered High → Medium and the PREDICTION→RESULT
> line reworded to match. This was a `model-knowledge` (offline) run, and arc-council v2's confidence
> discipline caps offline verdicts at Medium: facts drawn from model priors — not live, triangulated
> sources — cannot ground a High-confidence decision. The verdict itself (CONDITIONAL, and its
> reasoning) is unchanged; only the confidence claim is corrected. The original text is preserved in
> git history. This is the single sanctioned edit of a saved verdict (see the v2 append-only
> non-negotiable).
