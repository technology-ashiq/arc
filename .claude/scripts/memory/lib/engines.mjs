// The engine registry and the equivalence contract (REQ-07, ADR-0701).
//
// THE SQLITE ENGINE IS CUT (2026-08-11, ADR-0701 amendment). Phase 01 measured the search at
// 0.42ms of a 199ms wall clock, so the accelerator would have accelerated 0.2% of the elapsed
// time. What ships here is the CONTRACT and the HARNESS, so that if the build trigger ever fires
// -- `index.json` past 25MB, or a measured load over 500ms, whichever first -- a second engine
// plugs into a gate that ALREADY EXISTS rather than into one written afterwards to justify it.
// A gate authored alongside the thing it grades tends to grade what that thing happens to do.
//
// THE TIE-BREAK IS THE CONTRACT, not a footnote to it. Two engines agree only if they return the
// same ORDERED ids; bm25 ties are common on a corpus this size, so "same set of ids" is not
// agreement and a harness that compared sets would pass two engines that rank differently. Ties
// break by **id ascending**, which is a total, stable order that is a property of the data rather
// than of how the index happened to be read. And it is ASSERTED against a synthetic all-ties
// corpus (`checkTieBreak`), not merely printed: for one commit `TIE_BREAK` was a string this file
// exported and nothing compared against, so inverting bm25's comparator to id-DESCENDING left both
// `--equivalence` and `--gate` green.
//
// One engine is registered today. The harness says so ITSELF rather than printing a green that
// could be read as "two engines agree" -- a pass condition that cannot distinguish "they agree"
// from "there is nothing to compare" is the vacuous pass wearing a gate's clothes.

import { search, buildPostings } from "./bm25.mjs";

/** The documented, asserted tie-break. Changing this string is changing the contract. */
export const TIE_BREAK = "id-ascending on equal bm25";

/**
 * Every engine, in registration order. `js` is CANONICAL (ADR-0701): it is the reference the
 * others are compared against, it runs on Node >= 18 on all three OSes with zero dependencies,
 * and it can never be unavailable. A future `sqlite` entry declares `available()` false on the
 * 4 of 5 OS-by-node combinations without `node:sqlite`, and the harness counts that visibly.
 */
export const ENGINES = Object.freeze([
  Object.freeze({
    name: "js",
    canonical: true,
    available: () => true,
    // Returns ORDERED ids. The harness compares this array, never a set.
    run: (index, records, tokens, opts) =>
      search(index.postings ?? { terms: {}, lengths: [], avgdl: 0 }, records, tokens, opts)
        .map((h) => records[h.index]?.id)
        .filter(Boolean),
  }),
]);

export function availableEngines(registry = ENGINES) {
  return registry.filter((e) => {
    // An engine whose availability probe THROWS is unavailable, not fatal: a missing optional
    // module must never break the canonical path it only accelerates (a PLAN non-negotiable).
    try { return e.available() === true; } catch { return false; }
  });
}

export function resolveEngine(requested, registry = ENGINES) {
  const avail = availableEngines(registry);
  if (requested === "auto") {
    // `auto` resolves to the CANONICAL engine unless another one carries a MEASURED speed claim.
    //
    // It used to return `avail[avail.length - 1]` under the words "prefers the fastest available",
    // which encoded speed as REGISTRATION ORDER: appending a second engine to `ENGINES` would have
    // made it the default for every `auto` caller before any measurement said it was faster, and
    // ADR-0701's whole point is that the accelerator earns its place on a number. There is no speed
    // field in this registry, so `auto` picks the reference rather than pretending to rank. A future
    // engine becomes the auto default by declaring `fasterThanCanonical: true` with the ADR-0701
    // measurement recorded beside it -- a claim someone has to write down, not a position in a list.
    return avail.find((e) => e.fasterThanCanonical === true)
      ?? avail.find((e) => e.canonical)
      ?? avail[0]
      ?? registry.find((e) => e.canonical)
      ?? null;
  }
  return avail.find((e) => e.name === requested) ?? null;
}

// ---------- the tie-break, ASSERTED rather than printed ----------
//
// `TIE_BREAK` above was a string the harness PRINTED and never a property it checked. Inverting
// bm25's comparator to id-DESCENDING left `--equivalence` and `--gate` both passing at exit 0,
// because with one engine determinism holds under any total order and the golden suite only
// asserted that the sentence appeared. A contract nothing tests is a comment (2026-08-12,
// adversarial decision-logic row 11).
//
// Registration order deliberately is NOT sorted order, so "returned them in the order I built
// them" and "returned them id-ascending" are different answers to this probe.
export const TIE_BREAK_PROBE_IDS = Object.freeze(["probe:c", "probe:a", "probe:b"]);

/** The synthetic corpus the tie-break is asserted against. Pure, and built from the same
 *  `buildPostings` the real index uses, so the probe cannot pass under a scoring rule the
 *  product does not run. Every record carries byte-identical searchable text, so bm25 MUST
 *  score them equally and the returned ORDER is decided by the tie-break alone. */
export function tieBreakProbe() {
  const records = TIE_BREAK_PROBE_IDS.map((id) => ({
    id, organ: "probe", path: "(probe)", line: 0,
    title: "tie break probe", body: "tie break probe", tags: ["probe"],
  }));
  return {
    index: { postings: buildPostings(records), records },
    records,
    tokens: ["probe"],
    expected: [...TIE_BREAK_PROBE_IDS].sort(),
  };
}

/**
 * Does every available engine really break ties the way `TIE_BREAK` says?
 *
 * Returns one row per engine. An engine that throws on the probe is a FAILURE, not a skip: an
 * engine that cannot rank the reference corpus cannot be certified as agreeing with one that can.
 */
export function checkTieBreak(registry = ENGINES) {
  const { index, records, tokens, expected } = tieBreakProbe();
  const out = [];
  for (const e of availableEngines(registry)) {
    let ids;
    try { ids = e.run(index, records, tokens, { limit: expected.length }); }
    catch (err) { out.push({ engine: e.name, ok: false, ids: [], expected, error: String(err?.message ?? err) }); continue; }
    out.push({ engine: e.name, ok: JSON.stringify(ids) === JSON.stringify(expected), ids, expected, error: null });
  }
  return out;
}

/**
 * Do all available engines return the same ordered ids for every query?
 *
 * Pure: takes the index, the records and the queries, and returns a verdict object. The caller
 * decides what to do with it, and the I/O and the exit code live there.
 *
 * With ONE engine there is nothing to compare, so this proves DETERMINISM instead -- the same
 * engine run twice on the same input must return the identical ordered ids -- and it reports
 * `compared: false` so no caller can render it as agreement.
 */
export function checkEquivalence({ index, records, queries, limit = 3, registry = ENGINES }) {
  const engines = availableEngines(registry);
  const unavailable = registry.filter((e) => !engines.includes(e)).map((e) => e.name);
  const mismatches = [];
  const opts = { limit };

  // The tie-break is checked FIRST and counts as a mismatch like any other. It is the one property
  // this harness claims to own, and until 2026-08-12 it was the one property it never looked at.
  const tieBreak = checkTieBreak(registry);
  for (const t of tieBreak) {
    if (t.ok) continue;
    mismatches.push({
      query: "(tie-break probe)", kind: "tie-break", a: t.engine, b: `the contract (${TIE_BREAK})`,
      aIds: t.ids, bIds: t.expected,
    });
  }

  for (const q of queries) {
    const runs = engines.map((e) => ({ name: e.name, ids: e.run(index, records, q.tokens, opts) }));
    if (engines.length === 1) {
      // Determinism, stated as such. A second call, not a cached first one.
      const again = engines[0].run(index, records, q.tokens, opts);
      if (JSON.stringify(again) !== JSON.stringify(runs[0].ids)) {
        mismatches.push({ query: q.id, kind: "nondeterministic", a: engines[0].name, b: engines[0].name, aIds: runs[0].ids, bIds: again });
      }
      continue;
    }
    // Every PAIR, not just each-against-the-first: three engines where B and C agree with A on
    // different queries can still disagree with each other, and a first-anchored comparison
    // would never look.
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        if (JSON.stringify(runs[i].ids) !== JSON.stringify(runs[j].ids)) {
          mismatches.push({ query: q.id, kind: "disagreement", a: runs[i].name, b: runs[j].name, aIds: runs[i].ids, bIds: runs[j].ids });
        }
      }
    }
  }

  return {
    tieBreak: TIE_BREAK,
    // The probe's verdict per engine, so a caller prints an ASSERTED result and not a slogan.
    tieBreakChecked: tieBreak,
    tieBreakHeld: tieBreak.every((t) => t.ok),
    engines: engines.map((e) => e.name),
    unavailable,
    // FALSE with one engine. The word "compared" is load-bearing: it is what stops a green here
    // from being read as two engines agreeing.
    compared: engines.length >= 2,
    queries: queries.length,
    mismatches,
  };
}
