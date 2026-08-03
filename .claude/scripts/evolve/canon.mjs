// canon.mjs — one TOTAL, type-tagged encoding for everything this lane hashes.
//
// WHY THIS FILE EXISTS. Hash preimages in this lane were first built by joining values with an
// in-band separator, and every one was collidable because a VALUE can contain the SEPARATOR.
// `configHash(floor: 1000)` and `configHash(floor: "1000")` produced the same hash and opposite
// verdicts.
//
// WHY IT WAS REWRITTEN. `JSON.stringify` fixed the separator problem and left a worse one, which
// a later adversarial pass found: JSON.stringify is NOT TOTAL. It folds `undefined`, `NaN`,
// `Infinity` and `-Infinity` all to `null`, drops functions and symbols, and throws on BigInt and
// on cycles. So:
//
//     effectFloor: 0          -> verdict,     hash A
//     effectFloor: null       -> verdict,     hash B
//     effectFloor: NaN        -> no-verdict,  hash B     <- same hash, different outcome
//     effectFloor: -Infinity  -> verdict,     hash B     <- the effect floor is DISABLED
//
// `-Infinity` makes every bound clear the floor — ADR-0310's gate is off — while carrying a hash
// byte-identical to a config with no floor set at all. And `NaN` is not exotic: it is what
// `Number(manifest.effect_floor)` yields on a missing or malformed field.
//
// So the encoder below is TOTAL over what it accepts and REFUSES everything else, rather than
// silently mapping several distinct meanings onto one byte string. A hash that cannot tell those
// apart is not doing the one job a config hash exists to do.

import { createHash } from "node:crypto";

/**
 * Encode a value to an unambiguous, type-tagged string. Throws on anything whose encoding would
 * be lossy or non-total.
 */
export function encode(v, seen = new Set()) {
  if (v === null) return "n";
  const t = typeof v;
  if (t === "boolean") return v ? "b1" : "b0";
  if (t === "string") return `s${v.length}:${v}`;           // length-prefixed: no separator can merge fields
  if (t === "number") {
    if (!Number.isFinite(v)) throw new TypeError(`canon: ${String(v)} has no total encoding — NaN and +/-Infinity all fold to null in JSON, so a disabled floor would hash identically to an unset one`);
    // -0 and 0 are `===` but behave differently in a comparison chain; encode them apart.
    if (Object.is(v, -0)) return "d-0";
    return `d${v}`;
  }
  if (t === "bigint") throw new TypeError("canon: BigInt has no total encoding here — convert it at the boundary where its range is known");
  if (t === "undefined") throw new TypeError("canon: undefined has no total encoding — JSON folds it to null, so an absent field would hash identically to an explicit null");
  if (t === "function" || t === "symbol") throw new TypeError(`canon: a ${t} cannot be hashed`);
  if (Array.isArray(v)) {
    if (seen.has(v)) throw new TypeError("canon: cyclic structure");
    seen.add(v);
    const out = `a${v.length}:[${v.map((x) => encode(x, seen)).join(",")}]`;
    seen.delete(v);
    return out;
  }
  // Plain objects only. A Map, a Set, a Date, a class instance or a Proxy all stringify to
  // something lossy — `new Set(["+a","+b"])` and `new Set(["+a"])` both became `{}`, so a
  // two-arm and a one-arm experiment shared a hash.
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`canon: only plain objects can be hashed (got ${v?.constructor?.name ?? "an exotic object"})`);
  if (seen.has(v)) throw new TypeError("canon: cyclic structure");
  seen.add(v);
  // OWN keys, sorted, so key order cannot change the digest and an inherited property cannot
  // enter it.
  const keys = Object.keys(v).sort();
  const out = `o${keys.length}:{${keys.map((k) => `${encode(k, seen)}=${encode(v[k], seen)}`).join(",")}}`;
  seen.delete(v);
  return out;
}

/**
 * A domain-separated, injective digest.
 *
 * @param {string} domain  a constant naming what is hashed. NOT caller data — this is what keeps
 *                         the arm draw and the cohort draw in different spaces even when a unit
 *                         id is chosen to imitate the other domain's suffix.
 */
export function digest(domain, parts) {
  if (typeof domain !== "string" || domain.length === 0) throw new TypeError("canon: domain must be a non-empty string");
  if (!Array.isArray(parts)) throw new TypeError("canon: parts must be an array");
  return createHash("sha256").update(encode([domain, ...parts])).digest("hex");
}

/** `digest`, but returning a refusal instead of throwing — for callers that must never throw. */
export function tryDigest(domain, parts) {
  try { return { hash: digest(domain, parts), reason: null }; }
  catch (e) { return { hash: null, reason: e?.message ?? String(e) }; }
}

/** The first 52 bits of a digest, as an integer. */
export function digestBits52(domain, parts) {
  return Number.parseInt(digest(domain, parts).slice(0, 13), 16);
}
