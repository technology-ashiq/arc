# Learning ledger — context-pack fixture

> Three rows by construction: one that matches the fixture slice's area and carries typed links,
> one that matches nothing, and — appended by the second-arrangement test only — one that links the
> two-hop item directly, so absence-by-transitivity can be told apart from presence-by-second-path.

#### learning: L-101

what-failed: a token was checked after the handler had already written its response
why-missed: the check and the handler were reviewed in separate PRs and neither named the ordering
prevention: verify the token before the handler, never after
type: rule
tag: anti-pattern
area: auth
adr: 0900
rule: CLAUDE.md
fixture: tests/fixtures/auth-token.md
phase: 00
lane: develop
cost: one extra assertion per handler
verdict: proposed

#### learning: L-103

what-failed: a modal trapped focus and the escape key did nothing
why-missed: keyboard paths were never in the manual pass
prevention: every dismissible surface gets a keyboard test
type: fixture
tag: common-mistake
area: ui
adr: 0902
phase: 00
lane: develop
cost: one test per modal
verdict: proposed
