# Live re-verify — one composer turn under the installed boundaries (`lexos-p03`)

**Date:** 2026-09-17 · **Base:** `a0370ead` · **Resume step 4** of Phase 01.

The question: does a real `ui-composer` loop still work under everything built since the last demo?
That means the installed Bash fragment (`.claude/hooks/PreToolUse.d/10-design-composer.sh`), the
installed dispatcher (BS-4), the read and write boundaries, and ADR-1418's loopback render.
**Text only**, by the owner's 2026-09-16 ruling: no LexOS HTML or PNG is committed. The explore dir
`docs/design/explore/lexos-p03/` stays untracked, like `lexos-p01` and `lexos-p02`.

## Setup

- One variant, `variant-a`, whose `thesis.txt` was copied from `lexos-p02/variant-a` (the command-center
  thesis with the canonical case data). No director and no matrix: this checks the composer loop,
  not divergence.
- `design-explore.sh compose lexos-p03 --variant a` armed the boundary.
- One `ui-composer` subagent was spawned with the explore id, the variant, and the platform
  contract: desktop 1440x900 always, mobile yes.
- `design-explore.sh compose-done lexos-p03 --variant a --brief docs/design/briefs/lexos-case-workspace/brief.md`
  released it.

## What happened

**The loop ran end to end, and no boundary got in its way.**

- `compose-done`: exit 0. `design-lint: surfaces ok` · `self-review manifests substantiated (2 row(s))`
  · `coverage ok -- every declared viewport rendered` · `variant-a cleared the composer gates`.
- Six renders, three iterations at two viewports. **Every meta records the transport as
  `confined-loopback` and the URL as `http://127.0.0.1:<port>/index.html`.**

| viewport | iter | unchanged | screenshot_sha256 |
|---|---|---|---|
| 1440x900 | 1 | false | `2664ac228ccffe62fd54bcfeff8cefa5ac5d50668802d531accd92aeecf98528` |
| 1440x900 | 2 | false | `7b5fe77daf6429a9bda5d94c5cbcfe5afe3e6bcf1b5d51949cf29b1ba68300c6` |
| 1440x900 | 3 | false | `8e0f3158f09aa0f75e8d2a67bb2c2c828c291986bcde8e25e6d68f6cf08ced03` |
| 390x844 | 1 | false | `276a89c513478f3114ce036c9e014076cfda0a92179edea1449814c5e91daa57` |
| 390x844 | 2 | false | `599c5c344c182e14b2f7bbf39832eff05ae7a85a6cf7506b4d26edb7c45d3aab` |
| 390x844 | 3 | false | `b4a2734f55764dfa55cb3e6b4aa2574976b0c6f86df9c1f9dbd5381e4b74b9a1` |

- The self-review manifest has two rows, and each chains its input hash to the previous
  iteration's output: iter 2 `2664ac22… → 7b5fe77d…`, iter 3 `7b5fe77d… → 8e0f3158…`.
- The composer's own report: six render commands, all exit 0, **no refusal hit**, no contract friction.

## Opened by hand (the three desktop PNGs)

- **iter 1**, as claimed:
  - the status pill is forced into caps (`ACTIVE`);
  - the Documents register shows `+1 earlier document` AND a `Vakalatnama` row, a hidden row leaking
    through;
  - the mobile `F File / Del Remove` verbs sit on the desktop command line.
- **iter 2**: all three are fixed (`Active`, no Vakalatnama row, a bare command line). As claimed,
  centring the grid left two large empty bands above and below it.
- **iter 3**: the registers are top-anchored and the command line sits at the foot, so the upper band
  is gone. **Not claimed but visible:** an empty band of about 240 px remains between the registers
  and the command line. That is a critique input for Phase 03, not a Phase 01 gate.

## What this does not show

- **That the composer never tried another command.** Its transcript file was empty when read, so its
  tool calls could not be audited from outside. The enforcement stands on the installed fragment,
  which is byte-identical to the fixture and pinned on all three CI legs by the install cases of run
  35219257156. The fragment's refusals are pinned by `design-composer-bash.bats`. This run shows the
  loop is not BROKEN by the boundary; it does not show a refusal firing live.
- **Mobile iterations.** They were not opened by hand here. Their hashes are above.
