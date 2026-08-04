// deps.mjs — the external-dependency boundary: interface, fake, and the ONE switch between
// them (ADR-0402, ADR-0405, contract C13).
//
// Offline-first is the whole reason Phases 0-2 are buildable while Phase 3 is BLOCKED: no
// provider has been chosen (ADR-0413), so every external edge is an interface with a fake
// behind it, and the real implementations are bound at Phase-3 entry.
//
// ONE switch, `ARC_LEADS_FAKE`, and it is set only by tests. The provider-code-path test
// deliberately runs with it UNSET so the real module executes against an unreachable
// endpoint -- that is what proves the fake swaps the RESPONSE and not the CODE PATH. A prior
// cycle shipped three "contract-satisfying" drivers whose real code never ran, because the
// fake returned before the real function was reached.

import { readFileSync, existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { request as httpsRequest } from "node:https";
import { resolveTxt as dnsResolveTxt } from "node:dns/promises";

export const usingFakes = () => process.env.ARC_LEADS_FAKE === "1";

export class ProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind; // "transport" | "refused" | "config"
  }
}
// Its OWN failure code, distinct from a module-not-found (1) or a fake's success path.
export const PROVIDER_EXIT = 4;

// ---------- DNS ----------

const dnsFake = {
  async resolveTxt(name) {
    const table = JSON.parse(readFileSync(fixture("dns.json"), "utf8"));
    if (!(name in table)) {
      const e = new Error(`queryTxt ENOTFOUND ${name}`);
      e.code = "ENOTFOUND";
      throw e;
    }
    return table[name].map((s) => [s]);
  },
};
const dnsReal = { resolveTxt: (name) => dnsResolveTxt(name) };
export const dns = () => (usingFakes() ? dnsFake : dnsReal);

// ---------- email verification ----------
//
// The real method is chosen from the capability report at Phase-3 entry; until then the
// interface exists and the fake drives the lint. `unverifiable` is NOT an error -- it is a
// HELD lead, which is a dossier that exists and can never be sent to (ADR-0409).

const verifyFake = {
  async verify(email) {
    const table = JSON.parse(readFileSync(fixture("verify.json"), "utf8"));
    return table[String(email).toLowerCase()] || "verified";
  },
};
const verifyReal = {
  async verify() {
    throw new ProviderError("config", "no email verifier is bound — selected from the capability report at Phase-3 entry (ADR-0402/0409)");
  },
};
export const verifier = () => (usingFakes() ? verifyFake : verifyReal);

// ---------- lead source ----------
//
// The dependency the plan originally missed entirely: the researcher needs candidates from
// somewhere, and without an interface + fake the whole offline-first claim was hollow.

const sourceFake = {
  async search() {
    return JSON.parse(readFileSync(fixture("candidates.json"), "utf8"));
  },
};
const sourceReal = {
  async search() {
    throw new ProviderError("config", "no automated lead source is bound — v1 research is manual against ADR-0409's allowlisted classes");
  },
};
export const source = () => (usingFakes() ? sourceFake : sourceReal);

// ---------- sending provider ----------

const providerFake = {
  async submit({ idem_key }) {
    const store = fakeSubmits();
    if (store.has(idem_key)) return store.get(idem_key); // idempotent by key, like the real thing must be
    const ack = { ok: true, provider_message_id: `fake-${idem_key}`, submitted_at: null };
    store.set(idem_key, ack);
    return ack;
  },
  async lookupByMessageId(idem_key) {
    const store = fakeSubmits();
    return store.has(idem_key)
      ? { found: true, provider_message_id: store.get(idem_key).provider_message_id, status: "accepted" }
      : { found: false, provider_message_id: null, status: null };
  },
  async suppressionList() {
    return [];
  },
  async authStatus() {
    const p = fixture("authstatus.json");
    return existsSync(p)
      ? JSON.parse(readFileSync(p, "utf8"))
      : { spf: true, dkim: true, dmarc: true, warmup_days: null };
  },
};
let _submits = null;
const fakeSubmits = () => (_submits ||= new Map());

// The REAL provider with no vendor bound. It is a thin HTTPS client and nothing more; the
// point of it existing now is that the code-path test can reach its own catch block.
const providerReal = {
  async submit(body) {
    const base = process.env.LEADS_PROVIDER_BASE_URL;
    if (!base) throw new ProviderError("config", "LEADS_PROVIDER_BASE_URL is unset — no provider is bound until Phase-3 entry (ADR-0402)");
    return new Promise((res, rej) => {
      const req = httpsRequest(`${base}/send`, { method: "POST", timeout: 5000 }, (r) => {
        let buf = "";
        r.on("data", (d) => (buf += d));
        r.on("end", () => {
          try { res(JSON.parse(buf)); } catch { rej(new ProviderError("refused", `unparseable provider response (${r.statusCode})`)); }
        });
      });
      req.on("timeout", () => { req.destroy(); rej(new ProviderError("transport", "provider timed out")); });
      req.on("error", (e) => rej(new ProviderError("transport", `provider unreachable: ${e.code || e.message}`)));
      req.end(JSON.stringify(body));
    });
  },
  async lookupByMessageId() { throw new ProviderError("config", "no provider bound"); },
  async suppressionList() { throw new ProviderError("config", "no provider bound"); },
  async authStatus() { throw new ProviderError("config", "no provider bound"); },
};
export const provider = () => (usingFakes() ? providerFake : providerReal);

function fixture(name) {
  const root = process.env.LEADS_FIXTURE_DIR || pathResolve(process.cwd(), "tests/fixtures/leads");
  return pathResolve(root, name);
}
