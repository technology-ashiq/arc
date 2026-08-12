#!/usr/bin/env node
/**
 * Schema-level probe for the legal suites: builds a facts object in memory, runs the real
 * validator over it, and prints `accepted` or `rejected`.
 *
 * Separate from legal-probe.mjs because these cases construct INPUT rather than inspect
 * OUTPUT, and because a probe that both builds fixtures and reads results is one file where a
 * bug can make the fixture match whatever the reader expects.
 *
 * Every case prints exactly one word and exits 0. A case that cannot run at all exits 9 with a
 * message on stderr, so "rejected" can never be produced by the probe falling over.
 */
import { readFileSync } from "node:fs";
import { validateFacts } from "../.claude/scripts/legal/lib/schema.mjs";

const vocab = JSON.parse(
  readFileSync(new URL("../products/legal/data/vocab.json", import.meta.url), "utf8"),
);

function base() {
  return {
    venture: "probe-venture",
    site_url: "https://probe.example",
    effective_date: "2026-08-13",
    operator: { type: "entity", legal_name: "Probe Systems Private Limited", trade_name: "Probe" },
    geographic_address: "1 Probe Road, Chennai 600001, India",
    support: { email: "support@probe.example", phone: "+91 44 4000 1000" },
    grievance: {
      name: "Probe Officer",
      email: "grievance@probe.example",
      address: "Grievance Officer, 1 Probe Road, Chennai 600001, India",
    },
    data_categories: ["identity", "contact"],
    purposes: ["provide-the-service"],
    analytics: ["none"],
    retention: "until-account-deletion",
    deletion_route: { mailbox: "delete@probe.example" },
    payment_model: "gateway",
    payment_provider: "razorpay",
    refund_window_days: 14,
    gst_registered: false,
    stores_third_party_client_data: false,
  };
}

const cases = {
  "baseline": (f) => f,
  "freetext-ok": (f) => { f.operator.trade_name = "Rao & Sons (Chennai)"; return f; },
  "freetext-double-space": (f) => { f.operator.trade_name = "Probe  Systems"; return f; },
  "freetext-url": (f) => { f.operator.trade_name = "Probe https://evil.example"; return f; },
  "freetext-markup": (f) => { f.operator.trade_name = "Probe <b>Systems</b>"; return f; },
  "freetext-too-long": (f) => { f.operator.trade_name = "x".repeat(81); return f; },
  "empty-subprocessors": (f) => { f.stores_third_party_client_data = true; f.sub_processors = []; return f; },
  "unknown-field": (f) => { f.sneaky_extra = "hello"; return f; },
  "gstin-without-registration": (f) => { f.gstin = "33AABCN1234M1Z5"; return f; },
  "registration-without-gstin": (f) => { f.gst_registered = true; return f; },
  "quoted-int": (f) => { f.refund_window_days = "14"; return f; },
  "bad-enum": (f) => { f.retention = "forever"; return f; },
  "impossible-date": (f) => { f.effective_date = "2026-02-30"; return f; },
  "bad-route": (f) => { f.routes = { terms: "legal/terms" }; return f; },
  "good-route": (f) => { f.routes = { terms: "/legal/terms" }; return f; },
  "http-site-url": (f) => { f.site_url = "http://probe.example"; return f; },
};

const name = process.argv[2];
const fn = cases[name];
if (!fn) {
  console.error(`legal-schema-probe: unknown case: ${name || "(none)"}`);
  console.error(`known cases: ${Object.keys(cases).join(", ")}`);
  process.exit(9);
}

// The baseline must be VALID, or every "rejected" below could be the baseline being broken
// rather than the case under test. Checked on every invocation, not once.
const baselineErrors = validateFacts(base(), vocab);
if (baselineErrors.length) {
  console.error("legal-schema-probe: the baseline facts are invalid, so no case here proves anything:");
  for (const e of baselineErrors) console.error("  - " + e);
  process.exit(9);
}

const errs = validateFacts(fn(base()), vocab);
console.log(errs.length ? "rejected" : "accepted");
