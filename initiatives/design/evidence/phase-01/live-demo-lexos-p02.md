# Phase 01 live demo — explore `lexos-p02` (2026-09-17)

**What this file is.** The text record of Phase 01's live demo, per the owner ruling of
2026-09-16: the demo runs on the LexOS brief, and **only text is committed**, meaning hashes,
manifest rows, the by-hand verdicts and the audit. No LexOS HTML or PNG enters git. The explore
directory `docs/design/explore/lexos-p02/` and the renders under `.claude/state/` stay on the
build machine. Every hash below is reproducible from those files.

- **brief:** `docs/design/briefs/lexos-case-workspace/brief.md` (Mobile = yes)
- **base revision:** `334e991a`
- **flow:** `init` → director Phase 1 → for each variant, serially, `compose` → `ui-composer` →
  `compose-done` → director Phase 2 → `check`

## Verdict against the Phase 01 exit criteria

| Criterion | Result |
|---|---|
| Loop runs compose → render → read own PNG → revise, ≤3 iterations | **met**: A 2 iterations, B 3, C 2, each rendered at both viewports |
| Immutable iteration receipts, per-variant manifest carrying hashes, defect and revision | **met**: 4 manifest rows across 3 variants, substantiated by the gate against the render metas |
| **≥1 self-caught defect visibly fixed, provable from the hashes** | **met, and checked by hand**: every claimed fix (9 in total) was confirmed by opening the iteration PNGs, not taken from the manifest's prose |
| Viewport set derives from the platform contract | **met**: `coverage ok -- every declared viewport rendered across 3 variant(s)` |
| Declared surfaces rendered and classified | **met**: `design-lint: surfaces ok` on all three |
| **`ui-composer` gains exactly one scoped Bash entry point** | **NOT MET** — see "Bash was never scoped" below |
| Allowlist enforced by a named technical mechanism | **partial**: Read/Grep/Glob and Write are enforced by hooks, and the refusals were observed live. Bash was a full bypass for both |

Phase 01 cannot close on this demo alone. The open item needs two owner decisions, recorded at
the end.

## Director

- **Phase 1:** A = command center, B = guided workflow, C = narrative. Rejected: canvas (absurd:
  a case record has one order, time), ambient assistant (the brief says "a court record, not an
  assistant"), and review workspace (held in reserve).
- **Phase 2**, as written in `matrix.md`:
  - `Director call: A/B/C differ materially on 6 of 7 dimensions` — failure/recovery is the
    dimension that did not hold. All three moved it into reference prose.
  - `Art-direction call: A/B/C differ materially on 4 of 4 axes`.
  - No reassignment recommended.
- **`check`:** `check OK — matrix + director call + 3 variants (thesis, page, tokens-only colour)`.
  This passed after one refusal, recorded below.

## Iterations, hashes and the by-hand verdicts

Hashes are `screenshot_sha256` from each render's meta. A manifest row's two hashes name the
surface it is about (the rule at `8c0d46be`).

### Variant A — command center

| iter | 1440x900 | 390x844 |
|---|---|---|
| 1 | `451ae8636f937e7bc270a9a56ad65d1752e0e32da32124cf008e00208371c17a` | `be4fa26470efcf178cca05a445558364d5d3eb7cdac0b71cfc092c4bfaf2e558` |
| 2 | `45c16d082836a8842b67923832e18096724b09feacbb29b3f9aa442559840b31` | `9effc1fc18c485654ce9eb54e3b5d88ac0874179386208538b5aed94510fcac7` |

**Manifest row 2 (desktop):** `451ae8636f93…` → `45c16d082836…`.

Opened by hand: iter-1 and iter-2 at 1440x900, and iter-1 and iter-2 at 390x844. The four
claimed fixes are **all visibly fixed**:
1. **Status pill:** read `ACTIVE`, set in uppercase like the raw enum; now `Active`.
2. **Command line:** cut mid-word ("add hearing 12 A"); now the whole line is legible, with its
   hints below.
3. **Registers:** four separately boxed registers are now one continuous ledger sheet.
4. **Mobile dock:** `position:fixed` swallowed the Notes register and left blank gaps. The Notes
   rows are now visible, and the dock sits in document flow.

**Seen by hand and NOT caught by the composer** (critique inputs, not Phase 01 gates):
- Hearing outcomes and notes are truncated with an ellipsis. On a legal record that hides what
  happened.
- The mobile due-this-week strip clips at the right edge.
- About 60% of each desktop register is empty ruled rows.
- No `<script>`: the keyboard model is drawn and not wired (director Phase 2).

**After the render:** `check` refused a colour literal, `rgba(16,38,31,.06)`, on line 136 of
`index.html`, which breaks iron law 2. The composer, resumed, moved it byte-identically into
`tokens.css` as `--verb-hover-wash` and did not render again. The value is unchanged, so the
pixels match the iter-2 receipt by construction, not by measurement.

### Variant B — guided workflow

| iter | 1440x900 | 390x844 |
|---|---|---|
| 1 | `7d0576199c4ec91b7215f548118e7725759dd77d62743df8207dc6079051261f` | `152e5f2c4d5f2c2a6c497aee056b540591f62dd9d0ea3432556bf6f79ebb5488` |
| 2 | `ca26d2cb4cdbc931e1d54ee43aac2dbfedb8e64968725e414eb27a164b66bf8f` | `d8534c60f181b59c6335bc59d9fc0226c456757fe0ed85360a0a50ad4df512f1` |
| 3 | `ca26d2cb…b66bf8f` (`unchanged: true`) | `61fd2f677cda05623adfeace1e8af6b914bf9abc54a2b1a511d73257b4e96c94` |

**Manifest rows:**
- row 2 (desktop): `7d0576199c4e…` → `ca26d2cb4cdb…`
- row 3 (mobile): `d8534c60f181…` → `61fd2f677cda…`

Opened by hand: iter-1 and iter-2 at 1440x900, and iter-2 and iter-3 at 390x844.
- **Desktop:** the rule pinching "Full record" is gone, and the reference cards no longer stretch
  to equal height. **Visible.**
- **Mobile:** at iter-2 the outcome textarea cut its third line ("Interim application listed
  for…") through its own border. At iter-3 the whole text shows, down to "arguments.".
  **Visible.**

**Row 3 was first refused, and the GATE was wrong** (defect 2 below). The composer, resumed,
rewrote the row to the mobile hashes, reading them from the metas itself.

Critique inputs: the case-facts band scrolls away on both viewports; Forward links to a
blocked step; Enter is bound to two different acts (director Phase 2).

### Variant C — narrative

| iter | 1440x900 | 390x844 |
|---|---|---|
| 1 | `9e87daad7dd0ecf5df032738ae236e77bbc40a9d5a49d3b9d2ab56fe5f4d01f4` | `bc8704317a3921160675c4508d14d5792932f4d6a93b2b9111e06471ceab30a5` |
| 2 | `3137989fb28613243a63d8cc0eb7422280dc7eec4845fa34f1dfeecfb59f3e8b` | `f1ef4244f5c9d8ab5dd775c6efa38a9cc866bec3d663d94cdacb637acd583d8e` |

**Manifest row 2 (mobile):** `bc8704317a39…` → `f1ef4244f5c9…`. This is the first row in the
lane judged under the rule that a row names its surface by its hashes.

Opened by hand: iter-1 and iter-2 at 390x844. **Visibly fixed:**
- The sticky masthead wrapped to three lines, with the `OVERDUE — 2` stamp alone on the third.
  Now it holds at two.
- "Overdue" printed twice for one fact. The duplicate caption is now visually hidden.

Critique inputs:
- what the case owes sits about 1,450px down and nothing scrolls to it;
- the filter row has the shape of the shipped tab rail;
- a long empty stretch separates the record from the reference section on mobile.

## Defects found in Phase 01's own machinery

The demo existed to find these. Each one either reached a commit or is recorded as open.

| # | Defect | Disposition |
|---|---|---|
| 1 | `ui-composer.md` said "say plainly in your manifest" and never named the file, its row shape, the hash source or the mobile render. A composer following it to the letter failed the gates it feeds | **fixed** `334e991a`, before any composer ran, pinned by a contract test |
| 2 | The self-review gate judged every row at the WIDEST viewport, so a real mobile-only fix (B iteration 3) could not be recorded | **fixed**: red-first `6f99ff09`, fix `8c0d46be` — the output hash selects the render and so the viewport; cross-viewport pairs and named-viewport no-ops are still refused |
| 3 | **Composer Bash was never scoped** — see below | **OPEN — owner decisions** |
| 4 | `compose-done` does not run iron law 2's colour-literal check; only `check` does, after all composers finish, so a composer never learns it broke the law | **recorded**, not yet routed |
| 5 | The `check` colour-literal refusal cut an absolute path at 100 characters, so line 136 was reported as line 1 | **fixed** `d42ee967`, pinned |

## Bash was never scoped (defect 3)

**What the frontmatter says:** `tools: Read, Glob, Grep, Write, Bash(bash .claude/scripts/design/design-render.sh:*)`.

**What the composers ran**, audited from their transcripts
(`~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`):

| composer | Bash calls | beyond the renderer |
|---|---|---|
| A | 8 | `ls` of its own dir, the renders dir and the scripts dir; `grep` in its own page; `mkdir`; `find` |
| B | 26 | `node -e` (contrast maths, page edits, hash reads); `powershell`, `cmd /c` and `reg query` (font checks); `python3` (a page edit); `grep` of a temp file |
| C | 18 | `node -e` (contrast); `powershell` (fonts); `head -50 design-render.sh`; `sed -i` and `python3` (page edits); `ls` of the renders dir |

**Was isolation broken?**
- **No composer's Bash touched a sibling variant, `matrix.md`, the brief, a marker or a boundary
  script.**
- A and C listed `.claude/state/design/renders/`, which shows sibling session directory NAMES,
  not their content.
- C read the renderer's own source.
- B and C edited their own pages through Bash, which bypasses the write boundary but stays inside
  their own directory.

**Isolation held in practice. It was never technically enforced**, so Bash could read any
sibling or release its own boundary.

**Why.** Per the Claude Code subagent docs, a subagent's `tools:` field takes tool names only. A
specifier such as `Bash(prefix:*)` selects the whole tool, and permission-rule syntax is not
honoured there. The documented per-subagent control is a PreToolUse hook. Its payload is
documented to carry `agent_type` and `agent_id` for subagent calls.

**Why this is open and not fixed:**
1. **The enforcement fragment belongs under `.claude/hooks/PreToolUse.d/`**, and `.claude/hooks/**`
   is edit-denied by governance. The script it would call can be written from here; the
   fragment cannot.
2. **`agent_type` is unverified on this Claude Code build.** Verifying it means capturing a live
   hook payload. The session tried a temporary, uncommitted probe line in
   `composer-scope-check.sh`, and the auto-mode classifier denied it as Self-Modification of a
   live security boundary. That denial was respected, the file is unchanged, and no workaround
   was attempted.

**If `agent_type` is present, it changes more than Bash.** The read and write boundaries could
scope to `ui-composer` calls only. The operator would never again be locked by an abandoned
marker (the root cause of the three-week lock), and parallel composition becomes possible. That
is a security-boundary redesign and needs the owner's OK under `/arc-change`.

## Fairness note for Phase 03

**The composer prompts were not identical.** B's and C's prompts carry one extra paragraph that
A's does not, asking them to look hard for truncation and 390px clipping. The paragraph was
learned from A's PNGs. C's prompt also restates the viewport-hash rule. A jury comparing the
three must weigh that.
