#!/usr/bin/env node
/**
 * drivers/type-tagged-hash.mjs -- a TOTAL, type-tagged encoder for the pinned config hash
 * (REQ-01, ADR-0209).
 *
 * REQ-01 asks for "one pinned config hash whose preimage is named explicitly ... each hashed
 * through a total type-tagged encoder that refuses what it cannot represent (a canonicaliser
 * that silently coerces is a collision generator)". This file is that encoder, and every rule
 * below exists because JSON.stringify breaks it:
 *
 *   JSON.stringify(undefined)      -> undefined      (a value that vanishes)
 *   JSON.stringify({a: undefined}) -> "{}"           (a KEY that vanishes)
 *   JSON.stringify(-0)             -> "0"            (two values, one encoding)
 *   JSON.stringify(new Date(0))    -> a string       (a type silently becoming another)
 *   JSON.stringify(NaN)            -> "null"         (three distinct values, one encoding)
 *   JSON.stringify({b:1,a:2})      -> key order      (same value, two encodings)
 *
 * Every one of those is a collision or an omission, and a config hash built on any of them
 * would report "unchanged" across a real change. So:
 *
 * TOTAL means every input either produces exactly one encoding or THROWS. There is no third
 * outcome, and in particular there is no "best effort" branch -- an encoder that guesses is
 * the thing being guarded against.
 *
 * TYPE-TAGGED means the tag is part of the encoding, so the string "1" and the number 1 and
 * the boolean true can never share bytes.
 *
 * LENGTH-PREFIXED means no concatenation is ambiguous. Without it {"a":"1"} and {"a1":""}
 * both flatten to the same key/value byte run, which is a collision an attacker chooses.
 *
 * SORTED KEYS means insertion order is not part of the value. Two configs that differ only in
 * the order their keys were written must hash identically, or the hash reports noise as change.
 */

import { createHash } from "node:crypto";

/** Encodings are tagged with a single letter so a tag can never be confused with content. */
const TAG = Object.freeze({
  NULL: "z", BOOL: "b", NUMBER: "n", STRING: "s", ARRAY: "a", OBJECT: "o",
});

class UnrepresentableValue extends Error {
  constructor(path, detail) {
    super(`${path}: ${detail}`);
    this.name = "UnrepresentableValue";
    this.path = path;
  }
}

/**
 * A plain value is one whose prototype is Object.prototype or null. Anything else -- a Date, a
 * Map, a RegExp, a class instance, a Buffer -- carries state this encoder cannot see, and
 * encoding only its enumerable own keys would silently drop that state. Refuse instead.
 */
function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function part(tag, body) {
  // The byte length, not the character length: a multi-byte character would otherwise let two
  // different strings claim the same span.
  return `${tag}:${Buffer.byteLength(body, "utf8")}:${body}`;
}

function encodeValue(v, path, seen) {
  if (v === null) return `${TAG.NULL}:0:`;

  const t = typeof v;

  if (t === "boolean") return part(TAG.BOOL, v ? "true" : "false");

  if (t === "number") {
    if (Number.isNaN(v)) throw new UnrepresentableValue(path, "NaN is not a representable value");
    if (!Number.isFinite(v)) throw new UnrepresentableValue(path, `${v} is not a representable value`);
    // Object.is distinguishes -0 from 0 where === does not. JSON.stringify collapses them, and
    // a canonicaliser that collapses two distinct values is precisely a collision generator.
    if (Object.is(v, -0)) return part(TAG.NUMBER, "-0");
    return part(TAG.NUMBER, String(v));
  }

  if (t === "string") return part(TAG.STRING, v);

  if (t === "undefined") throw new UnrepresentableValue(path, "undefined is absence, not a value — encode absence explicitly");
  if (t === "bigint") throw new UnrepresentableValue(path, "bigint has no agreed encoding here — convert it at the call site and say so");
  if (t === "function") throw new UnrepresentableValue(path, "a function has no value to hash");
  if (t === "symbol") throw new UnrepresentableValue(path, "a symbol has no portable encoding");

  // Object-ish from here down. Cycles are checked BEFORE the plain-object test so a cyclic
  // exotic object reports the cycle rather than the type, which is the more useful of the two.
  if (seen.has(v)) throw new UnrepresentableValue(path, "the value is cyclic");
  seen.add(v);
  try {
    if (Array.isArray(v)) {
      // A hole in a sparse array reads as undefined and would vanish. Reject the array rather
      // than encoding a length that does not match the elements present.
      //
      // AN INDEXED LOOP, NEVER .map(): Array.prototype.map SKIPS holes, so the guard below
      // written inside a map callback never executes for the case it exists to catch. The first
      // draft did exactly that and this file's own refusal corpus caught it -- the encoder
      // accepted [1, <hole>, <hole>, 4] and encoded it as though the holes were not there.
      const parts = [];
      for (let i = 0; i < v.length; i++) {
        if (!(i in v)) throw new UnrepresentableValue(`${path}[${i}]`, "sparse array hole — absence is not a value");
        parts.push(encodeValue(v[i], `${path}[${i}]`, seen));
      }
      return part(TAG.ARRAY, `${v.length}:${parts.join("")}`);
    }

    if (!isPlainObject(v)) {
      const ctor = (v.constructor && v.constructor.name) || "an exotic object";
      throw new UnrepresentableValue(path, `${ctor} carries state this encoder cannot see — convert it at the call site and say so`);
    }

    // Symbol keys are skipped by Object.keys and would vanish. Refuse rather than drop.
    if (Object.getOwnPropertySymbols(v).length) {
      throw new UnrepresentableValue(path, "the object carries symbol keys, which would vanish from the encoding");
    }

    const keys = Object.keys(v).sort();
    const body = keys.map((k) => `${part(TAG.STRING, k)}${encodeValue(v[k], `${path}.${k}`, seen)}`).join("");
    return part(TAG.OBJECT, `${keys.length}:${body}`);
  } finally {
    seen.delete(v);
  }
}

/** The canonical byte string for a value. Throws UnrepresentableValue rather than guessing. */
export function encodeTagged(value, path = "$") {
  return encodeValue(value, path, new Set());
}

/** sha256 of the canonical encoding, hex. The only hash any caller in this lane should use. */
export function taggedSha256(value) {
  return createHash("sha256").update(encodeTagged(value), "utf8").digest("hex");
}

export { UnrepresentableValue };
