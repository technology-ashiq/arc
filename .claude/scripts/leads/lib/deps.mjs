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

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request as httpsRequest } from "node:https";
import { resolveTxt as dnsResolveTxt, resolveMx as dnsResolveMx } from "node:dns/promises";
// The ONE dossier read, shared with the send-moment guard, which needs the same file for the
// opposite purpose (see store.mjs). A second copy here is defect class D5 the moment one of
// the two grows a normalisation the other lacks.
import { openStore, dossierEmail, normalizeEmail, leadIdsAllVersions, isAddressShaped, isInsideRepo } from "./store.mjs";

// Anchored to the REPO, never to process.cwd(), for the same reason caps.mjs and preflight.mjs
// are: it is what keeps ADR-0410's store-is-outside-the-repo assertion meaningful when the
// command is run from somewhere else.
const REPO_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

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
  // ADDED WITH verifyReal, and it throws the same way resolveTxt does rather than returning [].
  // node's resolveMx throws ENOTFOUND/ENODATA for a domain with no MX; a fake that returned an
  // empty array instead would make the caller's "no MX" branch reachable only through the fake
  // and never through the real resolver, which is the fake-swaps-the-code-path defect this
  // file's own header exists to warn about.
  async resolveMx(name) {
    const table = JSON.parse(readFileSync(fixture("mx.json"), "utf8"));
    if (!(name in table)) {
      const e = new Error(`queryMx ENOTFOUND ${name}`);
      e.code = "ENOTFOUND";
      throw e;
    }
    return table[name].map((exchange) => ({ exchange, priority: 10 }));
  },
};
const dnsReal = { resolveTxt: (name) => dnsResolveTxt(name), resolveMx: (name) => dnsResolveMx(name) };
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
// MX + syntax, bound 2026-08-10 by ADR-0418. No vendor, no network beyond DNS, and no address
// ever leaves this machine -- which for a five-recipient rehearsal against addresses the owner
// already controls is the whole of what a paid verifier would add.
//
// THREE STATES, and the middle one is the point. `unverifiable` is NOT an error and NOT a
// rejection: it is a HELD lead (ADR-0409), a dossier that exists and can never be sent to. A
// domain with no MX may still accept mail on its A record, so "no MX" is genuinely "cannot
// confirm" rather than "invalid" -- and for cold outbound the conservative reading is the
// correct one, because the cost of a wrong `verified` is a bounce against a domain that takes
// 2-4 calendar weeks to warm.
// THE RESOLVER IS INJECTED, and that is not decoration. `verifier()` returns the FAKE whenever
// `ARC_LEADS_FAKE=1`, so there is no environment in which this function runs against `dnsFake`:
// on CI, which fakes DNS, the real one is never reached; off CI it needs live network. Without
// a seam the `verified` branch is unprovable in both places at once, and an unprovable branch
// is one nobody notices deleting. Measured, not assumed -- this box answers every DNS query
// with ECONNREFUSED, so `verified` returned `unverifiable` for gmail.com when it was written.
export async function verifyAddress(email, resolveMx) {
  // Syntax first, and through the SAME predicate the store mints ids with. A second address
  // grammar here would be defect class D5: an address this accepts and `isAddressShaped`
  // rejects is a lead that verifies and can never be given a lead_id.
  if (!isAddressShaped(email)) return "invalid";
  const domain = String(email).split("@").pop().trim().toLowerCase();
  if (!domain) return "invalid";
  try {
    const mx = await resolveMx(domain);
    // An empty array is a real answer a real resolver can give, not only a fake's shape.
    return Array.isArray(mx) && mx.length > 0 ? "verified" : "unverifiable";
  } catch {
    // ENOTFOUND, ENODATA, SERVFAIL, ECONNREFUSED, a timeout -- every one of them means the same
    // thing to this gate: nobody confirmed this address, so it is HELD rather than sent to.
    return "unverifiable";
  }
}

const verifyReal = {
  verify: (email) => verifyAddress(email, (d) => dns().resolveMx(d)),
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

// ADR-0417. v1 research is MANUAL -- the plan said so from kickoff and the old refusal here
// said so too, and neither supplied the mechanism by which manual research becomes a dossier.
// This is that mechanism, and it is deliberately the least code that could be it: the same read
// the fake does, from a path the operator supplies, and then straight into the SAME
// `lintCandidates` gate with no relaxation whatsoever.
//
// It reads. It does not normalise, deduplicate, enrich or repair. A corpus that fails the lint
// is reported and refused, never fixed -- because the person who wrote the corpus is the person
// who wants it to pass, which is `gate-author-cannot-be-its-attacker` in its purest form.
const sourceReal = {
  async search(icp, opts = {}) {
    const path = opts.corpus;
    if (!path)
      throw new ProviderError("config", "no lead corpus was given — v1 research is manual against ADR-0409's allowlisted classes, so `research` needs `--corpus <path>` naming a file you wrote (ADR-0417). The path goes in argv; the corpus itself never does");

    // OUTSIDE THE REPO, and refused rather than warned. This is the file most likely to be
    // dropped in the repo root by someone in a hurry, it holds names and addresses, and the PII
    // tripwire treats every tracked leads path as a violation on sight (ADR-0410). Same
    // predicate the store is guarded with, so the two cannot drift.
    const { inside, resolved, root } = isInsideRepo(REPO_ROOT, path);
    if (inside)
      throw new ProviderError("config", `the lead corpus resolves to ${resolved}, which is inside the repository at ${root} — it holds names and addresses and must never live where git can track it (ADR-0410/0417)`);
    if (!existsSync(resolved))
      throw new ProviderError("config", `lead corpus not found: ${resolved}`);

    let parsed;
    try { parsed = JSON.parse(readFileSync(resolved, "utf8")); }
    catch (e) { throw new ProviderError("config", `the lead corpus is not valid JSON (${e.message}) — nothing was read, so no dossier was written`); }

    // An OBJECT here would reach `lintCandidates` as a non-iterable and die somewhere less
    // legible; an empty array is an operator error worth naming, because "0 PASS" out of a
    // silent empty file reads exactly like a corpus whose every entry was rejected.
    if (!Array.isArray(parsed))
      throw new ProviderError("config", `the lead corpus must be a JSON array of candidates, got ${parsed === null ? "null" : typeof parsed}`);
    if (parsed.length === 0)
      throw new ProviderError("config", `the lead corpus at ${resolved} is an empty array — refusing, because a run that researches nobody and a run whose every candidate was rejected print the same summary`);

    return parsed;
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
// Kept in step with replies.mjs MAX_REPLY_BYTES. Duplicated rather than imported so this
// module keeps no parser dependency, and the provider-contract suite asserts the two are
// equal -- a constant copied without that assertion is a constant that drifts.
export const INBOUND_MAX_BYTES = 1024 * 1024;

const inboundFake = {
  async fetch() {
    const dir = pathResolve(fixtureDir(), "replies");
    if (!existsSync(dir)) return [];
    // The SAME ceiling as the other two ingest doors, and a case-insensitive extension match.
    // This one read every file whole and left the limit to fire inside the parser -- after the
    // allocation -- which is the identical defect fixed for `--file` and stdin, surviving in
    // the adjacent branch. It is also the door that will carry provider bytes once one is bound.
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".eml"))   // .EML exists on the case-insensitive legs
      .sort()
      .map((f) => {
        const full = pathResolve(dir, f);
        const size = statSync(full).size;
        if (size > INBOUND_MAX_BYTES)
          throw new ProviderError("refused", `inbound message ${f} is ${size} bytes; the limit is ${INBOUND_MAX_BYTES}`);
        return { source: f, bytes: readFileSync(full) };
      });
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
// `idField` exists because Resend returns `{"id": "..."}` and this repo's canonical ack field
// is `provider_message_id`. The mapping is a PARAMETER rather than a second decoder so the
// status-code rule below has exactly one definition: a copy of it that drifted would be defect
// class D5 in the one function whose whole job is deciding what counts as an ack.
export function decodeProviderResponse(statusCode, body, idField = "provider_message_id") {
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
  const id = parsed == null ? undefined : parsed[idField];
  if (typeof id !== "string" || !id)
    throw new ProviderError("refused", `provider returned HTTP ${code} with no ${idField} — reconcile has nothing to look the send up by (ADR-0411)`);
  // Always returns the CANONICAL field name whatever the vendor called it, so no caller
  // downstream has to know which vendor is bound.
  return { ...parsed, provider_message_id: id };
}

// ---------- the OUTREACH provider, bound to Resend (ADR-0416, phase 03 slice 03) ----------
//
// Separate from mailerReal above by ADR-0415: arc's own notification mail and the outreach
// path share a vendor and a transport SHAPE, and share no policy, no allowlist and no quota.
// Merging them is what would let an outreach bug reach the owner-notification path, or an
// owner allowlist silently authorise a cold send.
export const OUTREACH_BASE_URL_DEFAULT = "https://api.resend.com";

// The last check before the vendor sees a recipient, applied to the RESOLVED value. It used
// to guard the caller's argument, because nothing resolved anything yet; it now guards what
// came out of the dossier, which is the value that can actually be junk (a hand-edited file, a
// half-written record). A hash or a fragment reaching Resend comes back as a 400 that reads
// like a transport problem, and the receipt path must never see an ack for it.
//
// Each of the three recipient refusals below LEADS with a stable machine token, the shape the
// binding refusals in this module already use (`RESEND_API_KEY is unset — …`). D4: the tests
// used to classify these by prose substring, so rewording three sentences with no behaviour
// change whatsoever reddened CI. The token is the contract and the sentence is for the human;
// the tokens are distinct from each other on purpose, because two refusals that both merely
// name ADR-0410 are indistinguishable to a test and a store that failed to open would read as
// a dossier holding junk.
export const RECIPIENT_REFUSALS = ["STORE_UNREADABLE", "UNRESOLVABLE_RECIPIENT", "RECIPIENT_NOT_AN_ADDRESS", "RECIPIENT_ID_MISMATCH"];

function assertResolvedRecipient(to) {
  // The shape rule is store.mjs's `isAddressShaped`, shared with the parser that counts the
  // rehearsal lock. Two copies of these three conditions is exactly the D5 shape this module's
  // own header names.
  const s = String(to == null ? "" : to).trim();
  if (!isAddressShaped(s))
    throw new ProviderError("config", "RECIPIENT_NOT_AN_ADDRESS: the resolved recipient is not an address — the dossier this lead id points at holds no usable email (ADR-0410). Refusing before any network call rather than letting the vendor reject it. The value is not echoed.");
  return s;
}

// The keyed lead id becomes something a vendor can deliver to, HERE and nowhere else.
//
// `sendOne` passes `draft.lead_id`, a keyed HMAC (ADR-0400); the vendor needs the address.
// Doing it inside the real provider is what keeps the address off the send path entirely — the
// fake never sees one, and no module between the guard and the socket handles it.
//
// A raw address handed in directly is REFUSED, and that is the point rather than strictness
// for its own sake. The ADR-0416 allowlist is enforced in ID SPACE by the send-moment guard;
// an address arriving here that was never a lead id never passed that check, so accepting one
// would be a containment hole opened by a convenience. `dossierEmail` returns null for
// anything without a dossier, which includes every raw address and every traversal attempt.
//
// THE ROUND TRIP IS THE WHOLE POINT, and it was missing. The guard authorises an ID; the vendor
// is handed an ADDRESS; nothing bound the two together, so the address delivered to was not the
// address the allowlist authorised. Two confirmed ways, both reproduced:
//
//   spelling  a dossier filed at an allowlisted address's id, holding that same address with a
//             U+200B inside the local part, passed every guard (leadId hashes normalizeEmail,
//             which strips zero-width) and then put the ZERO-WIDTH spelling on the wire. NFD
//             against NFC, and upper against lower, reach it the same way. No address literal
//             appears here on purpose: this file is not a fixture path, and the tripwire is
//             right to refuse one even inside the comment that explains the bug.
//   substitution  a dossier filed at the id of an allowlisted address but HOLDING a stranger's
//             address cleared the id-space allowlist outright. Containment then rested on the
//             later suppression step, and the mutant that deletes that step left three suites
//             green.
//
// So: the resolved address must re-derive to the id we were asked to send to, and the value
// returned is the NORMALISED one. Normalising the wire value is not cosmetic — normalizeEmail
// is this lane's definition of address identity (it is what `leadId` hashes), so it is the only
// spelling of which "this is the address the allowlist authorised" is a true sentence. It folds
// case in the local part, which RFC 5321 permits a receiver to distinguish; that trade is
// deliberate and it is the same trade the allowlist, the suppression ledger and every lead id
// in this lane already made.
//
// EXPORTED for the same reason `decodeProviderResponse` above is: the value it returns is the
// property, and reading it in place would need a TLS server with a self-signed cert and a client
// willing to trust it — a test that proves something about a weakened client. `submit` below is
// its only production caller and the provider-contract suite still reaches it through `submit`,
// so the does-the-real-code-path-run property is untouched; this seam exists so a fixture can
// pin the RETURNED ADDRESS rather than only the refusals. Without it, `return
// assertResolvedRecipient(email)` — the raw value, the bug — survives every test in the tree.
export function resolveRecipient(to) {
  let store;
  try { store = openStore({ repoRoot: REPO_ROOT }); }
  catch (e) {
    throw new ProviderError("config", `STORE_UNREADABLE: the private store could not be opened to resolve the recipient (${e.code || e.message}) — refusing before any network call (ADR-0410)`);
  }
  const leadRef = String(to == null ? "" : to).trim();
  const email = dossierEmail(store, leadRef);
  if (email === null)
    throw new ProviderError("config", "UNRESOLVABLE_RECIPIENT: submit() takes the keyed lead id (ADR-0400) and could not resolve it to an address in the private store — no dossier, no email, or a recipient that was never a lead id. Refusing before any network call; the value is not echoed, because it may be the address itself.");
  // Shape FIRST, then the round trip. A dossier holding `not-an-address` fails both, and the
  // shape refusal is the one that describes it: telling an operator that junk "does not derive
  // back to this lead id" is true and useless, where "the dossier holds no usable email" names
  // the file to open.
  const canonical = assertResolvedRecipient(normalizeEmail(email));
  let ids = [];
  try { ids = leadIdsAllVersions(store, email); } catch { ids = []; }
  if (!ids.includes(leadRef))
    // A DIFFERENT refusal from UNRESOLVABLE_RECIPIENT, and the split is the fix as much as the
    // check: the dossier EXISTS and holds an address, so reporting it as missing would send the
    // operator looking for a file that is sitting right there. Neither the id nor the address is
    // echoed — this is the refusal a tampered store produces, so it is the one most likely to be
    // read out of a CI log by someone who should not have either value.
    throw new ProviderError("config", "RECIPIENT_ID_MISMATCH: the dossier for this lead id exists and holds an address, but that address does not derive back to this id under any key version in the keyring (ADR-0400). The dossier has been edited, moved, or filed under the wrong id, and the guard authorised the ID rather than what the file now holds — refusing before any network call rather than delivering to an address nothing authorised. Neither value is echoed.");
  return canonical;
}

function resendRequest({ path, method, key, payload, timeout = 10000, idemKey = null }) {
  const base = process.env.LEADS_PROVIDER_BASE_URL || OUTREACH_BASE_URL_DEFAULT;
  const headers = {
    // Bearer token in a header, never in the URL: a URL lands in proxy logs and in any
    // redirect the client follows.
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  // ADR-0402's hard filter. ADR-0416 records what comes with it: the vendor retains these for
  // 24 HOURS, after which "was this already sent?" has no answer, and an absent key must never
  // be read as "never sent" -- that is the spine-first fallback reconcile owns.
  if (idemKey !== null) headers["Idempotency-Key"] = String(idemKey);
  if (payload !== undefined) headers["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((res, rej) => {
    const req = httpsRequest(`${base}${path}`, { method, timeout, headers }, (r) => {
      let buf = "";
      r.on("data", (d) => (buf += d));
      r.on("end", () => res({ statusCode: r.statusCode, body: buf }));
    });
    req.on("timeout", () => { req.destroy(); rej(new ProviderError("transport", "provider timed out")); });
    req.on("error", (e) => rej(new ProviderError("transport", `provider unreachable: ${e.code || e.message}`)));
    if (payload === undefined) req.end(); else req.end(payload);
  });
}

function outreachKey() {
  // The NAME is in the message and the value never is. This string reaches stderr and CI.
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ProviderError("config", "RESEND_API_KEY is unset — the outreach provider is not bound. Set it in .env.local (see .env.example).");
  return key;
}

const providerReal = {
  async submit(body) {
    // Env bindings FIRST, the store read second. Both are pre-network refusals, so the order
    // is free — and asking the two cheap questions first means a missing credential is
    // reported as a missing credential rather than as whatever the filesystem said.
    const key = outreachKey();
    const from = process.env.ARC_LEADS_OUTREACH_FROM;
    if (!from) throw new ProviderError("config", "ARC_LEADS_OUTREACH_FROM is unset — a send needs an envelope sender, and it is deliberately NOT reused from the notification mailer (ADR-0415).");
    const to = resolveRecipient(body && body.to);
    const payload = JSON.stringify({
      from, to: [to],
      subject: (body && body.subject) || "",
      text: (body && body.body) || "",
      headers: (body && body.headers) || {},
    });
    // THE STATUS CODE DECIDES, and the body only then. Resend names its ack field `id`; the
    // rule and the mapping both live in decodeProviderResponse, where a test reaches them
    // without needing a TLS server.
    const { statusCode, body: buf } = await resendRequest({
      path: "/emails", method: "POST", key, payload, idemKey: body && body.idem_key,
    });
    return decodeProviderResponse(statusCode, buf, "id");
  },

  async lookupByMessageId(id) {
    const key = outreachKey();
    if (!id) throw new ProviderError("config", "lookupByMessageId() needs a provider message id");
    const { statusCode, body } = await resendRequest({ path: `/emails/${encodeURIComponent(id)}`, method: "GET", key });
    // 404 is the ANSWER "the vendor has no record", not a failure to ask. Reconcile must be
    // able to tell those apart: past the 24h retention an absent record means unknown, never
    // "never sent" (ADR-0416).
    if (statusCode === 404) return { found: false, provider_message_id: null, status: null };
    const ack = decodeProviderResponse(statusCode, body, "id");
    return { found: true, provider_message_id: ack.provider_message_id, status: ack.last_event || ack.status || "accepted" };
  },

  // Named refusal, not a stub. Resend exposes no general suppression endpoint -- its
  // unsubscribe state lives per-audience under /audiences/:id/contacts, which is a different
  // model from the one ADR-0402 assumes. Returning [] here would read as "nobody is
  // suppressed" and is the exact fail-open this repo refuses; the real answer is that the
  // rehearsal derives suppression from its own receipts (ADR-0411), and the cold-outbound
  // vendor for phase 05 must satisfy the hard filter properly.
  async suppressionList() {
    throw new ProviderError("config", "Resend exposes no general suppression list — suppression is derived from receipts for the rehearsal (ADR-0411), and a vendor-side list is part of the phase-05 capability question. Refusing rather than returning an empty list that would read as nobody-is-suppressed.");
  },

  async authStatus() {
    const key = outreachKey();
    const { statusCode, body } = await resendRequest({ path: "/domains", method: "GET", key });
    if (statusCode < 200 || statusCode >= 300)
      throw new ProviderError(statusCode === 429 || statusCode >= 500 ? "transport" : "refused", `provider /domains returned HTTP ${statusCode} (${String(body).length} bytes, not echoed)`);
    let parsed;
    try { parsed = JSON.parse(String(body)); }
    catch { throw new ProviderError("refused", `unparseable /domains response (HTTP ${statusCode})`); }
    const domains = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.data) ? parsed.data : null);
    if (!domains) throw new ProviderError("refused", "provider /domains response carried no domain list — refusing rather than reporting an unverified authentication status");
    const want = String(process.env.ARC_LEADS_OUTREACH_FROM || "").split("@").pop().toLowerCase();
    const row = domains.find((d) => d && String(d.name || "").toLowerCase() === want);
    // No all-green default, and no all-green ABSENT default either: a domain the vendor does
    // not list is not authenticated, and saying so is the whole contract of this call.
    if (!row) return { spf: false, dkim: false, dmarc: null, warmup_days: null };
    const verified = String(row.status || "").toLowerCase() === "verified";
    // `dmarc: null` means THE VENDOR CANNOT ANSWER, which is a third state and not a false.
    // Resend verifies SPF and DKIM as one domain status and does not evaluate DMARC at all.
    // Returning `verified` here would invent a clause the vendor never checked -- the exact
    // shape the fixture loader above was fixed for. Returning `false` would be equally wrong
    // and would make the gate unpassable for a domain whose DMARC is fine. preflight resolves
    // DMARC live from DNS, and that live row is the only honest source for it.
    return { spf: verified, dkim: verified, dmarc: null, warmup_days: null };
  },
};
export const provider = () => (usingFakes() ? providerFake : providerReal);

// ---------- notification mail (ADR-0415) ----------
//
// A SEPARATE boundary from `provider` above, and the separation is the point rather than an
// accident of layout. `provider` is the cold-outbound path: suppression lists, idempotency
// lookup, bounce and complaint handling, caps derived from receipts. This one carries a single
// owner-directed send and nothing else.
//
// From Phase 03 both post to the same vendor, which is exactly why the POLICY layers must stay
// in separate modules (`lib/mail.mjs` here, `sequencer.mjs`/`guard.mjs` there). A shared
// "sendMail" helper is precisely how the product domain ends up inside the cold-outbound path
// that ADR-0402 exists to keep it out of — the coupling would arrive as a convenience, not as
// a decision, and nobody would review it.
export const MAIL_BASE_URL_DEFAULT = "https://api.resend.com";

// The ack decision, EXTRACTED from the HTTPS callback for the same reason
// `decodeProviderResponse` is: testing it in place would need a TLS server with a self-signed
// cert and a client willing to trust it, i.e. a test that proves something about a weakened
// client rather than about this rule.
export function decodeMailResponse(statusCode, body) {
  const code = statusCode || 0;
  const buf = String(body == null ? "" : body);
  if (code < 200 || code >= 300) {
    const kind = code === 429 || code >= 500 ? "transport" : "refused";
    // 429 is called out by name because it is the one an operator will actually hit: Resend's
    // free tier stops at 100/day, and "rate limited" reads as transient noise unless the
    // message says the quota might simply be gone for the day.
    const hint = code === 429
      ? " — rate limited OR the daily/monthly quota is exhausted; nothing was delivered"
      : "";
    // The body is NOT echoed. A vendor error body quotes the message it rejected, recipient
    // address included, and this string reaches stderr and CI logs.
    throw new ProviderError(kind, `mail vendor returned HTTP ${code}${hint} (${buf.length} bytes of body, not echoed) — this is not an ack and nothing is logged as sent`);
  }
  let parsed;
  try { parsed = JSON.parse(buf); }
  catch { throw new ProviderError("refused", `unparseable mail-vendor response (HTTP ${code})`); }
  // A 2xx with no id is not an ack: the id is the only handle the delivery log has for
  // matching a send against the vendor dashboard, and "" would make it unmatchable forever.
  // The emptiness test is on the TRIMMED value, because `!parsed.id` measures length and the
  // property wanted is content — `" "`, `"\n"` and a lone NUL are all non-empty strings and all
  // exactly as unmatchable as `""`, and they would be written into the delivery log and printed
  // to the CI log as a blank id.
  if (!parsed || typeof parsed.id !== "string" || parsed.id.trim() === "")
    throw new ProviderError("refused", `mail vendor returned HTTP ${code} with no message id — there is nothing to record the send against`);
  return parsed;
}

// The fake REQUIRES its fixture and does not default to accepting.
//
// `authStatus` above learned this the expensive way: its absent-file branch returned
// spf/dkim/dmarc all true, so three deliverability clauses PASSED because a file was missing.
// An accept-by-default mailer fake has the identical shape — a test that means to inject a 500,
// misspells the fixture path, and passes green having proved nothing.
const mailerFake = {
  async send({ to, idem_key }) {
    const cfg = JSON.parse(readFileSync(fixture("mail.json"), "utf8"));
    if (cfg && cfg.http_status && (cfg.http_status < 200 || cfg.http_status >= 300))
      return decodeMailResponse(cfg.http_status, JSON.stringify(cfg.body || {}));
    const store = fakeMails();
    if (store.has(idem_key)) return store.get(idem_key);
    const ack = { id: `fake-mail-${idem_key}`, to: String(to) };
    store.set(idem_key, ack);
    return ack;
  },
};
let _mails = null;
const fakeMails = () => (_mails ||= new Map());

const mailerReal = {
  async send({ to, from, subject, text, idem_key }) {
    const key = process.env.RESEND_API_KEY;
    // The NAME is in the message and the value never is. This string reaches stderr and CI.
    if (!key)
      throw new ProviderError("config", "RESEND_API_KEY is unset — set it in .env.local (see .env.example). Refusing to send.");
    const base = process.env.ARC_LEADS_MAIL_BASE_URL || MAIL_BASE_URL_DEFAULT;
    const payload = JSON.stringify({ from, to: [to], subject, text });
    return new Promise((res, rej) => {
      const req = httpsRequest(
        `${base}/emails`,
        {
          method: "POST",
          timeout: 10000,
          headers: {
            // Bearer token in a header, never in the URL: a URL lands in proxy logs and in
            // any redirect the client follows.
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            // ADR-0402's hard filter, and ADR-0416 records the constraint that comes with it:
            // the vendor retains these for 24 HOURS. Past that the question "was this already
            // sent?" has no answer, and an absent key must never be read as "never sent".
            "Idempotency-Key": String(idem_key),
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (r) => {
          let buf = "";
          r.on("data", (d) => (buf += d));
          r.on("end", () => {
            try { res(decodeMailResponse(r.statusCode, buf)); }
            catch (e) { rej(e); }
          });
        },
      );
      req.on("timeout", () => { req.destroy(); rej(new ProviderError("transport", "mail vendor timed out")); });
      req.on("error", (e) => rej(new ProviderError("transport", `mail vendor unreachable: ${e.code || e.message}`)));
      req.end(payload);
    });
  },
};
export const mailer = () => (usingFakes() ? mailerFake : mailerReal);

function fixtureDir() {
  return process.env.LEADS_FIXTURE_DIR || pathResolve(process.cwd(), "tests/fixtures/leads");
}
function fixture(name) {
  return pathResolve(fixtureDir(), name);
}
