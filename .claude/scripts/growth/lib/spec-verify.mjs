// growth/spec-verify -- REQ-05(a), ADR-1109. The ADR-0408 spec-verify, as an EXECUTABLE GATE.
//
// A verify that is only ever run by hand once is a claim, not a gate. This one re-runs, and its
// expected output is exactly ADR-1109's four enumerated findings. A NEW finding appearing, or a
// KNOWN one disappearing, BLOCKS THE PHASE -- both directions matter: a disappearing finding means
// the other lane fixed its validator and growth's conformance decision needs re-reading, and a new
// one means the shared organ moved under us.
//
// IT PROBES BEHAVIOUR, NEVER SOURCE TEXT. Every finding below is produced by handing the LIVE
// validator a payload and recording what it did. Scraping regexes out of `validate-leads.mjs` with
// a pattern would re-break the moment that file is reformatted, and would report a deviation that
// no longer exists -- a gate whose subject is the source's LAYOUT rather than its BEHAVIOUR.
//
// `validate-leads.mjs` belongs to the leads lane and growth only reads it. ADR-0308's warning
// applies -- the shared spec should live in evolve or hq and be consumed rather than
// re-implemented per client, and growth is the second client reading a leads file. Moving it is
// recorded as debt with a trigger (the third client), not done here.

export class SpecVerifyError extends Error {
  constructor(code, message) { super(message); this.name = "SpecVerifyError"; this.code = code; }
}

// The four findings ADR-1109 enumerated. This list is the EXPECTED OUTPUT of the gate, and the
// gate fails on any difference in either direction.
export const EXPECTED_FINDINGS = Object.freeze(["D1", "D2", "D3", "D4"]);

const IST = "+05:30";
const okTs = (d, t) => `${d}T${t}${IST}`;

/** A conforming `metric.observed` payload, encoded the way ADR-1109 decided growth will encode. */
export function conformingPayload() {
  return {
    module: "growth",
    surface: "title-template",
    metric: "clicks",
    // ADR-1108: the seven Pacific days of the week, converted to their IST instants, half-open.
    window_start: okTs("2026-08-31", "12:30:00"),
    window_end: okTs("2026-09-07", "12:30:00"),
    value: 12,
    // `unit_count` is required and was missing from the first draft of this payload. The CONTROL
    // caught it -- the gate refused to report at all rather than emitting four findings that would
    // each have been "refused" for the wrong reason. That is what the control is for, and it fired
    // on its author within a minute of being written.
    unit_count: 12,
    source_id: "gsc-export",
  };
}

/**
 * Run the four probes against the LIVE validator.
 *
 * `validator` is the module (injected, so a test can run this against a stub and prove the gate
 * itself is not vacuous). Each probe records whether the live code REFUSED the spec's own encoding.
 */
export function runSpecVerify(validator, { kind = "metric.observed" } = {}) {
  if (!validator || typeof validator.assertLeads !== "function")
    throw new SpecVerifyError("BAD_VALIDATOR", "spec-verify needs the live leads validator module");

  const attempt = (payload) => {
    try {
      validator.assertLeads({ kind, payload });
      return { refused: false, code: null };
    } catch (e) {
      return { refused: true, code: e.code || e.name || "THREW" };
    }
  };

  const findings = [];
  const base = conformingPayload();

  // CONTROL FIRST. If the conforming payload does not validate, every probe below is meaningless --
  // a refusal would prove nothing about the field under test. This is the positive control that
  // stops the whole gate from passing vacuously.
  const control = attempt(base);
  if (control.refused)
    throw new SpecVerifyError("CONTROL_FAILED",
      `the conforming payload ADR-1109 decided on is itself refused (${control.code}) -- every probe below would be meaningless, so the gate refuses to report at all`);

  // D1 -- the window fields are timestamps in code and ISO-week strings in the frozen spec.
  const d1 = attempt({ ...base, window_start: "2026-W36", window_end: "2026-W37" });
  if (d1.refused) findings.push({ id: "D1", code: d1.code, what: "an ISO-week string in window_start is refused; the frozen spec's own example uses one" });

  // D2 -- a one-week window has EQUAL bounds in the spec and is refused by the code.
  const d2 = attempt({ ...base, window_end: base.window_start });
  if (d2.refused) findings.push({ id: "D2", code: d2.code, what: "equal window bounds are refused; the spec's example sets both to the same ISO week" });

  // D3 -- the named first surface is not a legal dimension value.
  const d3 = attempt({ ...base, surface: "growth.title-template" });
  if (d3.refused) findings.push({ id: "D3", code: d3.code, what: "the dotted surface named in PLAN-evolve and PLAN-growth is refused; DIMENSION_RE has no dot" });

  // D4 -- the literal `-` belongs to the idem preimage, and a payload that WRITES it is refused.
  const d4 = attempt({ ...base, variant: "-", cohort: "-" });
  if (d4.refused) findings.push({ id: "D4", code: d4.code, what: "a payload writing the literal - for an absent optional is refused; the literal is a preimage rendering, so absent optionals are omitted entirely" });

  // The sanctioned ADR-0408 `lead_hmac_v1_` widening is NOT re-flagged: it is on the record as
  // deliberate, and a diff that flags it is over-reporting. Probed anyway, so that a REGRESSION --
  // the widening being removed by the owning lane -- would surface as a new finding rather than
  // as silence.
  const widened = attempt({ ...base, source_id: "lead_hmac_v1_" + "a".repeat(32) });
  if (widened.refused)
    findings.push({ id: "D5-NEW", code: widened.code, what: "the ADR-0408-sanctioned lead_hmac_v1_ widening no longer validates -- the owning lane narrowed it" });

  return { findings, controlPassed: true };
}

/**
 * THE EMITTER SURFACE (ADR-1117). A separate probe, deliberately not folded into D1-D4.
 *
 * D1-D4 diff the payload GRAMMAR against the frozen spec. This one asks a different question of a
 * different file: can a CORRECTION land at all? The idem preimage excludes `value` -- correctly,
 * because it identifies which measurement this is rather than what it said -- so two reads of one
 * week hash identically, and the emitter derives the leads key WITHOUT `supersedes` while passing
 * `supersedes` for the experiment family two lines away. A metric correction therefore collided on
 * DUP_IDEM and was silently dropped.
 *
 * Returns whether the collision still exists. When it stops existing, the emitter has been fixed
 * and ADR-1117's revision suffix can go -- which is exactly what its revisit trigger names, and
 * why this is probed rather than remembered.
 */
export function probeCorrectionCollision(validator) {
  if (!validator || typeof validator.leadsIdem !== "function")
    throw new SpecVerifyError("BAD_VALIDATOR", "the correction probe needs leadsIdem from the live validator");
  const base = conformingPayload();
  const original = validator.leadsIdem("metric.observed", base);
  const corrected = validator.leadsIdem("metric.observed", { ...base, value: base.value + 7, unit_count: base.unit_count + 7 });
  const revisioned = validator.leadsIdem("metric.observed", { ...base, value: base.value + 7, unit_count: base.unit_count + 7, source_id: base.source_id + "-r2" });
  return {
    collides: original === corrected,
    revisionEscapes: original !== revisioned,
    note: original === corrected
      ? "a correction still collides on DUP_IDEM; ADR-1117's revisioned source_id is required"
      : "the emitter now distinguishes corrections -- ADR-1117's revisit trigger has fired and the revision suffix can be retired",
  };
}

/**
 * The gate. Returns the verdict; the caller decides the exit code.
 *
 * BOTH DIRECTIONS BLOCK. A missing finding is not good news -- it means the shared organ changed
 * and growth's conformance decision was made against a validator that no longer exists.
 */
export function verdict(result) {
  const got = result.findings.map((f) => f.id).sort();
  const want = [...EXPECTED_FINDINGS].sort();
  const missing = want.filter((id) => !got.includes(id));
  const unexpected = got.filter((id) => !want.includes(id));
  return {
    pass: missing.length === 0 && unexpected.length === 0,
    got,
    expected: want,
    missing,
    unexpected,
    reason: missing.length === 0 && unexpected.length === 0
      ? "the live validator deviates from the frozen spec in exactly the four ways ADR-1109 recorded"
      : [
        missing.length ? `MISSING ${missing.join(",")} -- a known deviation is gone, so the validator moved and ADR-1109's conformance decision must be re-read` : "",
        unexpected.length ? `NEW ${unexpected.join(",")} -- a deviation nobody has adjudicated` : "",
      ].filter(Boolean).join(" | "),
  };
}

/** Render for a human. */
export function renderSpecVerify(result, v) {
  const lines = [`spec-verify (ADR-0408 vs PLAN-evolve REQ-00) -- ${v.pass ? "PASS" : "BLOCKED"}`, "", v.reason, ""];
  for (const f of result.findings) lines.push(`  ${f.id} [${f.code}] ${f.what}`);
  return lines.join("\n");
}
