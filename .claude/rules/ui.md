---
description: UI work guidance -- reuse the design system, design every state, run /arc-design before closing UI phases.
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
  - "src/components/**"
  - "**/*.css"
---

You are touching UI. Before any UI-bearing phase is marked done:

- Reuse existing design-system tokens/components -- no one-off styles or magic numbers.
- Design **every state**: hover / focus / active / disabled / loading / empty / error.
- Accessibility: WCAG AA contrast, visible focus, touch targets >= 44px, honour reduced-motion.
- Run **/arc-design** on the changed route/component; it must return `design: PASS`. Add `design` to `ARC_REQUIRED_REVIEWS` for this phase so /arc-ship is gated on it.

Kill AI slop on sight: generic gradient hero, three-equal-cards, emoji-as-icon, centre-everything, low-contrast grey text, inconsistent radius/shadow.
