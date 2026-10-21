# Phase 01 — attacker reports and dispositions

Two fresh agents, launched together against commit `47ad5476`, each told it did not write the
code, each given `initiatives/face/fixed-defects.md` with the instruction to check every line in
every other file, each in its own scratch directory, neither allowed to run bats, a suite, an
install or a build. One attacked the decision logic, one the shell/OS boundary. Neither wrote to
the repo (`git status` clean at the end of both).

Disposition key: **FIXED** (code changed, a check pins it, a line added to fixed-defects.md) ·
**DEBT** (a row in `debt-ledger.md`) · **SCOPE** (the gate declares it does not see this, and why).

## Attacker 1 — decision logic (tokens-contrast, colour-literal, the mood verdict)

13 findings: 9 HIGH, 4 MEDIUM, plus LOW notes. Several confirmed in real headless Chrome 152.

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | tokens re-declared outside the three exact mood selectors (reordered/case-changed selector, `@supports`, `@media`, nested rule, `body`, `!important`) passed while Chrome applied them | HIGH | FIXED — every custom-property declaration anywhere is read; one outside `:root`/`html.hq`/`html.hq.hq-light` (or `--dur-*` under reduced motion), or with `!important`, is a named finding. Selftest arms: reordered selector, `@supports`, `!important` |
| 2 | `/*` inside an unquoted `url()` read as a comment, hiding a declaration | HIGH | FIXED — `stripComments` honours unquoted url(); selftest arm |
| 3 | laws compared exact RGBA from the file under test; council one step off violet passed | HIGH | FIXED — laws check the var() reference path AND hue bands (council within 15° of accent and ≥30° from violet; live ≥30° from green); selftest arm |
| 4 | `rgb(255 255, 255)` and other mixed-separator forms accepted; Chrome rejects them | HIGH | FIXED — all-comma or all-space syntax only; selftest arm |
| 5 | fixed measured lists: `--focus-ring`, legacy aliases (`--faint`), `--on-X` fills never measured | HIGH | FIXED — a ROLES table; every colour token resolved in a mood must have a role (unroled = finding); every alias measured; every on-X fill measured; `--focus-ring` is the UI pair. Measuring every fill found dark `--on-red` at 4.37:1 → re-pointed to `--bg-0` (5.80). Selftest arms: legacy alias, unroled token, on-red |
| 6 | chips over bg-2 only; translucent surfaces composited over bg-0 only | MEDIUM | FIXED — chips measured over bg-0..bg-3 (which moved light accent, green, amber, red and blue a further step, recorded in the tokens.css header); a translucent surface is a finding; selftest arm |
| 7 | `_` in the word class: Tailwind arbitrary values evaded all rules | HIGH | FIXED — letters and digits only; three checks |
| 8 | palette list missing mauve/olive/mist/taupe, prefixes after `-`, `--color-*`, `theme(colors.*)` | HIGH | FIXED — one family pattern under any prefix, the 4.3.3 palettes, `colors.x.shade`; three checks |
| 9 | escaped spellings (`&#35;`, `\x23`, `#`, CSS `#\66 ff`) and non-number first arguments (`none`, `calc`, comments, `from` with literal channels) | MEDIUM | FIXED — a decoded second scan (`escaped-*` kinds) and an argument analysis that allows only var() and an alpha; eight checks |
| 10 | default roots skip `face/src/rooms`, `face/src/shell`, `index.css` | MEDIUM | SCOPE + DEBT — REQ-02 names `ui/**` and `modules/**`; the rooms are v1 renderers Phase 03 deletes; index.css now has its own l3-logic contract (it declares no token but the `--color-white` remap). Debt row names the unread folders and their pay-down |
| 11 | `moodHolds` split on JS `\s`; `hq<NBSP>hq-light` held while Chrome applied no mood | MEDIUM | FIXED — ASCII whitespace, as classList does; check with NBSP, BOM, LS, tab, newline |
| 12 | a page error with a newline printed a forged summary line that the bats verdict passed | MEDIUM | FIXED — every error line is JSON-escaped (`errorLine`), every setup message one line (`oneLine`); check with the forged text |
| 13 | `judge` passed a report with no mood or no expected set; standalone smoke judged the door against itself | MEDIUM | FIXED — both refused by name; the standalone smoke reads the contract through the one `expectedOpenable` (moved into smoke.mjs); checks |
| L | `--moods dark` exited 0 | LOW | FIXED — a partial run logs `PARTIAL` and never exits 0 |
| L | an explicit absent `--root` passed beside a present one | LOW | FIXED — explicit roots must exist; check updated |
| L | `PR #233`, `url(#fade)`, "white paper" in comments are findings | LOW | SCOPE — declared in the lint header: the lint reads comments on purpose; write the token name, or "PR 233" |
| L | the build check's `hq-light` could be satisfied by the token copy's selector | LOW | FIXED — the check reads `--color-white`, which only the `@variant hq-light` block emits |

Held (reported by the attacker): duplicate exact blocks merge in cascade order; mixed selector lists refused; unbalanced braces/parens/quotes, unterminated comments and strings, var() cycles, undefined var() refused; typed/stale blocks and duplicated markers caught; CLI refusals; `bg-[#123]`, `RGB(`, `WHITE`, `hover:bg-red-500`, `color(display-p3 ...)`, 8-digit hex, NUL/UTF-16 files, symlinked roots, `scanned=0`; the anchored bats extractions; an unmeasured class list counts as a miss.

## Attacker 2 — shell/OS boundary

10 findings: 1 MEDIUM, 3 LOW-MEDIUM, 6 LOW.

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | `face-tokens.mjs` wrote through a junction/symlink onto `docs/design/system/tokens.css`, prepending a banner every run; `--check` red forever | MEDIUM | FIXED — the destination is lstat'ed and realpath'ed; a linked copy is refused in both modes; a selftest arm makes a real directory link (junction on Windows) and asserts the source is untouched; `face-l3.bats` requires the arm by name |
| 2 | the build test's `.text-[22px]` check could not fail for "scanned the wrong tree": `@tailwindcss/vite` 4.3.3 uses Vite's root, not the cwd; `hq-light` satisfied by the token selector | LOW-MED | FIXED — the index.css comment now states the plugin's real default and why `source(".")` stays; the failure messages name only what they prove; the light check reads `--color-white` |
| 3 | an absent default root passed silently; a re-cased folder passed on ext4 and failed on NTFS/APFS | LOW-MED | FIXED — `face/src/ui` is a required default root; every root's last segment must match the disk's spelling exactly; checks |
| 4 | the face/src mention exclusion matched a basename anywhere and excused an excused file importing | LOW-MED | FIXED — full `.claude/scripts/core/` paths, and a grep that the excused files import nothing from face/src |
| 5 | repeated roots refused by spelling only; overlapping roots double-counted | LOW | FIXED — resolved roots must be distinct and not nested (exit 2); two checks |
| 6 | a device (`\\.\NUL`, `/dev/null`) as a root read as a clean file | LOW | FIXED — a root that is neither a file nor a directory is a `special` finding; check on the POSIX legs |
| 7 | check vs `--write` disagreed on CRLF; markers inside a string produced a file the reader refused | LOW | FIXED — both modes normalise to LF; markers must sit in a comment; the writer re-reads its output before writing; selftest arms |
| 8 | `face-tokens.mjs`: empty or second positional, repeated flags accepted; `process.exit()` | LOW | FIXED — refused by name; `process.exitCode` |
| 9 | a throw in one mood skipped the other; no signal handler, so a kill between moods leaks door/preview/Chrome and temp dirs | LOW | FIXED (per-mood catch, `SETUP-FAIL` line, exit 2) · DEBT (signal handling, pre-existing since Phase 00) |
| 10 | the lockfile check's floor was a family count; a lockfile stripped of the whole oxide family passed | LOW | FIXED — the check prints family names; the bats test requires `@tailwindcss/oxide`, `lightningcss` and `rolldown` by name |

Held (reported by the attacker): tokens-contrast argument refusals, main guard from a lowercase drive and a backslash path, BOM, read-only file under `--write`; a BOM dropped by Tailwind's `@import`; UTF-16/NUL/BOM/CRLF files in the lint; junctions as findings; unreadable directory and huge file exit 2; `\$` in double quotes reaches grep/sed as `$` on GNU, BSD and Git Bash; room ids grammar-checked so `not-opened=` cannot fake a mood pair; the CSS glob checks; each mood gets a fresh Chrome profile; `--moods` refusals; all four lockfile families carry linux-x64-gnu, darwin-arm64 and win32-x64-msvc bindings at the declared versions; the face-tokens selftest cleaned its temp dirs.
