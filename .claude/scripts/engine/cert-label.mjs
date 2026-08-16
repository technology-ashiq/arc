#!/usr/bin/env node
/**
 * cert-label.mjs -- decides whether an isolation-suite run is a CERTIFICATION or a REGRESSION
 * (Phase 06, REQ-02).
 *
 * THE RULE THIS EXISTS FOR: "A mock-green run is labelled regression, never certification, and
 * the label is asserted by a test rather than written by hand -- a mock-green run must be
 * STRUCTURALLY INCAPABLE of producing a certification label."
 *
 * Structurally incapable is a strong claim and it constrains the design completely:
 *
 *   1. THERE IS NO LABEL INPUT. Nothing a caller passes can say `certification`. The label is a
 *      pure function of facts that only a real run can produce. A parameter would make the whole
 *      thing an honour system, and the previous cycle closed with its central claim unproven
 *      precisely because a label had been written by a human who believed it.
 *
 *   2. A FACTS OBJECT CARRYING A LABEL-SHAPED KEY IS REFUSED OUTRIGHT, not ignored. Ignoring it
 *      would let a caller believe it had asserted something; refusing says so. This is the
 *      difference between a check and a formality.
 *
 *   3. EVERY REQUIREMENT IS A SEPARATE NAMED REASON. "Not certification" is useless to an
 *      operator; "not certification because the image is not digest-pinned" is actionable, and
 *      the list is what the evidence bundle records.
 *
 * WHAT MAKES A RUN REAL, and why each one is here rather than being obvious:
 *
 *   driver === "hermes"        the mock driver reaches no provider and costs nothing. It is a
 *                              regression instrument; the moment it is asked to stand in for the
 *                              real runtime it has become the 2026-08-03 defect again.
 *   a digest-pinned image      a tag can be repushed. Phase 04 measured `:latest` moving to a
 *                              different build on the same day the pinned digest stood still, so
 *                              a tag proves nothing about WHICH runtime answered.
 *   the pinned digest MATCHES  a digest-shaped string is not the vetted artifact. It has to be
 *                              the one the lock records.
 *   a docker server version    reported by the daemon, not by us. A container-backed run with no
 *                              daemon behind it did not happen.
 *   at least one fixture ran   a suite that executed nothing is indistinguishable from a suite
 *                              that passed, which is this repository's most-repeated failure.
 *
 * Note what is NOT required: that the fixtures PASSED. A certification run that fails is still a
 * certification run, and recording a failed certification as a regression would hide exactly the
 * result the phase exists to surface.
 */

/** Keys a caller might use to try to assert the outcome. Refused, never ignored. */
const ASSERTION_KEYS = ["label", "certification", "certified", "isCertification", "verdict"];

export class LabelAsserted extends Error {
  constructor(key) {
    super(`the facts carry \`${key}\`: the label is DERIVED and cannot be asserted`);
    this.name = "LabelAsserted";
    this.key = key;
  }
}

/**
 * @param {object} facts
 * @param {string} facts.driver                 the driver arc-run actually dispatched through
 * @param {string} facts.image                  the image reference actually run
 * @param {string} facts.lockedDigest           the digest capability-lock.json records
 * @param {string} facts.dockerServerVersion    what `docker info` reported, or empty
 * @param {number} facts.fixturesRun            how many of the twelve actually executed
 * @returns {{label: "certification"|"regression", reasons: string[]}}
 */
export function certificationLabel(facts) {
  const f = facts || {};
  for (const k of ASSERTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(f, k)) throw new LabelAsserted(k);
  }

  const reasons = [];
  const str = (v) => (typeof v === "string" ? v : "");

  if (str(f.driver) !== "hermes") {
    reasons.push(`the driver was ${JSON.stringify(f.driver ?? null)}, not the real runtime`);
  }

  const image = str(f.image);
  const digest = image.match(/@(sha256:[0-9a-f]{64})$/);
  if (!digest) {
    reasons.push(`the image ${JSON.stringify(image || null)} is not pinned by digest`);
  } else if (digest[1] !== str(f.lockedDigest)) {
    // Named without printing both in full: the point is that they differ, and a message that
    // repeats an attacker-supplied 64-character string is a message nobody reads.
    reasons.push("the image digest is not the one capability-lock.json records");
  }

  if (!str(f.dockerServerVersion)) {
    reasons.push("no docker server version was reported, so no container-backed run happened");
  }

  const ran = Number(f.fixturesRun);
  if (!Number.isFinite(ran) || ran < 1) {
    reasons.push("no fixture executed — a suite that runs nothing cannot certify anything");
  }

  return { label: reasons.length ? "regression" : "certification", reasons };
}

// CLI: read a facts JSON on argv and print the label plus its reasons. Exit 0 always -- this
// reports a classification, and turning a regression into a non-zero exit would make callers
// suppress it.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const raw = process.argv[2];
  if (!raw) {
    process.stderr.write("usage: cert-label.mjs <facts-json>\n");
    process.exit(2);
  }
  let out;
  try {
    out = certificationLabel(JSON.parse(raw));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
  process.stdout.write(`${out.label}\n`);
  for (const r of out.reasons) process.stdout.write(`  because ${r}\n`);
}
