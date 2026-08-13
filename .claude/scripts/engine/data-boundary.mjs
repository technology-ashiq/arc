#!/usr/bin/env node
/**
 * data-boundary.mjs -- the refusal that happens ABOVE the driver (Phase 06, REQ-02 fixtures 2
 * and 3; ADR-0219).
 *
 * WHY THE LAYER MATTERS MORE THAN THE CHECK. The design source asked for an ENG-D driver exit
 * map of 0/2/3/4/5 with a data-boundary code in it. That map does not exist: the real driver map
 * is 0 ok / 1 driver-fail / 2 budget-declined and this cycle adds nothing to it. ADR-0219 kept
 * the NUMBER and moved the LAYER -- the refusal happens at arc-run, before any driver process is
 * spawned, and exits 5 there. A boundary enforced inside the driver would already have handed
 * the document to the runtime by the time it refused.
 *
 * WHY 5 AND NOT 1. arc-run already overloads 1 for "cannot proceed" -- unknown process,
 * unparseable router, unknown driver. A fixture has to distinguish REFUSED FOR BOUNDARY REASONS
 * from PROCESS DID NOT PARSE, and a boundary refusal indistinguishable from a parse error is a
 * boundary nobody can assert. arc-run 3 and 4 stay unused and reserved (ADR-0219 publishes the
 * whole table) so their absence reads as deliberate rather than accidental.
 *
 * ONE FUNCTION, EVERY PATH THROUGH IT. REQ-06 is explicit that there is one confinement function
 * and never two call sites that can drift -- the pre-dispatch check and the routing check both
 * call `boundaryRefusal()` here. Two copies of a rule diverge on the first change to either, and
 * this repository has already paid for that shape more than once in one cycle.
 *
 * WHAT THIS PHASE BUILDS, AND WHAT IT DOES NOT. Phase 06 builds the MECHANISM: an internal-only
 * document is detected and refused. Phase 08's REQ-06 layers the context-pack SEMANTICS on top --
 * approval, batch size, angle, carry-over -- including the stricter rule that an UNMARKED input
 * is refused for a `cap: L1-drafts` row rather than merely an internal-only one. That tightening
 * is named here so its absence today is a recorded scope line and not an oversight.
 */

/** arc-run's data-boundary refusal code. Not a driver code (ADR-0219). */
export const EXIT_DATA_BOUNDARY = 5;

/**
 * How a document says it is internal.
 *
 * A PLANTED TOKEN and a CLASSIFICATION FIELD, and both are needed. The field is how a real
 * context pack declares itself; the token is how a fixture plants a marker somewhere nobody
 * declared, which is the case fixture 5 exists for. Matching loose prose containing the words
 * "internal only" would be a false-positive generator, so neither form is a substring search over
 * arbitrary text.
 */
const CLASSIFICATION_KEYS = new Set(["classification", "data-classification", "dataClassification"]);
const INTERNAL_VALUES = new Set(["internal-only", "internal_only", "internalonly"]);
const PLANTED_TOKEN = /\bARC-INTERNAL-ONLY\b/;

/** Walk depth cap. A document deeper than this is refused rather than partially inspected. */
const MAX_DEPTH = 12;

export class BoundaryScanIncomplete extends Error {
  constructor(why) {
    super(`the boundary scan could not complete: ${why}`);
    this.name = "BoundaryScanIncomplete";
  }
}

/**
 * Every internal-only marker in a document, with the path each was found at.
 *
 * THROWS RATHER THAN RETURNING EMPTY when it cannot finish. An unfinished scan that reports "no
 * markers" is the same failure shape as a grep whose exit status was discarded: the caller cannot
 * tell "clean" from "did not look", and the permissive reading is the one that ships.
 */
export function findInternalMarkers(doc) {
  const found = [];
  const seen = new Set();

  const walk = (v, path, depth) => {
    if (depth > MAX_DEPTH) throw new BoundaryScanIncomplete(`the document nests deeper than ${MAX_DEPTH} levels at ${path}`);
    if (v === null || v === undefined) return;

    if (typeof v === "string") {
      if (PLANTED_TOKEN.test(v)) found.push({ path, why: "carries the planted internal-only token" });
      return;
    }
    if (typeof v !== "object") return;

    if (seen.has(v)) throw new BoundaryScanIncomplete(`the document is cyclic at ${path}`);
    seen.add(v);
    try {
      if (Array.isArray(v)) {
        v.forEach((el, i) => walk(el, `${path}[${i}]`, depth + 1));
        return;
      }
      for (const [k, val] of Object.entries(v)) {
        // The classification FIELD, checked by key rather than by value alone: a document whose
        // prose happens to contain the phrase is not a classified document.
        if (CLASSIFICATION_KEYS.has(k) && typeof val === "string" && INTERNAL_VALUES.has(val.trim().toLowerCase())) {
          found.push({ path: `${path}.${k}`, why: `declares itself ${val.trim()}` });
        }
        walk(val, `${path}.${k}`, depth + 1);
      }
    } finally {
      seen.delete(v);
    }
  };

  walk(doc, "$", 0);
  return found;
}

/**
 * The one confinement decision. Returns null when the dispatch may proceed, or a refusal.
 *
 * @param {object} args
 * @param {*}      args.input        the process input document, already parsed
 * @param {string} args.processName  named in the refusal so an operator knows what was stopped
 * @param {string} args.hosted       the router row's `hosted:` value, or "" when unrouted
 * @returns {null | {code: number, reason: string, markers: object[]}}
 */
export function boundaryRefusal({ input, processName, hosted }) {
  let markers;
  try {
    markers = findInternalMarkers(input);
  } catch (e) {
    // FAIL CLOSED. A scan that threw has not established that the document is clean, and the one
    // honest verdict for "the check did not happen" is refusal.
    return {
      code: EXIT_DATA_BOUNDARY,
      reason: `${e.message} — refusing rather than dispatching a document that was not fully inspected`,
      markers: [],
    };
  }

  if (!markers.length) return null;

  // Fixture 3 is the same refusal reported with the routing fact attached, NOT a second rule.
  // Writing it as its own check is how the two would drift.
  const where = String(hosted || "").trim().toLowerCase() === "cloud"
    ? ` against a hosted: cloud row, which sends it off this machine`
    : "";
  return {
    code: EXIT_DATA_BOUNDARY,
    reason: `the input for ${processName} is internal-only${where} — refused before any driver process was started`,
    markers,
  };
}
