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

import { readFileSync, existsSync, readdirSync } from "node:fs";
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

// ---------- inbound replies (ADR-0405) ----------
//
// The webhook path lives behind the same interface as everything else, so that when a provider
// is finally chosen the manual path does not have to be rewritten — it becomes the fallback it
// was always documented as. Today `real` refuses, and `arc-leads ingest-reply --file` is the
// only path that runs.
//
// `fetch()` returns RAW BYTES per message, never a parsed object. Parsing belongs to
// replies.mjs, which is the module that carries the adversarial passes; a provider driver that
// pre-parses would move parser-class work behind a boundary nothing attacks.
const inboundFake = {
  async fetch() {
    const dir = pathResolve(fixtureDir(), "replies");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".eml"))
      .sort()
      .map((f) => ({ source: f, bytes: readFileSync(pathResolve(dir, f)) }));
  },
};
const inboundReal = {
  async fetch() {
    throw new ProviderError("config", "no inbound reply source is bound — the webhook path binds at Phase-3 entry (ADR-0405/0413). Until then use `arc-leads ingest-reply --file <path>`, which is the documented manual fallback and not a workaround");
  },
};
export const inbound = () => (usingFakes() ? inboundFake : inboundReal);

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
    // NO all-green default. The absent-file branch returned spf/dkim/dmarc all true, so three
    // deliverability clauses PASSED because a file was missing -- directly contradicting
    // preflight.mjs's own header ("never prints PASS for a clause it could not verify"), and
    // unlike its three sibling fixtures which all throw ENOENT.
    return JSON.parse(readFileSync(fixture("authstatus.json"), "utf8"));
  },
};
let _submits = null;
const fakeSubmits = () => (_submits ||= new Map());

// The ack decision, EXTRACTED from the HTTPS callback so it can be tested directly rather than
// mocked around. Testing it in place would need a TLS server with a self-signed cert and a
// client willing to trust it — i.e. a test that proves something about a weakened client.
//
// This read `JSON.parse(buf)` and resolved on anything parseable, ignoring the status code
// entirely, so a 500 whose body is `{"error":"overloaded"}` came back as an ACK. sendOne
// writes the receipt on an ack: a cap slot and a journal resolution spent on a mail that was
// never accepted, with the spine recording it as sent.
//
// 2xx only. 429 and 5xx are transport-class because they are the retryable ones and ADR-0411's
// reconcile decides whether to retry; 4xx is a refusal, because retrying a malformed request
// only repeats it.
export function decodeProviderResponse(statusCode, body) {
  const code = statusCode || 0;
  const buf = String(body == null ? "" : body);
  if (code < 200 || code >= 300) {
    const kind = code === 429 || code >= 500 ? "transport" : "refused";
    // The body is NOT echoed: a provider error body can quote the message it rejected,
    // recipient address included, and this string reaches stderr and CI logs.
    throw new ProviderError(kind, `provider returned HTTP ${code} (${buf.length} bytes of body, not echoed) — this is not an ack and no receipt is written`);
  }
  let parsed;
  try { parsed = JSON.parse(buf); }
  catch { throw new ProviderError("refused", `unparseable provider response (HTTP ${code})`); }
  // A 2xx with no message id is not an ack either: the receipt's provider_message_id is what
  // reconcile looks the send up by, and "" would make it unfindable forever.
  if (!parsed || typeof parsed.provider_message_id !== "string" || !parsed.provider_message_id)
    throw new ProviderError("refused", `provider returned HTTP ${code} with no provider_message_id — reconcile has nothing to look the send up by (ADR-0411)`);
  return parsed;
}

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
        // THE STATUS CODE DECIDES, and the body only then. The rule lives in
        // decodeProviderResponse above, where a test can reach it without a TLS server.
        r.on("end", () => {
          try { res(decodeProviderResponse(r.statusCode, buf)); }
          catch (e) { rej(e); }
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

function fixtureDir() {
  return process.env.LEADS_FIXTURE_DIR || pathResolve(process.cwd(), "tests/fixtures/leads");
}
function fixture(name) {
  return pathResolve(fixtureDir(), name);
}
