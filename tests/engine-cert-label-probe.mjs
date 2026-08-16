#!/usr/bin/env node
/**
 * tests/engine-cert-label-probe.mjs -- the Node half of tests/engine-cert-label.bats.
 *
 * In a file rather than inside `node -e` because the cases carry apostrophes and quotes, and a
 * program embedded in a shell string carries neither. That rule has been broken five times in
 * this repository; tests/embedded-program-guard.bats now enforces it, and this file is written
 * the way the rule says rather than the way that needs the guard.
 *
 * Every subcommand prints a terminal marker so the caller can assert the probe RAN before
 * asserting what it printed.
 */

import { certificationLabel, LabelAsserted } from "../.claude/scripts/engine/cert-label.mjs";

const LOCKED = "sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e";
const OTHER = "sha256:71b72002aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02f37b";
const REPO = "nousresearch/hermes-agent";

/** The facts a genuine certification run produces. Every case below is this, minus one thing. */
const real = () => ({
  driver: "hermes",
  image: `${REPO}@${LOCKED}`,
  lockedDigest: LOCKED,
  dockerServerVersion: "29.6.1",
  fixturesRun: 12,
});

const report = (facts) => {
  const { label, reasons } = certificationLabel(facts);
  console.log(label.toUpperCase());
  for (const r of reasons) console.log(`  because ${r}`);
};

const cases = {
  real: () => report(real()),
  mock: () => report({ ...real(), driver: "mock" }),
  tag: () => report({ ...real(), image: `${REPO}:v2026.8.3` }),
  "wrong-digest": () => report({ ...real(), image: `${REPO}@${OTHER}` }),
  "no-daemon": () => report({ ...real(), dockerServerVersion: "" }),
  "zero-fixtures": () => report({ ...real(), fixturesRun: 0 }),

  // A real run whose fixtures FAILED. The facts say a container-backed run against the pinned
  // runtime happened; whether its fixtures passed is a different question and a different field.
  "real-but-failing": () => report(real()),

  // Every shape a caller might use to declare the answer. All must THROW.
  asserted: () => {
    const keys = ["label", "certification", "certified", "isCertification", "verdict"];
    const accepted = [];
    for (const k of keys) {
      try {
        certificationLabel({ ...real(), [k]: "certification" });
        accepted.push(k);
      } catch (e) {
        if (!(e instanceof LabelAsserted)) accepted.push(`${k}(wrong-error:${e.name})`);
      }
    }
    console.log(`keys=${keys.length}`);
    console.log(`accepted=${accepted.join(",") || "none"}`);
    console.log(accepted.length ? "SOME_ACCEPTED" : "ALL_REFUSED");
  },

  // The negative control for this probe. It asserts something that is FALSE on purpose, so the
  // harness is shown to be capable of reporting a failure at all.
  "self-check": () => {
    const { label } = certificationLabel({ ...real(), driver: "mock" });
    if (label === "certification") {
      console.log("CONTROL_BROKEN: mock certified");
      process.exit(0);
    }
    console.log("CONTROL_FAILED_AS_DESIGNED");
    process.exit(1);
  },
};

const fn = cases[process.argv[2]];
if (!fn) {
  process.stderr.write(`unknown case: ${process.argv[2]} (want ${Object.keys(cases).join(", ")})\n`);
  process.exit(64);
}
fn();
