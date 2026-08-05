# Phase 02 handoff — leads Cycle 8, Replies

**Closed:** 2026-08-05 · **Appetite:** 1.0d · **Burn:** 1.0d · **PR:** #113 · **CI:** run 31018199453, 19/19 jobs success

## What was built

The reply path, end to end. `arc-leads ingest-reply --file <path outside the repo> | --stdin | --inbound`.

A reply stops its sequence, an unsubscribe suppresses in the same run, an *interested* reply
mints its calendar draft in the same run as the ingestion that classified it, and a malformed
reply fails loudly without echoing one byte of its content.

| Capability | Where |
|---|---|
| Parser (parser-class): headers, MIME, encodings, quoted material | `lib/replies.mjs` |
| Triage: `interested` / `later` / `no` / `bounce` / `unsubscribe` | `lib/replies.mjs` |
| One reply end to end: resolve, persist, receipt, consequences | `lib/ingest.mjs` |
| Meeting drafts on their own gate, unreachable from the send path | `lib/drafts.mjs` |
| Inbound interface + fake (the webhook path, for when a provider exists) | `lib/deps.mjs` |
| ADR-0414 reply identity in the shared validator | `hq/lib/validate-leads.mjs` |

## The decision that came before the code

**ADR-0414**, routed through `/arc-change` before anything was written.

`outreach.replied` was keyed on `ingested_at`, and that was wrong in **both directions at
once**. It **split one reply into two receipts** on any re-ingest — the ordinary response to
"did that run finish?" — and it **collapsed two different replies** arriving in the same second
into one, dropping whichever came second. The class most likely to arrive second is
`unsubscribe`, because it is what someone sends after the reply they already sent.

The idem is now the reply's **content**: `campaign|lead_id|triage_class|reply_ref`, where
`reply_ref` is sha256 of the raw bytes. `ingested_at` stays in the payload and leaves the
preimage — a deliberate, documented exception to the total-preimage rule, and the entire point.

## The number that matters

**Two mandatory adversarial surfaces. 29 confirmed holes. CI was green throughout, and the two
agents shared almost nothing.** Running total for the cycle: **96 holes**, every one found in
code CI called green.

**Surface 1 — decision logic (15).** A multipart carrying only `text/html` parsed to an EMPTY
body and classified `later`: the epilogue after the closing delimiter was handed back as a
part, header-less parts default to `text/plain`, so the empty epilogue matched as "the
text/plain part" on every well-formed multipart and `NO_TEXT_PART` was unreachable. An
HTML-only "remove me from your list" produced no suppression. `stripQuoted` ate the whole
message of a **bottom-posted** reply — the Outlook default in a lot of corporate mail — because
it broke at the first separator and the human writes below it. **"Do not call me" classified as
`interested`** and minted a calendar draft, because `call me` is an interest marker and nothing
tested for negation; the comment above those rules explains that `no` is ordered before
`interested` because "not interested" contains "interested", and the identical defect twenty
characters away got no such treatment. A transient **"delivery delayed" DSN** — the most common
thing a mail system says, and one that means the opposite — suppressed a live lead permanently,
and because each retry notice has different bytes, hence a different ref, hence a different
idem, two of them **froze the campaign**.

Then the keyring, three times over: reply-stop, already-sent and the rolling touch cap each
checked ONE lead id while suppression checked the whole keyring, in adjacent branches, under a
comment calling the single-id version the single worst thing this system can do. And the
campaign binding compared only the current key, so the first rotation **bricked the send path of
every existing campaign permanently** while the ingest path carried on accepting.

**Surface 2 — shell / OS / byte boundary (14).** A boundary parameter over ~32k characters made
V8 throw a `SyntaxError` **whose message embeds the pattern**, i.e. the sender's own bytes, out
through a path that was not a `ReplyParseError` and therefore escaped the taxonomy entirely — a
98 KB file did it, one tenth of `MAX_REPLY_BYTES`. That is this module's first stated invariant,
and its headline test could not reach the constructor with any input it ships with. A NUL
smuggled as `=00` walked past the raw-byte scan into the store record. A quoted-printable body
lost every non-ASCII character to a latin1 round-trip, so Devanagari became arbitrary ASCII and
then went through the triage regexes — for a campaign aimed at Indian advocates. A `;` inside a
quoted parameter stole the boundary. Both ingest doors read the whole file before applying the
1 MiB limit. `--stdin` with no pipe hung forever. The `emit` temp file had no entropy and no
`wx` in a world-writable directory.

**And it attacked the tests, and three of them were wrong.** The flagship e2e assertion read the
spine at `$ARC_SPINE_ROOT/.claude/state/hq/events/` when `spine-io` returns `ARC_SPINE_ROOT`
verbatim; `|| true` swallowed the failure and `grep -c` printed 0, so **it was measuring
nothing** — and its sibling suite one phase earlier had the path right. `leads-reply-triage.bats`
declared 16 tests and asserted 15. And the reply corpus was **pure LF**, so the `.gitattributes`
`-text` rule that ADR-0414's cross-platform identity rests on had no negative control at all:
delete both lines and every test still passed.

## The pre-merge review found one more, and it was the worst kind

`NEGATED_CONTACT` accepted the ASCII apostrophe, `dont`, and even a backtick — and **not U+2019**,
which is what iOS, Android, Word, Outlook and Gmail insert by autocorrect, and what `=E2=80=99`
decodes to on the quoted-printable path this parser explicitly supports. So
`please don’t call me again` classified as **interested** and offered to send a calendar link
to someone who had just refused contact, while the ASCII spelling of the same sentence
suppressed.

The test that protects the rule could not reach it. It was named *"the apostrophe spelling of a
negated contact request also suppresses"*, its comment called that spelling the single most
common way a person writes it, and it tested `String.fromCharCode(39)` — the one spelling that
already worked. **A test named after a case it does not cover is worse than no test**, and this
is the fourth time this cycle a comment asserted a property the code did not have.

The review also caught: `ingest.mjs` calling `readCampaign` under a paragraph describing the
keyring binding check (`assertCampaignStore` — fixed on this same branch — was never called on
the ingest path, and `drafts.mjs`'s own comment had *named* this call site as the one that
carried on accepting, then left it accepting); a re-classification leaving spine and store
disagreeing about one reply; a breaker refusing with "N bounces in this campaign" while
`deriveState` counts across every campaign; and `--inbound` being an undocumented third ingest
door and the only one without a size ceiling.

## What every fix ships with

**Its negative control.** A generous opt-out grammar that swallowed warm replies would be worse
than the bug it fixes, so five control phrasings assert it does not. A delivery-report rule that
caught a human replying from `postmaster@` is asserted not to. The module-wide complaint scope
is pinned by a test that **fails if the campaign filter is restored** — the two pre-existing
tests both pass with that mutant, because both use the campaign under test. And the narrowed
no-daemon guard builds three probe files and asserts it still catches two of them.

## CI, and what it caught that I did not

Run 31016273038 was **red on seven legs**, three distinct locations, all mine:

- two self-inflicted bugs in the new contract tests — one logged `ingest.triage_class` where
  `run1` returns `{out, seen}`, so the assertion could never have matched **on any code,
  forever**; the other re-imported an identifier its own prelude declares, so the program was a
  SyntaxError before a single assertion ran. Both are the **inverse of a vacuous pass**, and
  neither is visible without executing it.
- the `no scheduler daemon or cron` guard fired on `DAEMON_LOCAL`, the constant that matches
  `mailer-daemon@` to decide whether a message came from a mail system or a person. The guard
  was right to fire on a bare word it cannot evaluate and wrong about that line, so **the fix
  went to the guard**: renaming the constant to dodge a grep would leave the next legitimate
  mail-role match failing for the same reason.

Run **31018199453: 19/19 jobs success** — windows ×12 shards, macos ×3, ubuntu on Node 18/20/22,
plus `ci-tier`. Per-JOB conclusions read, not the watcher's exit code.

## Test counts

`leads-reply-parser.bats` 39 · `leads-reply-triage.bats` 28 · `leads-reply-contract.bats` 33 ·
`leads-sequencer.bats` 34 · `leads-adversarial.bats` 35 · `leads-preflight.bats` 24 ·
`leads-provider-contract.bats` 22 · `leads-receipts.bats` 16. Every file asserts its own declared
count against what bats REGISTERED; every `@test` name is ASCII.

## Carried forward to Phase 03

- The reply corpus encodes a guess at how a provider will deliver inbound mail. **The first real
  campaign is what tests it** (ADR-0413 standing caution).
- `INBOUND_MAX_BYTES` duplicates `MAX_REPLY_BYTES` so `deps.mjs` keeps no parser dependency; an
  equality test holds them in step. If a provider driver needs a different ceiling, that is an
  ADR, not an edit.
- `UNSUPPORTED_CHARSET` refuses anything but utf-8/us-ascii. Binding a real charset decoder is
  Phase-3 work, and until then a mangled body is refused rather than shown to a human as if the
  sender wrote it.
- The three new suites have no `shard-timings.json` weight and ride the 16s default. `--inbound`
  spawns ~10 processes for the e2e case on the leg where process creation is the cost driver.
  Recalibrate from a real run (`grep "shard-timing:"`) rather than a throwaway measurement.
