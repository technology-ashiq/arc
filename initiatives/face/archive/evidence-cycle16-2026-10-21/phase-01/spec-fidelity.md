# Phase 01 — spec-fidelity report (verbatim)

Fresh `spec-fidelity` agent, reading only `initiatives/face/phases/phase-01-spec.md` and
`git diff af7c85cf..0b51ea17`. Filed as returned; dispositions are in `handoff.md`.

---

# Phase 01 fidelity check: spec vs. diff `af7c85cf..0b51ea17`

I read only the spec and the diff. `initiatives/face/phases/phase-01-tasks.md` is part of the diff, but it's the slice ledger, so I skipped it.

## 4. Non-negotiables

Nothing clearly breaks a rule. Two rules are under strain, and one issue got a little worse:

- **Under strain: "The reference is the target: v0.7 is the canonical design…"**
  - The spec's rabbit-hole section says: "the only permitted delta is ADR-1322's council rule."
  - The new header in `docs/design/system/tokens.css` lists more changes than that:
    - Seven v0.7 colours were moved to pass the 4.5:1 floor: dark `--text-3`, and light `--text-3`, `--accent`, `--green`, `--amber`, `--red` and `--blue`.
    - Dark `--on-red` was re-pointed to `--bg-0`.
  - The spec contradicts itself here. Exit criterion 2 fails any pair under 4.5:1, and v0.7's own values fail that floor. The spec never says which rule wins.
  - The author settled it inside the token file instead of changing the spec. I can't tell from these two files whether ADR-1318 or ADR-1330 allow floor corrections, or whether every other value really is v0.7's.
- **Borderline: "Every decision lives in a `.mjs`… View.tsx carries no branch worth asserting."**
  - `face/src/App.tsx` now has `mood === 'dark' ? <FaceStage…/> : null`. Whether the face renders at all is decided in TSX, and nothing tests it.
  - The mood rules themselves are in `face/src/lib/mood.mjs`, with no imports, and l3-logic tests them.
- **Not broken, but slightly worse: "Localhost + token; no PII…"**
  - `face/index.html` adds Inter to the existing Google Fonts link. The diff's own debt-ledger row says this goes "against the localhost posture of ADR-1312".
  - I found no email addresses or other PII in the added lines. Error lines are still redacted, and are now also JSON-escaped.
- **Respected:**
  - **One token source:** the generated copy matches the source byte for byte after its banner. The lint fails from day one. Council is `--kind-council: var(--accent-dim)`, and violet is only reached through `--sim-fg` and `--mode-sim`.
  - **Tailwind stays in L3:** it enters only through `vite.config.ts` and `index.css`, and no `lib/*.mjs` file imports it. An l3-logic check enforces this.
  - **Both moods ship together:** both token blocks, the toggle, and a harness that runs both moods and refuses a partial `--moods`.
  - **No facts bundle.**
  - **No new surface outside `.claude/scripts/`:** the lint is in `.claude/scripts/core/` and registered in `products/core/manifest.json`.
  - **Test discipline:** the structural lint fails from day one, there were two attackers, and each test checks it ran before trusting its output (`moods=2 pairs=` ≥150, `RAN:` ≥35, files scanned > 0).
- **Real vs simulated:** the 9 rooms' logic is unchanged.
  - Apart from CSS, the changed lines in the 9 rooms are re-indentation.
  - Every removed JSX text string still exists at head, now as a prop. `SIMULATED` appears 8 times before and after.
  - Money's simulated panel is violet plus hatch.
- **Not touched:** the room registry, `/api/decide` parity, spine kinds (the mood only goes to localStorage), branch-only writes, the WORK and SESSION doors, Ask/`ASK_ACTIONS` (AskArcRoom is a reskin only), REQ-10.
- **Not yet evaluable from a diff:** owner approval, one PR per phase, `/arc-phase-done` from the main clone, CI green.

## 1. Exit criteria

1. **tokens.css rewrite: satisfied.** The source file has 287 insertions and 0 deletions, so `:root` is byte-for-byte unchanged. New `html.hq` and `html.hq.hq-light` blocks; `--blue` is in both. Council maps to `--accent-dim`, and violet only serves simulated/non-real.
2. **Computed contrast: satisfied.** `tests/face/tokens-contrast.mjs` measures text on 7 surfaces, chips, fills and UI pairs (at 3:1). `--write` fills the `BEGIN/END computed-contrast` block. Check mode fails a stale or hand-typed block, or any pair under its floor. The selftest cases are pinned by name in `tests/face-l3.bats`.
3. **Generator: satisfied.** `face/src/tokens.css` at head is the banner plus the source, byte for byte. The planted-edit tests already existed before this phase; Phase 01 added a linked-copy test. `--check` exiting 0 can only be confirmed on CI.
4. **Dependencies and lockfile: satisfied in content.** Added `tailwindcss` and `@tailwindcss/vite` ^4.3.3, and `@phosphor-icons/react` ^2.1.10. No other icon library is imported under `face/`. The lockfile has oxide, lightningcss and rolldown builds for linux-x64-gnu, darwin-arm64 and win32-x64-msvc; bats now requires all three by name. Passing on all three OSes can only be confirmed on CI. Whether these are "the ranges verified in ADR-1323" I can't tell from these two files.
5. **Kit ported: satisfied.** All 8 named components are exported. `@custom-variant hq-light (&:where(html.hq.hq-light, html.hq.hq-light *))` is in `face/src/index.css`. There is no `invert(` anywhere under `face/`, and an l3-logic check enforces that.
6. **Colour-literal lint: satisfied.** Scans `face/src/ui` and `face/src/modules` by default, prints `scanned=N`, exits 1 when zero files were scanned; no WARN phase. Planted hex, `white` and `black` fixtures each exit 1 with a named finding. `modules/` doesn't exist yet, so today only `ui/**` is actually read.
7. **9 rooms and the browser mood check: partly satisfied.** All 9 rooms import `RoomHead` and `HPanel` from `../ui/bits`. `smoke.mjs` sets the mood in storage before page scripts run, reads the `<html>` classes for each room, and prints a `mood-miss` count. `face-browser.bats` judges dark and light separately and includes a mutant control. See drift (a) and (e).
8. **Block A tripwire in PROGRESS.md: missing from the diff.** Nothing in this range changes `PROGRESS.md`. The owner's by-eye read is not yet evaluable.
9. **Two attackers: mostly satisfied.** `attacker-reports.md` records the two attack areas and that both attackers got the fixed-defect list. `fixed-defects.md` gains 22 entries, and the fixes are pinned in selftests and bats. Not every hole was fixed (see drift d). That the attackers were fresh is self-reported.
10. **CI green; `/arc-phase-done`:** not yet evaluable.

## 3. Exit-criteria drift

**(a) Rooms "render on the kit" in a narrower sense than written.** Each room now uses the kit's `RoomHead` and `HPanel` as its outer frame. Inside, each still has its own 58–123 line inline `const CSS` block using the old landing token names, which still switch with the mood only because of the LEGACY NAMES alias block in `html.hq`. `KpiStrip`, `PickRow`, `Meter` and `Empty` are used nowhere in `face/src`; the kit's `Chip` isn't used in any of the 9 rooms. The debt-ledger row says so directly. What was built is the rooms in the kit's frame, in both moods; it was recorded as debt, not routed through a spec change.

**(b) Colour changes.** Criteria 1 and 2 are met by changing values the spec says not to re-decide (see section 4).

**(c) Planted edit tested on a copy.** Tested in a temporary copy at the same relative path, not the live file. Same effect; low concern.

**(d) "Holes fixed + pinned": three holes were deferred, not fixed.** Attacker 1 #10 (lint does not read `face/src/rooms`, `shell` or `face`; the stage's palette carries 13 literals) went to debt; attacker 2 #9 (no signal handler; a kill leaks door, preview and Chrome) went to debt; a LOW finding about literals inside comments was marked out of scope.

**(e) "Every served room" is really 33 of 34.** The summary line reads `openable=33 … not-opened=lane`, so `lane` is never opened in either mood. That exclusion comes from Phase 00.

**Verification plan:** test commands — no drift. Expected failure first — matches (`97031604` contains only tests, fixtures and harness changes; `red-first.md` quotes all four expected messages from run `35201425258`). Evidence: `contrast-table.md` is missing; `ci-jobs.json` and the owner-read file are not yet evaluable; the attacker reports are present; `red-first.md` is a harmless extra. Live demo: the toggle exists; "a council verdict chip reads `--accent-dim`" depends on the rooms' own CSS and can only be checked after merge.

## 2. Scope creep

- **The face stage is removed in the light mood** (`face/src/App.tsx`) — the biggest one. The unchanged lines above call the face "the one element of the design the owner required unchanged". The new comment says where the stage lives is Phase 02's to decide, yet this diff already decides it for light mood. Visible to the user; recorded only as debt.
- **The room rail gets new chrome beside the mood toggle:** an "arc · HQ" wordmark and a `--bg-1` background — v0.7 shell styling that belongs to Phase 02. Minor.
- **Every room changes typeface:** `pageStyle` moves from `--font-display` to `--font-ui` (Inter). Follows from the kit port. Minor.
- **Not creep:** `ui/legacy.tsx` and the alias block (needed so the rest keeps working), the `Palette.tsx` scrim token, kit exports beyond the named 8, and the hardening required by criterion 9.

## 5. User-visible change

The face HQ gets a sun/moon button in the room rail that switches between a dark workroom and a white "paper" one, and the browser remembers the choice. Every room drops the black-and-cyan look and Anybody font for v0.7's cards in Inter. In light mode, the particle face behind the rooms is gone.

FIDELITY: drift found
