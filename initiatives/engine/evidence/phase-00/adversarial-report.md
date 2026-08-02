# Phase 00 — fresh-agent adversarial pass

Required by the engine lane's first non-negotiable and by `phases/phase-00-spec.md`. Run
2026-08-03 against `yaml-subset.mjs`, `schema-subset.mjs` and `process-lint.mjs`.

## Provenance — and the honest limit of it

Three subagents were spawned with the Task tool, `subagent_type: general-purpose`, each in a
fresh context from the build session. Each was handed **file paths and rules only** — the
implementation was never pasted into a prompt — plus `tests/fixtures/engine/hostile/INDEX`
and the instruction to walk past the gate. Recorded per agent:

| # | Angle | Tool calls | Duration | Tokens |
|---|---|---|---|---|
| A | the YAML subset parser | 17 | 918 s | 135,879 |
| B | the lint rule layer | 16 | 652 s | 115,034 |
| C | legitimacy bypass / the system, incl. the test suite | 29 | 752 s | 134,110 |

**This is an OPERATOR ATTESTATION, not a measurement, and the spec requires it be labelled
as such.** The orchestrating session attests these were fresh contexts that had not read the
implementation. Nothing in the harness available here emits a verifiable session identity
that an artifact could carry, and a subagent asserting its own freshness is text it typed —
text cannot attest to its own provenance. The evidence that actually carries weight is the
*content* of the findings: all three found holes the author's 36 fixtures did not, in
directions the author had not attacked, which is the outcome freshness exists to produce.

## Starting condition

All **36** of the author's own breaking inputs were caught on the first run, each with the
correct check id. Per retro-log 2026-08-02 that is the signature of a blind spot, not of a
gate — on 2026-08-02 an author's 26 inputs found nothing and an unanchored agent then found
9 real holes. The same shape repeated here, larger.

## Result: ~40 real holes. The four that mattered

**1. `__proto__` as a mapping key — three gates blinded at once.**
`out[key] = value` with key `__proto__` invokes the `Object.prototype` setter: it re-points
the object's prototype instead of creating an own property. The key then vanishes from
`Object.keys()` while staying fully readable via `.` and `in`. So `additionalProperties:
false` could be disabled for attacker-chosen keys, a forbidden `x-*` key could be smuggled
past the passthrough loop, and required top-level fields could be satisfied without
appearing in the document. *The linted document and the document a consumer reads became
different documents.* Fixed: mappings are `Object.create(null)` **and** the key is rejected
by name — a reader who does not know about the first still gets a loud error.

**2. A flow collection on its own line walked past ADR-0205.**
`{x-claude: extra frontmatter}` parsed to a key literally named `{x-claude`, which the
`/^x-[a-z0-9]+(-[a-z0-9]+)*$/i` check did not match — while js-yaml resolves those same
bytes to the forbidden key. The file smuggled the per-target escape hatch through the gate
that exists to forbid it. Fixed: flow detection is **structural** (does this logical line
open a flow collection, in key or value position), and the top-level vocabulary is now a
**whitelist**, which subsumes the naming-convention check entirely.

**3. The schema subset's core promise was false five ways.**
`minLength` on an object, `pattern` on a number, `items` on a non-array,
`additionalProperties: false` with no `properties`, `required` with no `properties`, and
`output: {}` — every one linted clean and provably enforced nothing against data. This
module's own header says a schema claiming a constraint nobody checks cannot exist. Fixed:
keyword/type reachability is checked, and an empty schema is rejected.

**4. A lint that reads nothing passed 7 of the suite's 12 assertions.**
Agent C wrote a 15-line "oracle": it opens the fixture INDEX, looks the **filename** up,
prints the check id that row promises, and exits 1. It never opens a fixture, never parses
YAML, never hashes anything. Asserting the check id rather than a bare non-zero exit was a
real improvement over the original design and it was still not enough — *a check id is a
string the lint prints, not evidence that it looked.*

Fixed by a **mutation-sensitivity** test: the same filename is linted with five different
contents and must yield five different verdicts, plus a clean pass unmutated. A
content-blind lint cannot produce a content-dependent answer.

**Negative control, run 2026-08-03:** the oracle was rebuilt and the suite re-run against
it. It now **fails** (tests 3, 4, 7, 13), where it previously passed 7 of 12. A control that
has never been seen to fail is a coin, not a gate — so this one was made to fail on purpose.

## The rest, fixed and pinned

Silent corruption: lossy block scalars (whitespace-only lines collapsed — a markdown hard
line break *is* two trailing spaces; trailing-newline count destroyed; `|+` matched then
ignored); `\uXXXX` escapes losing their backslash (`café` → `cafu00e9`); all-digit scalars
coerced to Number, so a leading-zero commit sha was reported *missing* on a correct file;
`>` folding collapsing every blank run to one; NBSP/form-feed indentation silently
reparenting a nested key into a root sibling; `-   key: value` degrading to a string.

Silent acceptance: dialect placeholders entering through `inputs[].default` and tool scopes;
chained placeholder filters (`|default:main|shellquote`) hiding behind the first filter's
`(.*)`; `{{input.nope}x}}` escaping both the match regex and the balance counter; `evals`
accepting directories and the repo root; case-insensitive self-reference on Windows/macOS;
`baseline` unbound to `name` and with no repo-escape guard; duplicate tool primitives (a
bare entry silently widening a scoped one); duplicate input names.

**The one that should worry a reader most:** `baseline` proved only that *some* file in the
repo carried the pinned hash — never that it was the file the process claims to be canonical
for. So a body rewritten to invert its own safety instruction passed with a fully valid,
freshly recomputed, green pin. Fixed by binding `baseline.path` to `name` via a committed
table, and by a new `body-drift` check that compares the canonical body against the live
file's prose with placeholders masked.

## False rejections — the direction the corpus could not see

Eight ordinary constructs were being **hard-rejected** with every test green: markdown
emphasis in a quoted `intent`, a `#` comment merely mentioning an ampersand-anchor, a
comment on a key line opening a nested block, `inputs: [] # comment`, a zero-indented block
sequence (the canonical output of yq, js-yaml and every Kubernetes manifest), a tab inside
body prose, an apostrophe in a plain scalar swallowing its comment, and a leading-zero
commit sha.

All 36 original rows were REJECT rows, so **no fixture could ever observe a legitimate file
being refused.** The corpus now carries two classes — **71 REJECT + 10 ACCEPT** — and the
ACCEPT class is the structural fix, not the eight individual bugs.

## Verified after

- `process-lint --all` clean on all 3 pilots; all 3 bodies round-trip **byte-for-byte**
- 82/82 corpus rows correct (71 reject with the right check id, 11 accept clean)
- `tests/engine-process-lint.bats` — 15/15 green locally; the oracle fails it
- `product-lint` clean; `sync-golden` manifest regenerated as a named step, delta diffed
  first, exactly the 5 intended paths moved
