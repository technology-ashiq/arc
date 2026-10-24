# Phase 00 -- CI runs on PR #461

| run | head | event | what it proves |
|---|---|---|---|
| 40031569932 | 41aaeef0 | pull_request (draft) | every job skipped on a draft (REQ-02) |
| 40031621509 | 41aaeef0 | ready_for_review | first real run: 7 green, security + bats (0) + bats (1) red, test red as their aggregate |
| 40033731328 | 8d396b4f | synchronize | arc-scan now passes; security red on the NEW `npm audit` step: 2 high in face (source-map-js 1.2.1, vite 8.2.2) |

## 40031621509 -- three reds, three root causes

- **security**: arc-scan `arc-js-child-process-shell` at `ci-floor.mjs:52`. The rule reads any
  `$X.exec(var)` as a shell exec, and `DROP_ROW.exec(line)` is a RegExp. Fixed in code (`String.match`),
  not baselined: a false positive in our own new code costs a word, a baseline row costs every later reader.
- **bats (1)** `plan-bound-audit`: `ci-changes.mjs` called git through a `git(args)` wrapper; the audit
  reads a variable argv as a write (fail closed). Inlined with literal argv (`cat-file`, `diff` -- reads).
- **bats (0)** `launch-contract` rollback fixture: `node --test` defaults to the spec reporter since
  Node 23, so `# pass N` never printed and the fixture counted 0. Pinned `--test-reporter=tap`.
  This is A-01 firing (PLAN Assumptions).

The follow-up run on the fixed head is appended below once it completes.

## 40033731328 -- npm audit, pre-existing on main

The old ci.yml never ran `npm audit`, so these two highs were already on main, unseen. Fixed with
`npm audit fix --package-lock-only` in face: vite 8.2.2 -> 8.3.5 (minor), source-map-js 1.2.1 -> 1.2.2,
and vite's own toolchain (rolldown 1.2.5 -> 1.2.15, @oxc-project/types, postcss, nanoid, picomatch
patches). Build tooling only; the face job's tsc + vite build is the proof.
