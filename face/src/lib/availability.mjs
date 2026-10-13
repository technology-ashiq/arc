// availability.mjs -- the five states a field the face draws can be in (face v2 Phase 15, REQ-19, ADR-1354).
//
// ADR-1324's NOT SERVED was one word for four truths, so the owner could not tell a source that was read and held
// nothing from a source that was never reached. A field is now exactly one of five states, and every state but
// `served` names where it would come from and which lane owns that source:
//   served            the source was read and the field carries what it held
//   zero              the source was read and held no record: drawn as 0, with where the 0 came from
//   unknown           the source could not be read or failed: never 0, never blank, and the failure class said
//   not-applicable    declared by the fold for a field that has no meaning here -- never inferred from a failure
//   not-instrumented  arc knows the kind or adapter does not exist yet: the gap is named and owned, not filled
// This file imports nothing, so registry.mjs, served.mjs and every fold can import it without a cycle, and the
// state strings live here alone: a fold that spells one itself is refused by face-pure's availability arm.

/** @typedef {"served" | "zero" | "unknown" | "not-applicable" | "not-instrumented"} AvailabilityState */

export const Availability = Object.freeze({
  SERVED: /** @type {"served"} */ ("served"),
  ZERO: /** @type {"zero"} */ ("zero"),
  UNKNOWN: /** @type {"unknown"} */ ("unknown"),
  NOT_APPLICABLE: /** @type {"not-applicable"} */ ("not-applicable"),
  NOT_INSTRUMENTED: /** @type {"not-instrumented"} */ ("not-instrumented"),
});

/** @type {readonly AvailabilityState[]} */
export const STATES = Object.freeze(Object.values(Availability));

/** The failure class of a read that has not answered yet: not known, so never drawn as 0. */
export const PENDING = "PENDING";

/**
 * @typedef {object} AvailabilityField
 * @property {true} isAvailability
 * @property {AvailabilityState} availability
 * @property {string} source      where the field is (or would be) read from
 * @property {string} owner_lane  the lane that owns that source
 * @property {string} as_of       when the source was read, or "" when nothing says
 * @property {string} failure     the failure class of an `unknown`, "" for every other state
 */

/** @param {unknown} v */
const text = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Is this one of the five states? A state string from anywhere else -- a door body, a typo -- is not.
 * @param {unknown} s
 * @returns {s is AvailabilityState}
 */
export function isState(s) {
  return typeof s === "string" && /** @type {readonly string[]} */ (STATES).includes(s);
}

/**
 * The availability half of a field. An unknown state is a programming error and throws: drawing it as any of the
 * five would be the guess this file exists to stop. An `unknown` with no failure class says UNSTATED rather than
 * nothing, so the screen never shows a failure without a class.
 * @param {{ availability: unknown, source?: unknown, owner_lane?: unknown, as_of?: unknown, failure?: unknown }} f
 * @returns {AvailabilityField}
 */
export function availabilityField(f) {
  if (!isState(f.availability)) throw new TypeError(`availability: "${String(f.availability)}" is not one of ${STATES.join(", ")}`);
  const failure = f.availability === Availability.UNKNOWN ? text(f.failure) || "UNSTATED" : "";
  return {
    isAvailability: true,
    availability: f.availability,
    source: text(f.source),
    owner_lane: text(f.owner_lane),
    as_of: text(f.as_of),
    failure,
  };
}

/**
 * The state of a panel over one read, from what the read did: in flight is `unknown` (PENDING) -- not yet known is
 * not zero; refused is `unknown` with the refusal's code as its class; answered with no row is `zero`; answered with
 * rows is `served`. The one mapping every served panel goes through, so no fold maps a failure itself.
 * @param {{ isReading: boolean, isRefused: boolean, refusal: { code: string }, isDrawn: boolean, rows: unknown[] }} t
 * @returns {{ availability: AvailabilityState, failure: string }}
 */
export function stateOfTable(t) {
  if (t.isReading) return { availability: Availability.UNKNOWN, failure: PENDING };
  if (t.isRefused || !t.isDrawn) return { availability: Availability.UNKNOWN, failure: text(t.refusal.code) || "UNSTATED" };
  return t.rows.length === 0 ? { availability: Availability.ZERO, failure: "" } : { availability: Availability.SERVED, failure: "" };
}

/**
 * An adapter's answer as a state (the Phase 15 throw fixture's contract). A field the fold DECLARED not-applicable
 * stays not-applicable whatever the adapter does -- a throw does not make it applicable. Otherwise a throw is
 * `unknown` with the error's code (or its name) as the class, an answer of nothing at all is `unknown` NO_ANSWER,
 * and only a read that answered with 0 or an empty list is `zero`.
 * @param {AvailabilityState | null} declared  `not-applicable` or `not-instrumented` when the fold declares it, else null
 * @param {() => unknown} read
 * @returns {{ availability: AvailabilityState, failure: string, value: unknown }}
 */
export function stateOfAdapter(declared, read) {
  if (declared === Availability.NOT_APPLICABLE || declared === Availability.NOT_INSTRUMENTED) return { availability: declared, failure: "", value: undefined };
  /** @type {unknown} */
  let value;
  try {
    value = read();
  } catch (err) {
    const e = /** @type {{ code?: unknown, name?: unknown }} */ (err !== null && typeof err === "object" ? err : {});
    return { availability: Availability.UNKNOWN, failure: text(e.code) || text(e.name) || "THREW", value: undefined };
  }
  if (value === undefined || value === null || (typeof value === "number" && !Number.isFinite(value))) return { availability: Availability.UNKNOWN, failure: "NO_ANSWER", value: undefined };
  const empty = value === 0 || (Array.isArray(value) && value.length === 0);
  return { availability: empty ? Availability.ZERO : Availability.SERVED, failure: "", value };
}

/**
 * The header's two counts over a fold's fields: how many are `unknown` and how many `not-instrumented`. Zero of
 * either draws nothing; the header never shows a default in place of a count it could not take.
 * @param {readonly { availability: AvailabilityState }[]} fields
 * @returns {{ unknown: number, notInstrumented: number }}
 */
export function availabilityCounts(fields) {
  let unknown = 0;
  let notInstrumented = 0;
  for (const f of fields) {
    if (f.availability === Availability.UNKNOWN) unknown += 1;
    else if (f.availability === Availability.NOT_INSTRUMENTED) notInstrumented += 1;
  }
  return { unknown, notInstrumented };
}
