/**
 * A TOTAL, type-tagged canonicaliser (ADR-1004).
 *
 * The receipt attests to bytes, so the function that produces the preimage is the whole
 * chain's weakest point. arc has shipped this defect twice already:
 *
 *   arc-evolve 2026-08-04 -- a configHash gave `floor: 1000` and `floor: "1000"` the SAME
 *   hash; the JSON.stringify "fix" then folded NaN and -Infinity to null, so a deliberately
 *   DISABLED floor hashed identically to an unset one. Two opposite states, one hash.
 *
 *   arc-absorb 2026-08-09 -- changing a preimage format silently invalidated every
 *   outstanding commitment, and the verifier then accused the owner of TAMPERING.
 *
 * So: every value carries its TYPE TAG, the encoder REFUSES what it cannot represent rather
 * than coercing it, and the preimage carries its own version so a format change is
 * diagnosable as a format change instead of as tampering.
 */
import { createHash } from "node:crypto";

export const PREIMAGE_VERSION = "arc-legal-canon/1";

export class CanonError extends Error {
  constructor(code, path, message) {
    super(`${code} at ${path || "<root>"}: ${message}`);
    this.code = code;
    this.path = path;
  }
}

/**
 * Encode a value into its canonical text. Strings are NFC-normalised BEFORE hashing, so the
 * same name typed on macOS (NFD) and on Linux (NFC) produces one hash rather than two -- byte
 * equality is not a normalisation strategy, it is the absence of one.
 *
 * Length is emitted before every string so that {"ab":"c"} and {"a":"bc"} cannot share a
 * preimage through concatenation.
 */
function enc(value, path, seen) {
  if (value === null) return "n";
  const t = typeof value;

  if (t === "boolean") return "b:" + (value ? "1" : "0");

  if (t === "number") {
    if (!Number.isFinite(value))
      throw new CanonError("NON_FINITE", path, `${String(value)} cannot be represented; a hash preimage may not contain it. If a field is deliberately disabled, say so with null or a flag, not with a non-finite number.`);
    if (!Number.isInteger(value))
      throw new CanonError("NON_INTEGER", path, `${value} is not an integer. This schema has no fractional fields, and a float's decimal form is platform-dependent.`);
    if (!Number.isSafeInteger(value))
      throw new CanonError("UNSAFE_INTEGER", path, `${value} is past Number.MAX_SAFE_INTEGER, so two different written values already collapsed to one double before the hash saw them`);
    if (Object.is(value, -0)) return "i:0";
    return "i:" + String(value);
  }

  if (t === "string") {
    const s = value.normalize("NFC");
    return "s:" + s.length + ":" + s;
  }

  if (t === "bigint") throw new CanonError("BIGINT", path, "BigInt cannot be represented");
  if (t === "undefined") throw new CanonError("UNDEFINED", path, "undefined cannot be represented; an absent field is absent, a null field is null, and the two are different facts");
  if (t === "function" || t === "symbol") throw new CanonError("UNENCODABLE", path, `a ${t} cannot be represented`);

  if (t === "object") {
    if (seen.has(value)) throw new CanonError("CYCLE", path, "the value contains a cycle");
    seen.add(value);
    let out;
    if (Array.isArray(value)) {
      // map() SKIPS holes, so [ ,1] encoded as if the hole were not there while [undefined,1]
      // correctly threw. A total encoder does not have two answers for the same absence.
      const parts = [];
      for (let i = 0; i < value.length; i++) {
        if (!(i in value)) throw new CanonError("ARRAY_HOLE", `${path}[${i}]`, "the array has a hole; an absent element has no canonical form");
        parts.push(enc(value[i], `${path}[${i}]`, seen));
      }
      out = "a:" + parts.length + ":[" + parts.join(",") + "]";
    // eslint-disable-next-line no-empty
    } else {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null)
        throw new CanonError("EXOTIC_OBJECT", path, "only plain objects can be represented; a Date, Map, Set or class instance has no canonical form here");
      const keys = Object.keys(value).sort();
      const parts = keys.map((k) => {
        const nk = k.normalize("NFC");
        return "s:" + nk.length + ":" + nk + "=" + enc(value[k], path ? `${path}.${k}` : k, seen);
      });
      out = "m:" + parts.length + ":{" + parts.join(",") + "}";
    }
    seen.delete(value);
    return out;
  }

  throw new CanonError("UNENCODABLE", path, `a value of type ${t} cannot be represented`);
}

/** The full preimage text, version line included. */
export function preimage(value) {
  return PREIMAGE_VERSION + "\n" + enc(value, "", new Set());
}

export function sha256(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

/** Canonical hash of a facts object (or any plain value). */
export function canonicalHash(value) {
  return sha256(preimage(value));
}

/**
 * Hash of a rendered page.
 *
 * LINE ENDINGS ARE NORMALISED TO LF FIRST, and that is not a convenience -- it is the difference
 * between a working guard and one that cries wolf on an entire repository.
 *
 * The engine already normalises every INPUT it reads (`.split("\r\n").join("\n")` on templates
 * and on data files) and did not normalise the OUTPUT it hashed. arc's own repo hid that, because
 * `.gitattributes` pins `* text=auto eol=lf` here. The venture repo the generated CI guard ships
 * into has no such file, so on a Windows checkout with the default `core.autocrlf=true` every
 * `.mdx` arrives as CRLF and every page verified as TAMPERED -- on an untouched tree. A guard
 * that reports tampering on a clean checkout is worse than no guard: it is one people switch off.
 *
 * WHAT THIS TRANSFORM DESTROYS (the disclosure any normalising gate owes): a file that differs
 * from the approved one ONLY in line endings now verifies as INTACT. That is the intent -- git
 * rewrites line endings on checkout and nobody edited anything -- but it does mean the hash is a
 * hash of the page's TEXT rather than of its literal bytes on disk, and a page whose meaning
 * depended on CRLF (none do; these are markdown) would not be distinguished.
 */
export function bytesHash(text) {
  return sha256(String(text).split("\r\n").join("\n"));
}

/**
 * Hash of a template SET: every file's path and content, order-independent.
 * A page's rendered bytes carry this, so one template edit moves every page -- which is the
 * point (ADR-1005: a template fix is not done until each venture has re-approved).
 */
export function templateSetHash(files) {
  const rows = Object.keys(files)
    .sort()
    .map((p) => ({ path: p.split("\\").join("/"), sha: sha256(files[p]) }));
  return sha256(preimage(rows));
}
