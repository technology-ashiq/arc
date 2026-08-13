// money.mjs — integer minor units, and the one place a currency conversion happens (ADR-1012 / LED-M).
//
// Every monetary value in this lane is an INTEGER count of the currency's minor unit: paise for
// INR, cents for USD. Nothing here ever produces or consumes a float for money. That is not
// fastidiousness -- `arc pnl` must be byte-identical across two reader engines and across a
// derived-state rebuild, and a sum whose result depends on accumulation order is not
// byte-reproducible. IEEE-754 addition is not associative; integer addition is.
//
// The conversion below is the only arithmetic in the lane that is not plain integer addition, and
// it is done in BigInt on purpose. A rate like "83.20" scaled to an integer is up to 1e17, and a
// payment in minor units is up to 1e12; their product is ~1e29, which is far past
// Number.MAX_SAFE_INTEGER. Doing it in Number would silently lose low-order digits on large
// settlements -- the exact "looks right, is wrong" failure that kills trust in a P&L permanently.

import { SpineError } from "../canonical.mjs";

// Minor-unit exponents. INR and USD are both 2, which is why v1 scopes to INR + USD (ADR-1013):
// a currency with a different exponent (JPY 0, KWD 3) needs its own fixtures before it renders,
// and this table is where that decision becomes visible rather than assumed.
const MINOR_EXPONENT = Object.freeze({ INR: 2, USD: 2 });

export function minorExponent(currency) {
  const e = MINOR_EXPONENT[currency];
  if (e === undefined)
    throw new SpineError("BAD_LEDGER_CURRENCY", `currency ${JSON.stringify(currency)} has no pinned minor-unit exponent -- v1 is INR plus USD (ADR-1013), and a third currency needs its own fixtures before it can render`);
  return e;
}

export function isSupportedCurrency(currency) {
  return Object.prototype.hasOwnProperty.call(MINOR_EXPONENT, currency);
}

// A decimal string ("83.20") to a scaled BigInt plus its scale. The string is the receipt of what
// the provider actually said, so it is parsed by its own spelling and never by a float round-trip:
// Number("83.20") is not 83.20, and any rate that went through it could not be re-rendered as the
// value that was recorded.
export function parseRateString(rate) {
  if (typeof rate !== "string" || !/^(0|[1-9]\d{0,8})\.\d{1,8}$/.test(rate))
    throw new SpineError("BAD_LEDGER_FX", `fx.rate ${JSON.stringify(rate)} must be a decimal string like "83.20"`);
  const dot = rate.indexOf(".");
  const whole = rate.slice(0, dot);
  const frac = rate.slice(dot + 1);
  return { scaled: BigInt(whole + frac), scale: 10n ** BigInt(frac.length) };
}

// Convert `amount` minor units of `from` into minor units of `to`, at `rate` (units of `to` per
// ONE whole unit of `from` -- the way a human quotes it, and the way a provider settlement states
// it). Rounding is HALF-UP at the target's minor unit, pinned here so a total cannot drift with an
// implementation detail; the fixture for it is the contract, not this comment.
export function convertMinorUnits({ amount, from, to, rate }) {
  if (!Number.isSafeInteger(amount))
    throw new SpineError("BAD_LEDGER_MONEY", `amount ${JSON.stringify(amount)} must be an integer count of minor units`);
  if (from === to) return amount;
  const { scaled, scale } = parseRateString(rate);
  const fromExp = BigInt(minorExponent(from));
  const toExp = BigInt(minorExponent(to));

  // amount_to_minor = amount_from_minor * rate * 10^(toExp - fromExp)
  // Kept as one exact rational (num / den) so there is exactly ONE rounding step. Rounding twice
  // -- once for the rate, once for the exponent shift -- is how a converted total drifts by a
  // minor unit per row and by a visible sum per month.
  const sign = amount < 0 ? -1n : 1n;
  let num = BigInt(Math.abs(amount)) * scaled;
  let den = scale;
  if (toExp >= fromExp) num *= 10n ** (toExp - fromExp);
  else den *= 10n ** (fromExp - toExp);

  // Half-up on the magnitude, then re-apply the sign, so -0.5 and +0.5 round to the same
  // magnitude. Rounding half-up on a signed value instead would make a refund and its charge
  // round in opposite directions, which is precisely how an over-refund flag fires on nothing.
  const rounded = (num * 2n + den) / (den * 2n);
  const out = sign * rounded;
  if (out > BigInt(Number.MAX_SAFE_INTEGER) || out < BigInt(Number.MIN_SAFE_INTEGER))
    throw new SpineError("BAD_LEDGER_MONEY", `converted amount ${out} is beyond safe-integer range`);
  return Number(out);
}

// Render minor units as a human string. Never used in arithmetic -- formatting is the last step,
// and nothing downstream ever parses this back.
export function formatMinorUnits(amount, currency) {
  const exp = minorExponent(currency);
  const neg = amount < 0;
  const digits = String(Math.abs(amount)).padStart(exp + 1, "0");
  const whole = digits.slice(0, digits.length - exp);
  const frac = exp === 0 ? "" : "." + digits.slice(digits.length - exp);
  // Indian grouping for INR (2,2,3 from the right), plain thousands elsewhere. A P&L its owner
  // reads at a glance in the wrong grouping is a P&L read wrong.
  const grouped = currency === "INR" ? groupIndian(whole) : groupThousands(whole);
  return `${neg ? "-" : ""}${grouped}${frac}`;
}

function groupThousands(s) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function groupIndian(s) {
  if (s.length <= 3) return s;
  const head = s.slice(0, s.length - 3);
  const tail = s.slice(s.length - 3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail;
}

// ABSENT IS NOT ZERO (MP-F, inherited). A component that was never recorded renders as an em-dash
// and is never summed. Returning 0 here would make an unknown fee indistinguishable from a waived
// one, and both indistinguishable from a fee nobody looked up.
export const ABSENT = "—";

export function renderComponent(value, currency) {
  return value === undefined || value === null ? ABSENT : formatMinorUnits(value, currency);
}
