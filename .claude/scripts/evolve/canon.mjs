// canon.mjs — one injective encoding for everything this lane hashes.
//
// WHY THIS FILE EXISTS. Three separate hash preimages in this lane were built by joining values
// with an in-band separator — `|` for assignment, `,` and `\n` for the config and metric hashes.
// Every one of them was collidable, because a VALUE can contain the SEPARATOR:
//
//   armFor("a|b", "c")            and armFor("a", "b|c")            -> the same bucket
//   cohortFor(e, "u7")            and armFor(e, "u7|cohort")        -> the SAME draw, so the arm
//                                                                      and cohort were 100%
//                                                                      correlated for that unit
//   configHash(arms ["+a","+b"])  and configHash(arms ["+a,+b"])    -> the same hash, and one is
//                                                                      a two-arm experiment while
//                                                                      the other has one arm
//   configHash(floor 1000)        and configHash(floor "1000")      -> the SAME hash and OPPOSITE
//                                                                      verdicts
//
// The last one is the whole argument in one line: a config hash exists precisely so that two
// verdicts carrying the same hash were computed under the same rules. A hash that cannot tell
// 1000 from "1000" is not doing that job.
//
// The fix is to stop hand-rolling delimiters. `JSON.stringify` of an array is injective over the
// values we hash — types are preserved (1 and "1" encode differently), and a separator inside a
// string is escaped rather than merging two fields.

import { createHash } from "node:crypto";

/**
 * A domain-separated, injective digest.
 *
 * @param {string} domain  a constant naming what is being hashed. NOT caller data — this is what
 *                         keeps the arm draw and the cohort draw in different spaces even when a
 *                         unit id is chosen to imitate the other domain's suffix.
 * @param {unknown[]} parts
 */
export function digest(domain, parts) {
  return createHash("sha256").update(JSON.stringify([domain, ...parts])).digest("hex");
}

/** The first 52 bits of a digest, as an integer. */
export function digestBits52(domain, parts) {
  return Number.parseInt(digest(domain, parts).slice(0, 13), 16);
}
