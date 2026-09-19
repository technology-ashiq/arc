#!/usr/bin/env node
// newcombe-exact.mjs -- the reference vectors' INDEPENDENT derivation, in exact fixed-point arithmetic.
//
// It shares no code with .claude/scripts/evolve/verdict.mjs and uses no floating point between the inputs and the
// final rounding: every quantity is a BigInt scaled by 10^120, and each square root is an integer square root. The
// result is rounded to the nearest double once, by parsing a 60-digit decimal.
//
// Why it exists: the vectors were first derived twice by two agents that saw no implementation, and BOTH paired
// Newcombe's terms for p1 - p2 while the test is on d = p2 - p1. Their lower bound was too high on every case with
// unequal arms. Two derivations that share a misreading agree with each other and with the code. This one is anchored
// on Newcombe (1998)'s own worked example, which it reproduces (56/70 vs 48/80 at z 1.96: 0.0524 to 0.3339), and that
// anchor runs first.
//
//   node tests/fixtures/evolve/newcombe-exact.mjs   prints each case's exact lower and upper as doubles, as JSON

const DIGITS = 120n;
const S = 10n ** DIGITS;

/** A double, as its exact value scaled by S (truncated at 10^-120). */
function fromDouble(x) {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const bits = buf.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const exp = Number((bits >> 52n) & 0x7ffn);
  let mant = bits & ((1n << 52n) - 1n);
  if (exp === 0) throw new Error("subnormal z is not a z");
  mant |= 1n << 52n;
  const e = exp - 1075; // value = mant * 2^e
  return sign * (e >= 0 ? mant * S * (1n << BigInt(e)) : (mant * S) / (1n << BigInt(-e)));
}

const mul = (a, b) => (a * b) / S;
const div = (a, b) => (a * S) / b;
function isqrt(n) {
  if (n < 0n) throw new Error("sqrt of a negative");
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n)))) || 1n;
  // Newton from a float seed, then settle to the floor exactly.
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x - 1n && y <= x + 1n) { x = y; break; }
    x = y;
  }
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}
const sqrt = (a) => isqrt(a * S);
const clamp01 = (v) => (v < 0n ? 0n : v > S ? S : v);

/** The fixed-point value, as the nearest double. */
function toDouble(v) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const int = a / S;
  const frac = (a % S).toString().padStart(Number(DIGITS), "0");
  return Number(`${neg ? "-" : ""}${int}.${frac}`);
}

/** Wilson's interval, from its definition, in exact arithmetic. */
function wilsonExact(x, n, z) {
  const N = BigInt(n);
  const p = (BigInt(x) * S) / N;
  const z2 = mul(z, z);
  const den = 2n * (N * S + z2);
  const centre = div(2n * N * p + z2, den);
  const inner = z2 + mul(4n * N * p, S - p);
  const halfw = div(mul(z, sqrt(inner)), den);
  return { p, l: clamp01(centre - halfw), u: clamp01(centre + halfw) };
}

/** Newcombe's method 10 for d = p2 - p1. */
export function newcombeExact(x1, n1, x2, n2, zDouble) {
  const z = fromDouble(zDouble);
  const a1 = wilsonExact(x1, n1, z);
  const a2 = wilsonExact(x2, n2, z);
  const d = a2.p - a1.p;
  const sq = (v) => mul(v, v);
  const lower = d - sqrt(sq(a2.p - a2.l) + sq(a1.u - a1.p));
  const upper = d + sqrt(sq(a2.u - a2.p) + sq(a1.p - a1.l));
  return { d: toDouble(d), lower: toDouble(lower), upper: toDouble(upper) };
}

// The anchor, before anything is printed: Newcombe (1998), Statistics in Medicine 17:873-890, Table II example (a),
// 56/70 vs 48/80 at the two-sided 95% z. theta = p1 - p2 there, so the groups are passed swapped here.
{
  const r = newcombeExact(48, 80, 56, 70, 1.959963984540054);
  if (r.lower.toFixed(4) !== "0.0524" || r.upper.toFixed(4) !== "0.3339")
    throw new Error(`the exact derivation does not reproduce Newcombe's published example: ${r.lower} ${r.upper}`);
}

// Run only as the CLI, with both sides realpathed (the node main-guard rule: argv[1] beside import.meta.url silently
// no-ops behind a symlink).
const { readFileSync, realpathSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const isMain = (() => { try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const V = JSON.parse(readFileSync(fileURLToPath(new URL("./newcombe-wilson-difference-v1.json", import.meta.url)), "utf8"));
  const out = V.cases.map((c) => ({ id: c.id, ...newcombeExact(c.x1, c.n1, c.x2, c.n2, V.z) }));
  process.stdout.write(JSON.stringify(out, null, 1) + "\n");
}
