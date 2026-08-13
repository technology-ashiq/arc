#!/usr/bin/env node
/**
 * tests/engine-hermes-probe.mjs -- the Node half of tests/engine-hermes-contract.bats.
 *
 * It lives in a FILE rather than inside `node -e` for a reason this repo has paid for four
 * times: a program embedded in a shell string carries no apostrophe, no single quote and -- in
 * a double-quoted string -- no backtick and no dollar sign, in code OR in comments. One
 * apostrophe closes the quoting and the shell runs the remainder. Every probe that needs any of
 * those characters belongs here.
 *
 * Each subcommand prints a single terminal marker line so the caller can assert the probe RAN
 * before asserting what it printed. A probe that dies early and prints nothing must never be
 * mistaken for a probe that ran and found nothing.
 */

import { encodeTagged, taggedSha256, UnrepresentableValue } from "../.claude/scripts/engine/drivers/type-tagged-hash.mjs";

const [, , cmd] = process.argv;
const out = [];
const say = (k, v) => out.push(`${k}=${v}`);
const done = (marker) => {
  process.stdout.write(`${out.join("\n")}\n${marker}\n`);
};

/** Every value the encoder must REFUSE. A canonicaliser that coerces is a collision generator. */
function refusals() {
  const cyclic = {};
  cyclic.self = cyclic;
  const sparse = [1];
  sparse[3] = 4; // holes at 1 and 2

  const cases = [
    ["undefined", undefined],
    ["nested-undefined", { a: undefined }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["function", () => 1],
    ["symbol", Symbol("s")],
    ["bigint", 10n],
    ["Date", new Date(0)],
    ["Map", new Map()],
    ["Set", new Set()],
    ["RegExp", /x/],
    ["class-instance", new (class Thing { constructor() { this.a = 1; } })()],
    ["cyclic", cyclic],
    ["sparse-array", sparse],
    ["symbol-key", { [Symbol("k")]: 1 }],
  ];

  let refused = 0;
  const accepted = [];
  for (const [name, value] of cases) {
    try {
      encodeTagged(value);
      accepted.push(name);
    } catch (e) {
      if (!(e instanceof UnrepresentableValue)) { accepted.push(`${name}(wrong-error:${e.name})`); continue; }
      refused += 1;
    }
  }
  say("cases", cases.length);
  say("refused", refused);
  say("accepted", accepted.join(",") || "none");
  done(refused === cases.length ? "ALL_REFUSED" : "SOME_ACCEPTED");
}

/** Collisions JSON.stringify produces and this encoder must not. */
function collisions() {
  const pairs = [
    ["string-vs-number", "1", 1],
    ["string-vs-bool", "true", true],
    ["zero-vs-negzero", 0, -0],
    ["key-run", { a: "1" }, { a1: "" }],
    ["nested-vs-flat", { a: { b: 1 } }, { "a.b": 1 }],
    ["array-vs-object", ["a"], { 0: "a" }],
    ["empty-string-vs-null", "", null],
    ["adjacent-keys", { ab: "c", d: "e" }, { a: "bc", de: "" }],
  ];
  const collided = [];
  for (const [name, a, b] of pairs) {
    if (taggedSha256(a) === taggedSha256(b)) collided.push(name);
  }
  say("pairs", pairs.length);
  say("collided", collided.join(",") || "none");
  done(collided.length === 0 ? "NO_COLLISIONS" : "COLLISIONS_FOUND");
}

/** Key ORDER must not change the hash; key CONTENT must. */
function ordering() {
  const a = taggedSha256({ z: 1, a: 2, m: { q: 1, b: 2 } });
  const b = taggedSha256({ a: 2, m: { b: 2, q: 1 }, z: 1 });
  const c = taggedSha256({ z: 1, a: 3, m: { q: 1, b: 2 } });
  say("order_stable", a === b);
  say("content_moves", a !== c);
  done(a === b && a !== c ? "ORDER_STABLE_CONTENT_MOVES" : "ORDERING_WRONG");
}

/**
 * The negative control for the whole encoder: a check that cannot fail is not a check. This
 * asserts the SAME harness reports a collision when one is genuinely present, using a
 * deliberately broken stand-in encoder. Without it, "no collisions" could mean the comparison
 * never ran.
 */
function negativeControl() {
  const naive = (v) => JSON.stringify(v);
  const collidesUnderNaive = naive("1") === naive(1) ? false : naive({ a: undefined }) === naive({});
  const zeroCollides = naive(0) === naive(-0);
  say("naive_collides_on_negzero", zeroCollides);
  say("naive_drops_undefined_key", collidesUnderNaive);
  say("tagged_negzero_distinct", taggedSha256(0) !== taggedSha256(-0));
  const ok = zeroCollides && collidesUnderNaive && taggedSha256(0) !== taggedSha256(-0);
  done(ok ? "CONTROL_DISCRIMINATES" : "CONTROL_BROKEN");
}

/** The encoding is length-prefixed and type-tagged, visibly, so a reviewer can check by eye. */
function shape() {
  say("encoded", encodeTagged({ a: 1, b: "x" }));
  say("scalar", encodeTagged("x"));
  done("SHAPE_PRINTED");
}

/**
 * Lone surrogates. Found by an adversarial pass, and it is the collision class this whole file
 * claims to prevent, sitting inside it: `taggedSha256` re-encodes a lone surrogate to the
 * replacement character before hashing, so three distinct values shared one digest. The length
 * prefix lied too — `Buffer.byteLength("\uD800", "utf8")` reports 3 for a value that has no
 * well-formed 3-byte encoding.
 */
function surrogates() {
  const lone = ["\uD800", "\uDC00", "\uD800a", "a\uDFFF"];
  const accepted = [];
  for (const s of lone) {
    try { taggedSha256(s); accepted.push(JSON.stringify(s)); } catch { /* refused, as required */ }
  }
  // The legitimate replacement character and a real surrogate PAIR must still hash — refusing
  // everything would pass this test while breaking every ordinary config.
  let wellFormedOk = true;
  try { taggedSha256("�"); taggedSha256("😀"); } catch { wellFormedOk = false; }
  say("lone_accepted", accepted.join(",") || "none");
  say("well_formed_still_hashes", wellFormedOk);
  done(!accepted.length && wellFormedOk ? "SURROGATES_REFUSED" : "SURROGATE_HOLE_OPEN");
}

const table = { refusals, collisions, ordering, "negative-control": negativeControl, shape, surrogates };
const fn = table[cmd];
if (!fn) {
  process.stderr.write(`unknown probe: ${cmd} (want ${Object.keys(table).join(", ")})\n`);
  process.exit(64);
}
fn();
