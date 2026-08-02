/**
 * ledger.mjs -- the ADR-0063 slice-ledger grammar: writer + tolerant-detection parser.
 *
 * The grammar is a `key: value` block per slice, in the same file as the Build Brief. It
 * reuses the shape PROGRESS.md's machine header already proves in this repo, rather than
 * inventing a second markdown contract.
 *
 * Parsing follows the retro-log's prescription from the FIRST line rather than after the
 * first bug (2026-07-16 x3, 2026-08-02): tolerant DETECTION -- heading level, emphasis and
 * surrounding whitespace are treated as one thing -- and strict value GRAMMAR, where a
 * near-miss fails closed. Repeated sections take all-of, never first-of. Line regexes are
 * anchored per line; nothing uses `$` under /m as end-of-string.
 *
 * The writer never emits `##`. A brief must be quotable inside another markdown document
 * without its headings masquerading as that document's sections -- see phase-00-spec.md.
 *
 * Zero dependencies, Node 18+.
 */

/** Values the writer emits for "not filled in yet". A slice holding one is not proven. */
export const PLACEHOLDER = "(empty until proven)";

/**
 * Invisible and confusable characters. Stripped before ANY matching, and their presence is
 * itself reported: a zero-width space before `result:` made the key invisible to the field
 * regex, so the slice was never "ticked" and every check on it was skipped silently.
 */
const INVISIBLE = /[​-‏⁠᠎﻿­]/g;

/** Normalise a line for MATCHING only — never for storage. NFKC folds homoglyph keys. */
const clean = (s) => s.replace(INVISIBLE, "").normalize("NFKC");

export const TIERS = ["static", "unit", "contract", "integration", "e2e-visual", "verified-real"];
export const KINDS = ["ui", "external-dep", "logic", "infra"];

/**
 * The only verdicts a prediction may carry. `unforeseen` is not a synonym for `miss`: a miss
 * is a prediction that was made and was wrong; unforeseen is what happened that nobody
 * predicted at all. Collapsing them would hide the more useful half — the blind spots.
 */
export const VERDICTS = ["hit", "miss", "unforeseen"];

/**
 * A number asserted about one's own quality. Lives here, not in develop-lint, so that
 * `handoff` can run it over the score text it is about to PRINT — a fidelity pass found the
 * detector was only ever applied to slice fields, so a score line reading
 * `hit — 95% confidence it was the parser` printed a self-declared number straight out of
 * the command whose whole purpose is that confidence is earned rather than claimed.
 */
export const SELF_DECLARED =
  /\b(confidence|certainty|confident|score|scored|rating|rated|likelihood|probability|success[- ]rate|accuracy)\b[^.\n]{0,24}?\b\d{1,3}(?:\.\d+)?\s*%?/i;

/**
 * A score must carry a verdict AND the thing that settles it. `hit` alone is an assertion;
 * `hit — 7 of the 9 holes were in ledger.mjs` is a record. The spec's words are "with a
 * settling ledger reference each", and validating only the leading token let the bare
 * verdict through.
 */
export function scoreProblem(value) {
  const v = String(value ?? "").trim();
  if (!v) return "missing";
  const [verdict, ...rest] = v.split(/[\s—–-]+/);
  if (!VERDICTS.includes(verdict.toLowerCase())) return "bad-verdict";
  if (rest.join(" ").trim().length < 8) return "no-reference";
  if (SELF_DECLARED.test(v)) return "self-declared-number";
  return null;
}

export const PREDICTION_FIELDS = [
  "likely-failure-mode",
  "likely-regression-site",
  "riskiest-file",
  "expected-blockers",
  "expected-proof-failures",
];

/**
 * A value counts as filled only if it carries content.
 *
 * This is a SHAPE test, not a denylist. It used to be a set of 8 known placeholder strings,
 * which meant `–` (en dash, not the em dash in the set), `(none)`, `<tbd>`, `...`, `?`, and
 * a one-letter typo of the writer's own placeholder all read as real values — so a slice
 * could claim `proof: –` and be treated as proven. A denylist of the ways to say "nothing"
 * can never be complete; a shape test does not have to be.
 */
export const isFilled = (v) => {
  if (typeof v !== "string") return false;
  const s = clean(v).trim().toLowerCase().replace(/\s+/g, " ");
  const core = s.replace(/^[<([{]+/, "").replace(/[>)\]}]+$/, "").replace(/[.…?!]+$/, "").trim();
  if (!core) return false;
  if (/^[-–—―‒−_.*·•?~]+$/.test(core)) return false;                       // punctuation only
  return !/^(tbd|todo|to-?do|n\/?a|none|nil|null|pending|wip|later|unknown|see below|empty until proven)$/.test(core);
};

/**
 * Tolerant slice-block detection. Accepts any heading level, optional emphasis around the
 * marker, and any surrounding whitespace -- `#### slice: 01`, `### *slice: 01*`, `**slice:
 * 01**` are one thing. The id grammar itself is strict: digits and dashes only.
 */
const SLICE_RE =
  /^[ \t]*(?:[-*+][ \t]+)?(?:#{1,6}[ \t]*)?(?:\*{1,2}|_{1,2})?[ \t]*slice[ \t]*:[ \t]*([0-9][0-9a-z-]*)[ \t]*(?:\*{1,2}|_{1,2})?[ \t]*(?:[—–:.)|-][ \t]*\S.*)?$/i;

/**
 * A line that READS as a slice heading to a person but does not satisfy SLICE_RE. It must
 * fail closed rather than be ignored: `#### slice: 01 — token bridge` used to fall through
 * to the heading branch, which set `current = null` and dumped the whole block's fields
 * into the brief with no error at all. One added character hid an entire slice.
 */
const NEAR_SLICE = /^[ \t>*_+-]*(?:#{1,6})?[ \t*_]*slice[ \t]*:/i;

/**
 * A `key: value` line. Tolerant of emphasis, bullets and blockquote markers, and
 * case-insensitive — `**result:**`, `> result:` and `Result:` are all the same field.
 * Case mattered: flipping `PROOF:` TIGHTENS the gate, but flipping `Result:`/`Commit:`
 * unticked the slice and skipped every check on it.
 */
const FIELD_RE =
  /^[ \t]*(?:>[ \t]*)?(?:[-*+][ \t]+)?(?:\*{1,2}|_{1,2})?[ \t]*([A-Za-z][A-Za-z0-9-]*)[ \t]*(?:\*{1,2}|_{1,2})?[ \t]*:[ \t]*(.*?)[ \t]*$/;

/**
 * A line shaped like a field whose KEY is not plain ASCII. NFKC does not fold across
 * scripts, so a Cyrillic `е` in `rеsult:` survives normalisation, misses FIELD_RE, and the
 * line is simply ignored — the slice never becomes ticked and every check on it is skipped.
 * A key that is nearly a key must fail closed rather than disappear.
 */
const NEAR_FIELD = /^[ \t>*_+-]*([^\s:]{2,40})[ \t]*:[ \t]*\S/;

/** Any heading, at any level -- used to close a block without consuming the next one. */
const HEADING_RE = /^[ \t]*#{1,6}[ \t]+\S/;

/**
 * Parse a ledger file into { brief, slices, errors }.
 *
 * `errors` is never thrown -- Phase 01's develop-lint decides what is fatal, and a parser
 * that throws cannot report WHICH slice is at fault. Every error carries a 1-based line.
 */
export function parseLedger(text) {
  const errors = [];
  if (typeof text !== "string" || text.trim() === "") {
    return { brief: {}, slices: [], scores: {}, errors: [{ line: 1, msg: "ledger is empty" }] };
  }
  // Normalise line endings only. CRLF and mixed endings are a real 3-OS input, not an
  // attack -- but nothing else about the bytes is touched.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // Object.create(null): a `{}` literal has Object.prototype's names already "in" it, so a
  // legitimate `constructor:` field was reported as a repeated key — a BLOCK firing on a
  // clean ledger, which is ADR-0101's stated revisit trigger.
  const brief = Object.create(null);
  const nonNegotiables = [];
  const scores = Object.create(null);
  const slices = [];
  let current = null;      // the slice block being filled
  let section = "brief";   // brief | non-negotiables | predictions | slices
  let inFence = false;
  const seenIds = new Map();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = clean(raw);
    const lineNo = i + 1;

    // Invisible characters are never innocent in a gated artifact: report, then match on
    // the cleaned line so the attack cannot also hide the thing it was hiding.
    if (line !== raw) {
      errors.push({ line: lineNo, id: current?.id, msg: "line contains zero-width, bidi or non-NFKC characters" });
    }

    // Fenced blocks are content, not structure. ADR-0100 puts multi-line proof output in a
    // fence, and a `# something` line inside one used to close the slice silently — so the
    // sanctioned way to record proof was also the way to make a slice stop being checked.
    if (/^[ \t]*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;

    const sliceMatch = line.match(SLICE_RE);
    if (!sliceMatch && NEAR_SLICE.test(line)) {
      errors.push({ line: lineNo, msg: "line reads as a slice heading but its id is not `[0-9][0-9a-z-]*`" });
    }
    if (sliceMatch) {
      const id = sliceMatch[1];
      if (seenIds.has(id)) {
        // Two blocks claiming one id is a corrupted ledger, not a merge to resolve.
        errors.push({ line: lineNo, id, msg: `duplicate slice id '${id}' (first seen at line ${seenIds.get(id)})` });
      }
      seenIds.set(id, lineNo);
      current = { id, line: lineNo, fields: Object.create(null) };
      slices.push(current);
      section = "slices";
      continue;
    }

    if (HEADING_RE.test(line)) {
      const h = line.replace(/^[ \t]*#+[ \t]*/, "").trim().toLowerCase();
      if (/^non-negotiables/.test(h)) section = "non-negotiables";
      else if (/^prediction scores?/.test(h)) section = "scores";
      else if (/^predictions?/.test(h)) section = "predictions";
      else if (/^slices?/.test(h)) section = "slices";
      // An UNKNOWN heading must not preserve a swallowing section. It used to leave
      // `section` untouched, so renaming `### Predictions` to `### Prediction block` and
      // `### Slices` to `### Slice ledger` kept the parser inside non-negotiables — where
      // every `key: value` line is discarded — for the rest of the file. A four-slice
      // ledger claiming `proof: it works` / `commit: yes` then parsed to ZERO slices and
      // ZERO errors, and the gate reported "all checks passed".
      else section = "brief";
      current = null;
      continue;
    }

    if (section === "non-negotiables") {
      const b = line.match(/^[ \t]*-[ \t]+(.*\S)[ \t]*$/);
      if (b) nonNegotiables.push(b[1]);
      continue;
    }

    const f = line.match(FIELD_RE);
    if (!f) {
      const near = line.match(NEAR_FIELD);
      if (near && /[^\x00-\x7F]/.test(near[1])) {
        errors.push({
          line: lineNo, id: current?.id,
          msg: `field key '${near[1]}' contains non-ASCII characters — a homoglyph key is invisible to the parser`,
        });
      }
      continue;
    }
    const key = f[1].toLowerCase();
    const value = f[2];

    // Prediction scores live in their own namespace so a verdict can never be confused
    // with the prediction it grades, and so `handoff` can tell scored from unscored.
    if (section === "scores" && !current) {
      if (Object.hasOwn(scores, key)) errors.push({ line: lineNo, msg: `prediction '${key}' scored twice` });
      else scores[key] = value;
      continue;
    }

    if (current) {
      if (Object.hasOwn(current.fields, key)) {
        errors.push({ line: lineNo, id: current.id, msg: `slice '${current.id}' repeats key '${key}'` });
        continue;
      }
      current.fields[key] = value;
    } else {
      // Brief-level fields, including the prediction block. All-of, not first-of: a
      // repeated brief key is an error rather than a silent overwrite.
      if (Object.hasOwn(brief, key)) errors.push({ line: lineNo, msg: `brief repeats key '${key}'` });
      else brief[key] = value;
    }
  }

  brief["non-negotiables"] = nonNegotiables;
  return { brief, slices, scores, errors };
}

/** A slice is proven when BOTH its result and its commit are really filled in (ADR-0065). */
export const isProven = (slice) =>
  isFilled(slice?.fields?.result) && isFilled(slice?.fields?.commit);

/** Progress as the statusline reports it: X counts PROVEN slices, never position. */
export function progress(slices) {
  const proven = slices.filter(isProven).length;
  const next = slices.find((s) => !isProven(s)) || null;
  return { proven, total: slices.length, next };
}

const KEY_ORDER = ["title", "kind", "risk", "proof", "tier", "sources", "decision", "result", "commit"];

/** Render one slice block. Key order is fixed so two runs produce identical bytes. */
export function renderSlice(slice) {
  const out = [`#### slice: ${slice.id}`, ""];
  for (const k of KEY_ORDER) out.push(`${k}: ${slice.fields[k] ?? PLACEHOLDER}`);
  out.push("");
  return out.join("\n");
}

/**
 * Render a whole ledger: Build Brief header + non-negotiables + predictions + slices.
 * Never emits `##` -- see the module header.
 */
export function renderLedger({ phase, title, brief, nonNegotiables, predictions, slices }) {
  const out = [`# Build Brief — phase ${phase} · ${title}`, ""];

  for (const [k, v] of Object.entries(brief)) out.push(`${k}: ${v}`);
  out.push("");

  out.push("### Non-negotiables", "");
  for (const b of nonNegotiables) out.push(`- ${b}`);
  out.push("");

  out.push("### Predictions", "");
  for (const k of PREDICTION_FIELDS) out.push(`${k}: ${predictions[k] ?? PLACEHOLDER}`);
  out.push("");

  out.push("### Slices", "");
  for (const s of slices) out.push(renderSlice(s));

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
