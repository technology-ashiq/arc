# Neutral (POINT-IDs N1–N6)

## STANCE
NEUTRAL

## KEY POINTS
- N1 [Low] Base rate favors deferral, not "never": the most-cited pattern is monolith-first, decompose-later; greenfield/early splits struggled because boundaries weren't yet known. — Evidence: F2, F1.
- N2 [Low] Team-size/ownership mismatch is the crux at 10 people: the org can autonomously own only ~1–3 services, so a broader split either concentrates ownership across "separate" services (distributed monolith) or forces a platform/DevOps function that eats the same 10 headcount. — Evidence: F3, F4, F11.
- N3 [Low] The added cost is real and roughly fixed regardless of team structure: orchestration, discovery, tracing, per-service CI/CD, Saga consistency — paid upfront, while the payoff only materializes under specific conditions. — Evidence: F5 vs F7/F8.
- N4 [Low] No headcount threshold exists in the source material — readiness is deployment-automation + monitoring maturity + genuine autonomy needs, so "10 people" alone resolves nothing; what would resolve it is exactly what the brief lacks. — Evidence: F9.
- N5 [Low] A middle path the binary framing obscures: a modular monolith captures most of the maintainability benefit without the distributed tax, and preserves the option to peel off a service later once boundaries stabilize. — Evidence: F10.
- N6 [Low] The scale precedent usually invoked (Netflix/Amazon/Uber) is explicitly not analogous — they moved after hundreds-to-thousands of engineers. — Evidence: F6.

## STRONGEST ARGUMENT
The team-size/ownership mismatch (F3) + the ops tax and platform-staffing draw (F5, F11): at 10 engineers, splitting almost certainly either creates a distributed monolith or diverts scarce headcount from product — unless this org already has 3+ genuinely autonomous domain teams facing F7's divergent conditions. That "unless" does all the work, and the brief has no fact confirming or ruling it out.

## BIGGEST UNCERTAINTY
Whether this is a reactive decision (a concrete already-felt pain matching F7) or a proactive/speculative one (matching F8's pre-PMF, shifting-boundaries failure mode). The brief supplies only generic priors and zero facts about this company's actual trigger, CI/CD maturity, or team structure.

## IF I'M WRONG
I'm assuming the 10-person team is ~one team across the whole codebase (typical at this stage), which makes F3/F4's mismatch bite. If instead they're already 3+ independently-shipping domain teams with different scaling/compliance needs (F7), the mismatch objection weakens and migrating now could be reasonable.
