# UI Conventions

- Components: function components + hooks. One per file, PascalCase.
- Styling: Tailwind utilities. Shared tokens in `styles/tokens.css`. No inline hex colors.
- Icons: lucide-react only.
- State: local first; lift to `lib/store/` only when shared.
- Accessibility: every interactive element keyboard-reachable; label icon-only buttons.
- Loading / empty / error states are required for any async view.
- Reuse `components/ui/*` primitives before building new ones.
