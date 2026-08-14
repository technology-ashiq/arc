// growth/slop-lint -- REQ-02, ADR-1110. NEGATIVE ONLY, FOREVER.
//
// This lint reports bad patterns it FOUND. It never reports what is absent, never requires a
// structure, and never scores. ADR-1110 makes that one-way: a prescriptive rule arrives only with
// its own ADR arguing the creativity cost. If you are here to add "articles must have an FAQ", the
// ADR is the door, and it is deliberately heavy.
//
// WHAT A PASS MEANS, AND ONLY THIS: no marker in the list matched. It is not a judgement that the
// text is good. ADR-0049's finding -- a pass condition that is only an absence cannot detect
// mediocrity -- applies to this file by construction, which is why the honest-limit fixture is
// mandatory and why the POV floor is a human line in the review pack rather than another marker.

import { readFileSync } from "node:fs";
import { blocks, foldBlock, foldForPhrases, EM_DASHES_RE } from "./text.mjs";

export class SlopLintError extends Error {
  constructor(code, message) { super(message); this.name = "SlopLintError"; this.code = code; }
}

const MARKER_KEYS = new Set(["schema", "version", "phrases", "structural"]);
const PHRASE_KEYS = new Set(["id", "why", "variants"]);
const STRUCTURAL_KEYS = new Set(["id", "why", "max_per_line"]);
const ID_RE = /^slop-[a-z0-9][a-z0-9-]{0,63}$/;
// Every structural marker id this code can actually enforce. A file naming one that is not here is
// an ERROR rather than a silently skipped rule: a marker that looks configured and runs nothing is
// the "gate that passes while doing nothing" shape, and it would be invisible in a passing report.
const STRUCTURAL_IMPLEMENTED = new Set(["slop-em-dash-density"]);

// Provenance brand. `scanSlop` used to accept any object with two arrays, so every invariant
// `loadMarkers` enforces -- non-empty list, implemented structural ids, lowercase variants -- was
// unenforced for any other caller, and the `version` printed in the report was whatever the caller
// supplied. A shape test is not a provenance check; this is (adversarial pass, 2026-08-14).
const FROM_LOADER = Symbol("slop-markers-from-loadMarkers");

/**
 * Read and validate the versioned marker list.
 *
 * Closed key sets, in the `loadSources`/`assertCandidate` pattern this lane uses everywhere: an
 * unknown field is an error, not something ignored. A typo'd `varients:` would otherwise produce a
 * marker with zero variants that matches nothing and reports clean.
 */
export function loadMarkers(text) {
  let doc;
  try {
    doc = JSON.parse(typeof text === "string" ? text.replace(/^﻿/, "") : text);
  } catch (e) {
    throw new SlopLintError("BAD_MARKERS", `marker list is not JSON: ${e.message}`);
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc))
    throw new SlopLintError("BAD_MARKERS", "marker list must be a JSON object");
  if (doc.schema !== 1)
    throw new SlopLintError("BAD_MARKERS", `marker list schema must be 1, got ${JSON.stringify(doc.schema)}`);
  if (typeof doc.version !== "string" || doc.version.trim() === "")
    throw new SlopLintError("BAD_MARKERS", "marker list needs a non-empty version string");
  for (const k of Object.keys(doc)) {
    // `_`-prefixed keys are the file's own comments. `__proto__` is excluded explicitly: it is the
    // one name that would slip through a prefix rule, and a closed key set with one hole is not one.
    if (k === "__proto__") throw new SlopLintError("BAD_MARKERS", "marker list may not carry a __proto__ key");
    if (!MARKER_KEYS.has(k) && !k.startsWith("_"))
      throw new SlopLintError("BAD_MARKERS", `marker list has unknown key ${JSON.stringify(k)}`);
  }

  const seen = new Set();
  const phrases = [];
  if (!Array.isArray(doc.phrases))
    throw new SlopLintError("BAD_MARKERS", "marker list needs a `phrases` array");
  for (const m of doc.phrases) {
    if (m === null || typeof m !== "object" || Array.isArray(m))
      throw new SlopLintError("BAD_MARKERS", "every phrase marker must be an object");
    for (const k of Object.keys(m))
      if (!PHRASE_KEYS.has(k)) throw new SlopLintError("BAD_MARKERS", `phrase marker has unknown key ${JSON.stringify(k)}`);
    if (typeof m.id !== "string" || !ID_RE.test(m.id))
      throw new SlopLintError("BAD_MARKERS", `phrase marker id ${JSON.stringify(m.id)} must match slop-[a-z0-9-]`);
    if (seen.has(m.id)) throw new SlopLintError("BAD_MARKERS", `duplicate marker id ${m.id}`);
    seen.add(m.id);
    if (typeof m.why !== "string" || m.why.trim() === "")
      throw new SlopLintError("BAD_MARKERS", `marker ${m.id} needs a non-empty why`);
    if (!Array.isArray(m.variants) || m.variants.length === 0)
      throw new SlopLintError("BAD_MARKERS", `marker ${m.id} needs at least one variant`);
    const variants = [];
    for (const v of m.variants) {
      if (typeof v !== "string") throw new SlopLintError("BAD_MARKERS", `marker ${m.id} has a non-string variant`);
      // Folded with the SAME function the scanner folds text with. A variant folded any other way
      // -- or not folded at all -- can never match, and a capitalised variant in a reviewed data
      // file would silently match nothing forever.
      const n = foldForPhrases(v);
      if (n === "") throw new SlopLintError("BAD_MARKERS", `marker ${m.id} has a variant that folds to empty`);
      variants.push(n);
    }
    phrases.push({ id: m.id, why: m.why, variants });
  }

  const structural = [];
  if (doc.structural !== undefined) {
    if (!Array.isArray(doc.structural))
      throw new SlopLintError("BAD_MARKERS", "`structural` must be an array when present");
    for (const m of doc.structural) {
      if (m === null || typeof m !== "object" || Array.isArray(m))
        throw new SlopLintError("BAD_MARKERS", "every structural marker must be an object");
      for (const k of Object.keys(m))
        if (!STRUCTURAL_KEYS.has(k)) throw new SlopLintError("BAD_MARKERS", `structural marker has unknown key ${JSON.stringify(k)}`);
      if (typeof m.id !== "string" || !ID_RE.test(m.id))
        throw new SlopLintError("BAD_MARKERS", `structural marker id ${JSON.stringify(m.id)} must match slop-[a-z0-9-]`);
      if (seen.has(m.id)) throw new SlopLintError("BAD_MARKERS", `duplicate marker id ${m.id}`);
      seen.add(m.id);
      if (!STRUCTURAL_IMPLEMENTED.has(m.id))
        throw new SlopLintError("BAD_MARKERS", `structural marker ${m.id} has no implementation -- a configured rule that runs nothing reports clean`);
      if (typeof m.why !== "string" || m.why.trim() === "")
        throw new SlopLintError("BAD_MARKERS", `marker ${m.id} needs a non-empty why`);
      if (!Number.isInteger(m.max_per_line) || m.max_per_line < 0)
        throw new SlopLintError("BAD_MARKERS", `marker ${m.id} needs an integer max_per_line >= 0`);
      structural.push({ id: m.id, why: m.why, max_per_line: m.max_per_line });
    }
  }
  if (phrases.length === 0 && structural.length === 0)
    throw new SlopLintError("BAD_MARKERS", "marker list is empty, so a scan could only ever report clean");
  return { version: doc.version, phrases, structural, [FROM_LOADER]: true };
}

/**
 * Scan text. Returns every finding, in file order. No verdict is computed here and no number is
 * attached to the text as a whole -- the caller decides what to do with a list.
 *
 * Matching is per BLOCK, not per line. It was per physical line, so any listed phrase that happened
 * to straddle a markdown soft wrap was missed -- the same paragraph hard-wrapped at 72, 80 and 100
 * columns produced 15, 15 and 14 distinct findings against 16 unwrapped. Whether the gate went red
 * was decided by the writer's editor. Line numbers are recovered from the fold, so a report still
 * points at a line a human can open.
 *
 * `linesRead` and `blocksScanned` are returned so a caller can prove the scan RAN. A lint reporting
 * zero findings because it read an empty string is indistinguishable, in its output, from one that
 * read the article and found it clean -- and this repo has shipped that confusion three times.
 */
export function scanSlop(text, markers) {
  if (typeof text !== "string")
    throw new SlopLintError("BAD_INPUT", "text to scan must be a string");
  if (!markers || markers[FROM_LOADER] !== true)
    throw new SlopLintError("BAD_INPUT", "markers must come from loadMarkers() -- a hand-built object bypasses every check the loader makes");

  const findings = [];
  const bs = blocks(text);
  for (const b of bs) {
    // Fenced code is scanned too. A fence must never be a bypass: wrapping the tell in backticks
    // would otherwise switch the whole list off. The cost is a false positive on an article that
    // quotes a marker inside a code sample, which is visible and cheap; a silent bypass is neither.
    const { folded, lineAt } = foldBlock(b, { phrases: true });
    if (folded !== "") {
      for (const m of markers.phrases) {
        let hit = -1, which = "";
        for (const v of m.variants) {
          const at = folded.indexOf(v);
          if (at !== -1 && (hit === -1 || at < hit)) { hit = at; which = v; }
        }
        if (hit !== -1)
          findings.push({ marker_id: m.id, line: lineAt(hit), found: which, why: m.why, excerpt: excerpt(folded, hit) });
      }
    }
    // Structural markers read the RAW line: an em-dash count taken after the fold would see every
    // dash as an ASCII hyphen and report zero forever. The dash SET is shared with the fold, because
    // counting only U+2014 while the fold treated six characters as dashes let an en-dash pile
    // evade the one structural marker in the list.
    for (const m of markers.structural)
      if (m.id === "slop-em-dash-density")
        for (const l of b.lines) {
          const n = (l.text.match(EM_DASHES_RE) || []).length;
          if (n > m.max_per_line)
            findings.push({ marker_id: m.id, line: l.line, found: `${n} em-dashes`, why: m.why, excerpt: excerpt(l.text, 0) });
        }
  }
  findings.sort((a, b2) => a.line - b2.line || (a.marker_id < b2.marker_id ? -1 : a.marker_id > b2.marker_id ? 1 : 0));
  return {
    version: markers.version,
    // The HONEST counts. `linesScanned` used to be `split().length`, which is 1 for a zero-byte
    // file and one more than the truth for any file ending in a newline -- so the single field
    // whose job was proving the scan ran could never report the honest 0 (defect: a number
    // reported that is not the number measured, which this lane had already fixed in `mine`).
    linesRead: countLines(text),
    blocksScanned: bs.length,
    findings,
  };
}

function countLines(text) {
  if (text === "") return 0;
  const parts = String(text).split(/\r\n|\r|\n/);
  if (parts[parts.length - 1] === "") parts.pop(); // a trailing terminator does not open a line
  return parts.length;
}

function excerpt(s, at) {
  const start = Math.max(0, at - 40);
  const t = String(s).slice(start, start + 160).trim();
  return t.length >= 160 ? t + "..." : t;
}

/** Convenience: read a marker file and a text file from disk. */
export function scanFile(textPath, markersPath) {
  let markerText;
  try { markerText = readFileSync(markersPath, "utf8"); }
  catch (e) { throw new SlopLintError("NO_MARKERS", `marker list ${markersPath} cannot be read: ${e.message}`); }
  let text;
  try { text = readFileSync(textPath, "utf8"); }
  catch (e) { throw new SlopLintError("NO_TEXT", `${textPath} cannot be read: ${e.message}`); }
  return scanSlop(text, loadMarkers(markerText));
}

/**
 * Render a report a human reads in the review pack. It states what a clean result means, because
 * the one-line "slop-lint: clean" that a reviewer skims is exactly where the lint's limits get
 * forgotten.
 */
export function renderSlopReport(result) {
  const head = `slop-lint v${result.version} -- read ${result.linesRead} line(s) in ${result.blocksScanned} block(s)`;
  if (result.findings.length === 0)
    return `${head}\nNo marker matched. That means no marker matched -- it is not a judgement that the writing is good. The POV floor below is where that is decided.`;
  const rows = result.findings.map((f) => `  L${f.line} [${f.marker_id}] ${JSON.stringify(f.found)} -- ${f.why}\n      ${f.excerpt}`);
  return `${head}\n${result.findings.length} marker hit(s):\n${rows.join("\n")}`;
}
