/**
 * A TOTAL, type-tagged encoder for hash preimages (PLAN pre-mortem row 4).
 *
 * Why not JSON.stringify: it is not total. It folds `NaN` and `+/-Infinity` to `null`, drops
 * `undefined` from objects and turns it into `null` inside arrays, and throws only on cycles and
 * BigInt. This repo has already shipped that defect once -- `configHash` used JSON.stringify, so
 * a deliberately DISABLED effect floor (`-Infinity`) hashed identically to an unset one
 * (`undefined`), and two different states became one hash. `policy_hash` carries integrity for
 * the promotion chain (REQ-04), which is exactly where a silent collision does the most damage.
 *
 * So: this encoder REFUSES what it cannot represent rather than coercing it, and tags every
 * value with its type so `1` and `"1"` and `true` cannot collide either.
 */

import { createHash } from "node:crypto";

export class EncodeError extends Error {
  constructor(message) {
    super(message);
    this.name = "EncodeError";
    this.code = "BAD_PREIMAGE";
  }
}

/**
 * Deterministic, total encoding. Object keys are sorted, so two objects that differ only in
 * insertion order encode identically -- the same rule the spine's canonicalize() applies.
 */
export function encode(value, seen = new Set(), path = "$") {
  if (value === null) return "z:";
  const t = typeof value;

  if (t === "undefined") throw new EncodeError(`undefined at ${path} cannot be represented -- omit the key or use null`);
  if (t === "bigint") throw new EncodeError(`BigInt at ${path} cannot be represented`);
  if (t === "function" || t === "symbol") throw new EncodeError(`${t} at ${path} cannot be represented`);

  if (t === "boolean") return value ? "b:1" : "b:0";

  if (t === "number") {
    if (Number.isNaN(value)) throw new EncodeError(`NaN at ${path} cannot be represented -- it is not a value, it is a failure`);
    if (!Number.isFinite(value)) throw new EncodeError(`${value} at ${path} cannot be represented`);
    // Distinguish integers from decimals in the tag: a money amount that becomes 10 when it
    // was 10.0 is a different claim about minor units.
    return Number.isInteger(value) ? `i:${value}` : `f:${value}`;
  }

  if (t === "string") return `s:${value.length}:${value}`;

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new EncodeError(`cycle at ${path}`);
    seen.add(value);
    const out = `a:${value.length}:[${value.map((v, i) => encode(v, seen, `${path}[${i}]`)).join(",")}]`;
    seen.delete(value);
    return out;
  }

  if (t === "object") {
    if (seen.has(value)) throw new EncodeError(`cycle at ${path}`);
    seen.add(value);
    const keys = Object.keys(value).sort();
    const body = keys.map((k) => `${encode(k, seen, path)}=${encode(value[k], seen, `${path}.${k}`)}`).join(",");
    const out = `o:${keys.length}:{${body}}`;
    seen.delete(value);
    return out;
  }

  throw new EncodeError(`unrepresentable ${t} at ${path}`);
}

/** sha256 of the total encoding, lowercase hex. This is what `policy_hash` carries. */
export function preimageHash(value) {
  return createHash("sha256").update(encode(value), "utf8").digest("hex");
}

/**
 * The hash of a policy document. Derived from the parsed structure rather than the file bytes,
 * so a comment or a reflow does not change the identity of the grants -- but any change to a
 * grant does. Forward-only: never backfilled, never estimated (ADR-0068 spirit).
 */
export function policyHash(policy) {
  return preimageHash({
    version: policy.version,
    // The constitution pin and the level table are IN the preimage. Leaving them out meant a
    // file repinned to a different adopted Constitution, or one that redefined what L2 means,
    // hashed identically to the honest file -- and policy_hash is what every
    // policy.level.changed and spend.reserved carries to say which law the decision was made
    // under. Those are exactly the material differences it must not hide.
    constitution: policy.constitution,
    levels: policy.levels,
    ungrantable_actions: policy.ungrantable_actions,
    ungrantable_resources: policy.ungrantable_resources,
    targets: policy.targets,
    argv0_classes: policy.argv0_classes,
    kinds: policy.kinds,
  });
}
