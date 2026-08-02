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
const PLACEHOLDERS = new Set(["", "-", "--", "—", "tbd", "none", "n/a", PLACEHOLDER.toLowerCase()]);

export const TIERS = ["static", "unit", "contract", "integration", "e2e-visual", "verified-real"];
export const KINDS = ["ui", "external-dep", "logic", "infra"];

export const PREDICTION_FIELDS = [
  "likely-failure-mode",
  "likely-regression-site",
  "riskiest-file",
  "expected-blockers",
  "expected-proof-failures",
];

/** A value counts as filled only if it is present and not one of the placeholder forms. */
export const isFilled = (v) =>
  typeof v === "string" && !PLACEHOLDERS.has(v.trim().toLowerCase().replace(/\s+/g, " "));

/**
 * Tolerant slice-block detection. Accepts any heading level, optional emphasis around the
 * marker, and any surrounding whitespace -- `#### slice: 01`, `### *slice: 01*`, `**slice:
 * 01**` are one thing. The id grammar itself is strict: digits and dashes only.
 */
const SLICE_RE = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}|_{1,2})?[ \t]*slice[ \t]*:[ \t]*([0-9][0-9a-z-]*)[ \t]*(?:\*{1,2}|_{1,2})?[ \t]*$/i;

/** A `key: value` line. Keys are lowercase-with-dashes; anything else is not a field. */
const FIELD_RE = /^[ \t]*([a-z][a-z0-9-]*)[ \t]*:[ \t]*(.*?)[ \t]*$/;

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
    return { brief: {}, slices: [], errors: [{ line: 1, msg: "ledger is empty" }] };
  }
  // Normalise line endings only. CRLF and mixed endings are a real 3-OS input, not an
  // attack -- but nothing else about the bytes is touched.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  const brief = {};
  const nonNegotiables = [];
  const slices = [];
  let current = null;      // the slice block being filled
  let section = "brief";   // brief | non-negotiables | predictions | slices
  const seenIds = new Map();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;

    const sliceMatch = raw.match(SLICE_RE);
    if (sliceMatch) {
      const id = sliceMatch[1];
      if (seenIds.has(id)) {
        // Two blocks claiming one id is a corrupted ledger, not a merge to resolve.
        errors.push({ line: lineNo, id, msg: `duplicate slice id '${id}' (first seen at line ${seenIds.get(id)})` });
      }
      seenIds.set(id, lineNo);
      current = { id, line: lineNo, fields: {} };
      slices.push(current);
      section = "slices";
      continue;
    }

    if (HEADING_RE.test(raw)) {
      const h = raw.replace(/^[ \t]*#+[ \t]*/, "").trim().toLowerCase();
      if (/^non-negotiables/.test(h)) section = "non-negotiables";
      else if (/^predictions/.test(h)) section = "predictions";
      else if (/^slices/.test(h)) section = "slices";
      else if (/^build brief/.test(h)) section = "brief";
      current = null;
      continue;
    }

    if (section === "non-negotiables") {
      const b = raw.match(/^[ \t]*-[ \t]+(.*\S)[ \t]*$/);
      if (b) nonNegotiables.push(b[1]);
      continue;
    }

    const f = raw.match(FIELD_RE);
    if (!f) continue;
    const key = f[1].toLowerCase();
    const value = f[2];

    if (current) {
      if (key in current.fields) {
        errors.push({ line: lineNo, id: current.id, msg: `slice '${current.id}' repeats key '${key}'` });
        continue;
      }
      current.fields[key] = value;
    } else {
      // Brief-level fields, including the prediction block. All-of, not first-of: a
      // repeated brief key is an error rather than a silent overwrite.
      if (key in brief) errors.push({ line: lineNo, msg: `brief repeats key '${key}'` });
      else brief[key] = value;
    }
  }

  brief["non-negotiables"] = nonNegotiables;
  return { brief, slices, errors };
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
