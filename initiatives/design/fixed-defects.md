# Fixed defects — the design lane's running list

Every attacker prompt carries this file, with one instruction: **check each line in every OTHER
file you are shown, not only the file it was fixed in.** Every attacker pass appends its fixed
holes here, one line each. The fuller Phase 01 history is in
[`evidence/phase-01/adversarial-open.md`](evidence/phase-01/adversarial-open.md).

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

## Phase 02 slice B, attack round 1 (2026-09-26)

- **An emptied oversize body passed through as a 2xx**, so a huge robots.txt read as "no rules" and became ALLOW (B1) — `design-robots.mjs` — *a capped read is truncated or refused, never handed on empty as a success.*
- **The licence was checked on one input and the fetch made on another** (`--source` row vs `--url` host) (B2) — `design-refpack.mjs` — *every permission check binds to the exact value that is then used.*
- **Redirects were followed by the HTTP client**, skipping the registry, robots and attempt log for every hop (B3) — `design-robots.mjs`, `design-refpack.mjs` — *redirects are manual, and each hop passes every gate the first request did.*
- **Test seams shipped ungated in a production CLI** and a fixture read as a real fetch (B4) — `design-refpack.mjs` — *a fake transport needs an explicit env and stamps what it produced.*
- **Remote text compiled into a regex** (backtracking at the remote's choice) (B5) — `design-robots.mjs` — *never build a RegExp from untrusted text; use a linear matcher.*
- **Paths compared without percent-encoding normalisation**, so a DISALLOW missed (B6) — `design-robots.mjs` — *normalise both sides of a path comparison the same way.*
- **Check-then-create with a truncating write** lost a concurrent writer's first row (B7) — `design-refpack.mjs` — *create exclusively (`wx`) and append; never exists()-then-write.*
- **A subprocess result was ignored** and success printed anyway (B8) — `design-refpack.mjs` — *read status and error of every spawn whose failure matters.*
- **An id validated on one argument and used raw from another source** (registry id into a path and a log) (B9) — `design-refpack.mjs` — *validate every value at the point it becomes a path or a log field, and assert containment.*
- **`find()` took the first of duplicate rows**, so a later restriction was never seen (B10) — `design-refpack.mjs` — *count matches; exactly one or refuse.*
- **Remote text reached a tab-separated log verbatim** (B11) — `design-refpack.mjs` — *strip control characters from every logged field.*
- **A Windows reserved device name passed the id grammar** (B12) — `design-refpack.mjs` — *the lane-name reserved list applies to every id that becomes a directory.*
- **A full URL with its query string went into a committed file** in a public repo (B13) — `design-refpack.mjs` — *drop query and fragment before anything is committed.*

## Phase 02 slice B, attack round 2 (2026-09-26)

- **A seam gate added to one CLI and not its sibling** (B1) — `design-robots.mjs` — *a fix to one entry point is checked in every entry point that shares the seam.*
- **A plain-object lookup keyed by remote text** found an inherited property (`constructor`) (B2) — `design-refpack.mjs` — *use `Object.hasOwn` or a Map for any lookup keyed by untrusted input.*
- **An IPv4-in-IPv6 address in the URL parser's hex spelling** passed the private check (B3) — `design-robots.mjs` — *parse addresses to bytes before classifying; never match their text.*
- **The second gate on a redirect was added to one redirect loop only** (robots hops unbound) (B4) — `design-robots.mjs` — *every loop that follows a redirect carries the same guards.*
- **A failing probe command read as "not applicable"** (git rev-parse error skipped the mark) (B5) — `design-refpack.mjs` — *only a positive "absent" skips; an error is a failure.*
- **Cleanup deleted a content-addressed file an earlier run owned** (B6) — `design-refpack.mjs` — *clean up only what this run created.*
- **A non-text 2xx parsed as an empty rule set** and became ALLOW (B8) — `design-robots.mjs` — *check the content type and shape before a body is trusted as the format it claims.*
- **Emptiness checked before sanitising** (B7) — `design-refpack.mjs` — *validate the value that will be written, after every transform.*
- **A caller read the parser's "someone else" code, 1, which is also bash's crash code** (ADR-1419 r1 B2) — `composer-scope-check.sh`, `composer-write-check.sh` — *a verdict gets a code the runtime never produces by accident; every unknown code is judged.*
- **A size guard written for one tool reached another through a new entry point** (a composer's own 100 KB page refused) (r1 B1) — `composer-bash-check.sh --identity` — *a guard reused by a new caller is re-checked against that caller's real inputs.*
- **An unparseable payload was answered "not a composer" before the fail-closed branch could see it** (r1 B3) — `composer-bash-check.sh --identity` — *"other" is a positive result about a payload that was read; unreadable is its own answer.*
- **A sibling script's version was checked for completeness, not for the feature asked of it** (r1 B8) — the `--identity` handshake — *check the capability you call, not only that the file is whole.*
- **A refusal test aimed at a path another rule already refuses** (r1 B5) — `design-composer-eyes.bats` — *aim a gate's test where only that gate can refuse, and assert its reason.*
- **A verdict code shared with bash's syntax-error code** (2 read as "refuse", locking every caller) (ADR-1419 r2 B2) — `composer-*-check.sh` — *every verdict code is one the runtime never makes; the r1 fix moved one verdict and left its twin.*
- **A subprocess that failed produced an empty string read as a positive answer** (`tr` in the identity normaliser) (r2 B1) — `composer-bash-check.sh` — *a non-empty input that transforms to empty is a failure, never a value.*
- **jq chosen by `command -v`, not by jq working, in the read, write and critic checks** (a broken jq read a composer's target as empty; an empty Read target is allowed) (ADR-1419 CI, twin of BL-3) — `composer-scope-check.sh`, `composer-write-check.sh`, `critic-scope-check.sh` — *a fix to one parser is checked in every script that parses the same payload.*
- **A bracket class whose last `-` met a following character and became a reversed range** (`[!$CQ\"]` emptied `_ - "`, refusing every valid call) (ADR-1420 r1 B1) — `composer-bash-check.sh` — *a literal `-` in a bracket class goes last, after every other character, including one added later.*
- **An unknown verdict looked up in a code table gave `undefined`, and `process.exit(undefined)` is 0** (r1 B2) — `design-refpack.mjs --check-browse` — *only the exact success verdict exits 0; every other lookup miss is a refusal.*
- **Permission checked as one user-agent, fetch made as another** (ClaudeBot checked, Claude-User fetches) (r1 B3) — `--check-browse` — *ask robots as every token the actual fetcher answers to.*
- **A gate on the typed URL while the fetcher follows redirects on its own** (r1 B4) — `--check-browse` — *probe without following, and refuse a redirect by naming its target.*
- **A test seam forwarded from the hook's inherited environment** (r1 B5) — `composer-bash-check.sh` — *a seam in a production path needs a second, path-specific switch, and its answers are stamped as fixture.*
- **An absent field read as "some other value" and allowed** (tool name) (r1 B6) — `composer-bash-check.sh` — *an allow list, never a catch-all exit 0.*
- **A status captured bare after a failing command substitution** (errexit would end the script with the builder's 3/4, read as allow) (ADR-1420 r1 B7 and its twin r2 B2) — `composer-bash-check.sh` — *every non-zero status a hook branches on is captured inside a conditional.*
- **A second line of defence missing where the first was trusted** (ids, https, port and userinfo checked only in the builder) (r1 B9, r1 B11, r2 B4) — `composer-bash-check.sh`, `design-refpack.mjs` — *a rule added to one entry point is added to every entry point that fetches.*
- **"Read-only" tools left ungoverned beside free-text channels** (Read/Grep/Glob plus an uncapped principle made an exfiltration path) (r2 B1) — `composer-bash-check.sh` — *scope every tool an agent holds, and cap every free-text value it can send out.*
- **A missing or non-numeric status read as "no redirect"** (r2 B3) — `design-refpack.mjs --check-browse` — *an allow needs a positive, well-formed answer.*
- **A relative command path approved without pinning the working directory** (r2 B10) — `composer-bash-check.sh` — *a path that names a program is judged from the directory it will run in.*
- **A robots.txt judged for directives before its comments were stripped** (a comments-only file, allow-all by RFC 9309, read as UNREADABLE) (Phase 02 real build, collectui) — `design-robots.mjs` — *normalise the input the way the standard does before deciding what it is.*
- **An agent asked to judge an image it had no way to see** (the curator wrote principles from captions) (Phase 02 real build) — `design-refpack.mjs --stage`, `composer-bash-check.sh` — *an agent that judges an artifact is given a way to open it.*
- **A multiline regex anchored with `^\s*`, so `\s` crossed lines and rescanned every blank line** (quadratic on padding; a hook past its budget reads as allow) (staging attack B1) — `design-robots.mjs` — *scan lines one at a time; never let a whitespace class cross a line anchor.*
- **A URL left as a free-text channel after the text fields were capped** (staging attack B2) — `composer-bash-check.sh` — *cap every value a request carries out, the URL's query included.*
- **A pin applied to one tool and not its twin** (cwd pinned for Bash, not for the reads) (staging attack B3) — `composer-bash-check.sh` — *a check added for one tool is added to every tool that resolves the same relative path.*
- **A probe that falls back to a default on failure** (`git rev-parse || pwd` made the root the hook's own cwd) (staging attack B4) — `composer-bash-check.sh` — *a failed probe refuses; it never supplies a value.*
- **The hook validating one input field while the tool used another** (file_path vs path) (staging attack B5) — `composer-bash-check.sh` — *pick the field by the tool, and refuse the other key.*
- **A textual `..` check on a pattern language that can expand** (brace/extglob climbs) (staging attack B6) — `composer-bash-check.sh` — *hold an expanding pattern to a plain alphabet instead of searching it for bad substrings.*
- **"Look before you write" not bound to the bytes looked at** (the add re-fetched) (staging attack B8) — `design-refpack.mjs --staged` — *bind a judgement to the content hash it was made on.*
- **A remote line echoed into a refusal an agent reads** (staging attack B10) — `design-robots.mjs` — *refusal reasons are fixed text; remote text is data and is never quoted into an agent's context.*
- **Case folded in a path comparison on a case-sensitive filesystem** (staging attack B13) — `composer-bash-check.sh` — *fold case only where the filesystem does.*
- **A non-standard but real content-type refused a real image** (`image/jpg`) (Phase 02 real build) — `design-refpack.mjs` — *accept the aliases real servers send, and let the magic bytes decide.*
- **A permission check resolved the host once and the connection resolved it again** (DNS rebinding to loopback) (phase-02 logic pass r1 B1) — `design-robots.mjs` `realTransport` — *validate inside the socket's own lookup, so the address checked is the address connected to; an IP literal skips lookup and is checked on the value itself.*
- **A guarded verdict-to-code lookup had an unguarded twin** (`EXIT[d.verdict]` in refpack `check()` and the robots CLI) (phase-02 logic pass r1 B2) — `design-refpack.mjs`, `design-robots.mjs` — *every code-table lookup carries the hasOwn guard; process.exit(undefined) is 0.*
- **Unicode line separators passed a control-character scrub** (U+0085, U+2028, U+2029) (phase-02 logic pass r1 B4) — `design-refpack.mjs` `field()` — *strip every line-breaking code point, not only C0 and DEL.*
- **A registry lint accepted an id its consumer refuses** (device names, paths, upper case) (phase-02 attack G1 B1) — `design-sources-lint.mjs` — *the lint enforces the consumer's own grammar, so a row that lints is a row that can be used.*
- **A parser throw left to a stack trace beside two guarded siblings** (phase-02 attack G1 B3) — `design-sources-lint.mjs` — *every step that can fail answers with a named ERR line.*
- **A fixed scrub with an unfixed twin in the next file** -- refpack's `field()` stripped U+2028, the lint printed registry text raw, so a separator in a value forged a clean `ok` line (phase-02 attack G1 B1) -- `design-sources-lint.mjs` -- *every writer of remote or registry text into a line scrubs it; grep the pattern, not the file.*
- **A check on the first URL that no redirect hop repeats** -- port and userinfo were refused on `--url` only; a same-host redirect to another port passed (phase-02 attack G3 B1) -- `design-refpack.mjs` `portOrUser` -- *every hop passes every check the first URL passed.*
- **A per-call bound with no per-decision bound** -- one rule was capped, but ~500 rules of `/*` + 1000 literals cost 3.5 billion matcher steps (measured) (phase-02 attack G2 B2) -- `design-robots.mjs` -- *share one step budget across a whole decision; out of steps is UNREADABLE.*
- **A retry with no pause against a lock that is released in milliseconds** (phase-02 attack G3 B3) -- `design-refpack.mjs` -- *pause between attempts.*
- **The error path printed what the finding path scrubbed** -- lint findings went through clean(), while the parser's error, the path and the OS message were printed raw (phase-02 CI, twin of G1 B1) -- `design-sources-lint.mjs` `out()` -- *one printer for every line a tool writes.*
- **A path from a metadata file trusted because it had no `..`** -- a render meta naming `png: ".env"` dealt the repo's secrets to a model as a jury item (Phase 03 S1 attack B1; the pack twin through a symlink, L4) -- `design-jury.mjs` `inside()` -- *a file read on a record's word is realpath-contained to the directory it was found through, a regular file, and the type it claims.*
- **An exclusive write at the end of a job whose middle already wrote shared state** -- two concurrent deals both copied into one items dir before the `wx` key write (Phase 03 S1 attack B2) -- `design-jury.mjs` -- *claim first (an atomic mkdir after every check), then write.*
- **A number grammar that admits leading zeros** -- `ranking-01.md` and `ranking-1.md` counted as two jurors; `--n 00` read as zero (Phase 03 S1 attack L1, L8) -- `design-jury.mjs` -- *`[1-9][0-9]*`, never `[0-9]+`, for anything that names or counts.*
- **A name grammar copied without its reserved-word half** -- the critique's brief id checked the charset and not the Windows device names the jury's twin refuses (Phase 03 S2 attack B1) -- `design-critique.sh` -- *a name that becomes a path carries both halves of the grammar, everywhere it is accepted.*
- **A run record that a failed begin leaves behind** -- finish held a new critique to an earlier brief (Phase 03 S2 attack B2) -- `design-critique.sh` -- *clear the record at the start of the run that will write it, not only at the end of the one that consumes it.*
- **An informational line read as the failure cause** -- generic-api's "reasoning off" line hid a contract failure in arc-attack's summary (2026-09-27) -- `arc-attack.mjs` -- *a cause filter names what is NOT a cause; every new always-printed line joins it.*
- **A grant proven against an empty directory** -- the composer's pack read was keyed by the explore id while the curator writes by brief id, so the real pack was refused the day it existed (Phase 03 S3) -- `composer-scope-check.sh` -- *re-verify a grant against real files once they exist; key a path by the id its writer uses, read from the record, and grant nothing when the record is absent.*
- **A record parsed with an end anchor on a CRLF checkout** -- `brief\.md$` never matched with a CR before the newline, so the pack grant vanished on Windows (Phase 03 S3 attack B2) -- `composer-scope-check.sh` -- *strip CR before anchoring any line of a tracked text file.*
- **An exception keyed on "differs" instead of on the one difference it means** -- case 3 let any non-empty recipe difference through, so a whitespace or arbitrary recipe passed as a "second look" (Phase 03 close attack 9ea7d9b B2) -- `design-render.sh` -- *an allow-branch names the exact pair it admits; every other value, empty included, takes the refusal*
- **An exact-pair check that a doubled token still satisfies** -- `X;t;t` equals `X;t` plus `;t`, so a doubled transport token passed as the explore/critique pair (Phase 03 close attack 5cf49d3 L16) -- `design-render.sh` -- *count the token across both sides; the legitimate pair holds it exactly once*
