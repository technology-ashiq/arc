---
description: Testing conventions — pure logic, deterministic fakes, no network.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
  - "e2e/**"
---

# Testing Rules

- Unit tests never touch the network, disk, or a real DB — use the fake impl behind each
  adapter interface (build playbook §3.2/§3.4).
- Test pure functions directly. If logic is hard to test, extract it from the I/O first —
  don't mock your way around bad structure.
- Every bugfix starts with a failing test that reproduces it. Fix, then watch it pass.
- Fakes are deterministic: derive stable values from the input, never random.
- e2e (Playwright) tests user flows, not implementation details; runs against the local stack.
- A test per feature — the test is the contract for "done" (playbook §5).
- Never pipe a test runner into `tail`/`head`/`grep` — the pipeline's exit code comes from the
  LAST stage, so a failing suite reports success. Redirect to a file and read it, or check
  `${PIPESTATUS[0]}`. A masked red suite is worse than no suite.
