# Design critique — docs/design/explore/hq-dashboard-v1/variant-c/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-c/index.html`
- screenshot_sha256: `7e73591da19f29127eebf1832f011f91740a0ebfe337f2f0f8fb8e2597711c01`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Round-2 full-page render (taller than the 1440x900 viewport) of the same single-column dark
dashboard: header with keyboard-shortcut legend, a new compact KPI strip (MRR / burn-per-month /
runway / ventures-live / kill-list), a "position in the day" banner, a chronological
"TODAY — IN ORDER" event list (now carrying a reorder note), a "SINCE YOU LEFT — NEWEST FIRST"
list past the resume point, a locked "LATER TODAY — NOT YET DISCLOSED" list, plus the right-hand
"Skim mode" undecided-only index and a state-matrix legend.

## Round 1 findings — re-verified

1. No KPI row anywhere — **FIXED.** A KPI strip now sits under the header (MRR ₹18,42,600 ·
   burn/mo ₹6,80,400 · runway 13 mo · ventures live 7 · kill-list 0), with the burn figure
   carrying an explicit error caption ("sync failed — last known, stale 45 min"). It reads as
   one thin row, not a second dashboard region — see new finding below on one part of its
   error treatment.
2. Invented "beat" vocabulary — **FIXED.** Nothing on the rendered page reads "beat" anywhere I
   can find — banner, section headings, row text, and captions all say "event" / "unresolved" /
   the day's actual nouns.
3. "One line per timeline event" broken — **FIXED.** Every event row's mandatory clause (venture
   · phase/verdict · score · kill-criteria state) now sits on a single line for all visible rows
   (settled, unresolved, loading, undecided, disabled, and the three locked/not-yet-disclosed
   rows). The NeoKirana failure row's explanatory text ("Capture failed — payment gateway timed
   out. Retry the capture, or mark it settled manually.") is a separate, brief-mandated failure
   annotation, not the event's descriptive clause, so its extra lines don't reopen this finding.
4. Settled events same visual weight as open ones — **FIXED.** The two settled rows (Kadamba
   Foods, Suvidha Grocers) no longer carry action buttons at all — they show a receipt id and an
   approved/rejected timestamp in that slot instead, and their status pill is a muted, different
   hue from the active blue/red action rows. That is a real structural "done log" treatment, not
   just a shade change.
5. "UNRESOLVED" vs "error" naming split — **FIXED.** The row badge, the right-panel skim entry,
   the skim-surface legend, and the bottom state-matrix caption all now say "unresolved" for the
   09:02 NeoKirana state. One vocabulary, one word, four places.
6. Secondary metadata suspected under the contrast floor — **STILL OPEN, unchanged.** The dim
   caption-weight text (KPI category labels, the "Evidence" toggle links, the "Discloses when its
   event arrives" captions, the section subheadings) still visually reads as the dimmest text on
   the page. I can't tell from the render whether the token change actually moved it past the
   floor — this was already a suspicion, not a measurement, in round 1, and it remains one now.
   Still `design-lint`'s call.
7. "TODAY — IN ORDER" heading didn't signal the reorder — **FIXED.** The heading now carries an
   inline note ("reorders past the resume point — see banner above") pointing at the section
   switch.

Zero of round 1's three VIOLATIONs survive.

## Findings

- WEAKNESS: the burn-per-month KPI value doesn't visually recede or grey against the passing KPI
  values beside it despite carrying an explicit error caption underneath — top KPI strip,
  BURN/MO column — the brief's art-direction section requires the KPI row's error state to grey
  the last-known value, and right now the number itself reads at the same weight as MRR/Runway/
  Ventures-live, with only the small caption line doing the work of signalling staleness.
- WEAKNESS: the per-event evidence disclosure and autonomy-ladder detail are correctly parked
  behind the closed-by-default "Evidence" toggle, and I confirmed the three brief-mandated facts
  (verdict + score, ₹ amount, kill-criteria state) are present on every row without opening it —
  this is not a regression, noted here only so the re-check is explicit and on record.
- POLISH: the LOADING pill (12:00 Aharam Meals) and the DISABLED pill (09:47 Bombay Bites) read
  as a similar warm tone at a glance in both the main list and the right-hand skim-surface legend
  — a quick skim (the panel's whole purpose) leans on reading the text label to tell "waiting on
  data" apart from "administratively locked."
- POLISH: the new "reorders past the resume point — see banner above" note reads slightly
  ambiguous on first pass (it can be misread as describing the TODAY—IN ORDER section itself
  reordering, rather than pointing at the section below it) — still a clear improvement over
  round 1's bare heading, wording only.

## What is working
The three interaction-model facts the brief requires before any decision — council verdict with
its score, the ₹ amount, and the venture's kill-criteria state — are on every event row, not
behind the Evidence click, on settled, unresolved, undecided, loading, and disabled rows alike.
The day is still the single navigation: the KPI strip reads as a thin peripheral row, not a
second dashboard region, and the right-hand Skim panel remains a pure index with no action
buttons of its own — no separate inbox has crept in. Vocabulary is now genuinely one word per
state across every surface (banner, rows, skim panel, legend). The settled rows convincingly
collapse into a done log: receipt id and timestamp stand in for the action buttons rather than
just a shade change. The failure card, the kill button's stated consequence, and the visible
keyboard-focus ring credited in round 1 are all still intact.
