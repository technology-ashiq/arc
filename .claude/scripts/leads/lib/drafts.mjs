// drafts.mjs — the two-plane review boundary (ADR-0412) and the campaign record.
//
// Two requirements collide, and this module is where they are reconciled:
//
//   the inbox is SPINE-FED   -- that is how approval works everywhere in this repo
//   drafts are PII           -- ADR-0410 says PII never touches the spine
//
// So the approver must read something the spine is not allowed to carry. The split:
//
//   spine  : { what, gate, draft_ref, lead_hmac, campaign, lint_status, draft_sha }
//   store  : the actual body, the dossier evidence, the reply text
//
// `what` and `gate` are NOT decoration -- arc-inbox prints exactly `id what (gate) venture`,
// so an approval item without them renders as a blank line in the one surface a human uses to
// decide. That was a real finding: the boundary was designed against the inbox's payload
// contract without reading the inbox.
//
// approval binds DRAFT_SHA. Approval authorizes an attempt against EXACT CONTENT, so an edit
// after approval is refused at the send moment rather than silently sent. This is evolve's
// candidate_sha discipline applied to outreach.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STORE_FILE_MODE, STORE_DIR_MODE } from "./store.mjs";

export class DraftError extends Error {
  constructor(code, message) { super(message); this.name = "DraftError"; this.code = code; }
}

const draftsDir = (store) => {
  const d = join(store.dir, "drafts");
  mkdirSync(d, { recursive: true, mode: STORE_DIR_MODE });
  return d;
};
const campaignsDir = (store) => {
  const d = join(store.dir, "campaigns");
  mkdirSync(d, { recursive: true, mode: STORE_DIR_MODE });
  return d;
};

export const draftSha = (body) => createHash("sha256").update(String(body), "utf8").digest("hex");

// Opaque by construction. It is derived from randomness, not from the lead -- a ref that
// encoded anything about the person would be PII on the spine wearing a different name.
const newRef = () => "draft_" + randomBytes(8).toString("hex");

// ---------- campaign record ----------
//
// Lives in the store, not the spine, because it binds a campaign to a STORE identity: the
// fingerprint check that refuses a run whose keyring differs from the one the campaign's ids
// were minted under. An empty journal in a mismatched store must not read as "no unresolved
// intents" -- that was a confirmed hole, and this record is what makes the check possible.
export function initCampaign(store, campaign, { createdAt }) {
  if (!/^[a-z0-9-]{1,64}$/.test(String(campaign)))
    throw new DraftError("BAD_CAMPAIGN", `campaign must be [a-z0-9-]{1,64} — "|" is the idem delimiter and must not be smuggleable into it`);
  const p = join(campaignsDir(store), `${campaign}.json`);
  if (existsSync(p)) throw new DraftError("CAMPAIGN_EXISTS", `campaign "${campaign}" already exists at ${p}`);
  const rec = { campaign, store_id: store.storeId, store_fingerprint: fingerprintOf(store), created_at: createdAt, state: "OK", state_reason: null };
  writeFileSync(p, JSON.stringify(rec, null, 2) + "\n", { mode: STORE_FILE_MODE });
  return rec;
}

export function readCampaign(store, campaign) {
  const p = join(campaignsDir(store), `${campaign}.json`);
  if (!existsSync(p)) throw new DraftError("NO_CAMPAIGN", `campaign "${campaign}" not initialised — run \`arc-leads campaign init ${campaign}\``);
  return JSON.parse(readFileSync(p, "utf8"));
}

// The fingerprint is computed here rather than imported, so this module can assert the binding
// without a circular import. Same formula as store.fingerprint(): sha256 of the ENCODED hex.
const fingerprintOfKey = (key) =>
  createHash("sha256").update(key.secret.toString("hex"), "utf8").digest("hex").slice(0, 8);
function fingerprintOf(store) { return fingerprintOfKey(store.current); }

// EVERY key version, because rotation is additive and `current` moves.
//
// The binding check compared only the CURRENT key, so the first `rotateSecret` bricked the
// send path of every existing campaign permanently: `assertCampaignStore` mismatched forever
// and nothing in the repo rewrites a campaign record (initCampaign is its only writer and it
// refuses CAMPAIGN_EXISTS). The operator was told their store was the wrong one. Meanwhile
// the ingest path, which only calls readCampaign, carried on accepting — two derivations of
// "does this campaign belong to this store" that disagreed (D5).
//
// A rotation does not change which STORE a campaign belongs to. It is the same keyring with
// one more key in it, which is exactly what leadIdsAllVersions already assumes everywhere.
const fingerprintsOf = (store) => store.keyring.map(fingerprintOfKey);

// A run under a different keyring cannot safely touch this campaign: every lead_id would be
// derived under a secret the campaign's receipts were not written with, so the suppression
// ledger and the cap counts would both be reading a different population.
export function assertCampaignStore(store, campaign) {
  const rec = readCampaign(store, campaign);
  const fp = fingerprintOf(store);
  if (!fingerprintsOf(store).includes(rec.store_fingerprint) || rec.store_id !== store.storeId)
    throw new DraftError(
      "STORE_MISMATCH",
      `campaign "${campaign}" was created under store ${rec.store_id}/${rec.store_fingerprint} but this run resolves ${store.storeId}/${fp}. ` +
        `Refusing every send path: ids derived under a different secret would miss the suppression ledger entirely (ADR-0400/0410).`
    );
  return rec;
}

// ---------- drafts ----------

export function writeDraft(store, { campaign, lead_id, touch_n, body, cites, lintStatus }) {
  const ref = newRef();
  const sha = draftSha(body);
  const rec = { draft_ref: ref, campaign, lead_id, touch_n, body, cites, lint_status: lintStatus, draft_sha: sha };
  writeFileSync(join(draftsDir(store), `${ref}.json`), JSON.stringify(rec, null, 2) + "\n", { mode: STORE_FILE_MODE });
  return rec;
}

export function readDraft(store, ref) {
  if (!/^draft_[0-9a-f]{16}$/.test(String(ref)))
    throw new DraftError("BAD_REF", `draft ref ${JSON.stringify(ref)} is malformed`);
  const p = join(draftsDir(store), `${ref}.json`);
  if (!existsSync(p)) throw new DraftError("NO_DRAFT", `no draft ${ref} in this store`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function listDrafts(store, campaign) {
  const d = draftsDir(store);
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")))
    .filter((r) => !campaign || r.campaign === campaign);
}

// The CURRENT sha, recomputed from the body on disk. The send-moment guard compares this to
// the sha the approval bound; they differ exactly when someone edited after approving.
export const currentSha = (store, ref) => draftSha(readDraft(store, ref).body);

// ---------- the spine-safe approval payload ----------
//
// Built from a fixed literal, in one place. That is the whole mechanism behind "no PII in an
// approval receipt": there is one constructor, and a fixture asserts its exact key set and
// that no value is email-shaped or long enough to hold a body.
export function approvalPayload(draft) {
  return {
    what: `approve outreach touch ${draft.touch_n} for ${draft.lead_id} in ${draft.campaign}`,
    gate: "leads-send",
    draft_ref: draft.draft_ref,
    lead_hmac: draft.lead_id,
    campaign: draft.campaign,
    lint_status: draft.lint_status,
    draft_sha: draft.draft_sha,
  };
}

export const APPROVAL_KEYS = Object.freeze([
  "what", "gate", "draft_ref", "lead_hmac", "campaign", "lint_status", "draft_sha",
]);

// ---------- meeting drafts (Phase 02) ----------
//
// A calendar reply to an `interested` lead is NOT an outreach touch, and it lives in its own
// directory under its own ref prefix and its own inbox gate. That separation is structural,
// not stylistic: `listDrafts` feeds the send path, `readDraft` refuses any ref that is not
// `draft_<16 hex>`, and a meeting draft is therefore unreachable from `arc-leads daily` by
// construction rather than by a filter someone has to remember to keep.
//
// It would ALSO be refused there by the guard's reply-stop step, since a lead with a meeting
// draft has by definition replied. Relying on that is the mistake: it makes a directory
// listing's contents depend on a guard step staying in a particular order, and the guard's
// own header says its order is load-bearing for other reasons entirely.
const meetingsDir = (store) => {
  const d = join(store.dir, "meetings");
  mkdirSync(d, { recursive: true, mode: STORE_DIR_MODE });
  return d;
};

// DERIVED, never random, and keyed on the LEAD AND CAMPAIGN rather than on the reply.
//
// Same lead in, same ref out, so the `wx` write below turns "at most one meeting draft per
// lead per campaign" into a filesystem property instead of a check someone can forget. A
// random ref would make every ingest a new draft; keying on the REPLY -- the first version --
// was subtler and still wrong: a lead who answers "sounds good, send a link" and then, an hour
// later, "great, what times work for you?" is ONE person wanting ONE meeting, and it produced
// two byte-identical drafts and two approval items. This module's own comment says two
// approvals for one thing is how the wrong one gets approved.
//
// The reply that triggered it is still recorded on the draft, so the trail is intact.
export const meetingRefFor = (campaign, leadId) =>
  "meet_" + createHash("sha256").update(`${campaign}|${leadId}`, "utf8").digest("hex").slice(0, 16);

// Returns { created: false } when this reply already has its draft. That is a NORMAL outcome
// (a re-run), not an error, and the caller reports it rather than failing.
export function writeMeetingDraft(store, { campaign, lead_id, reply_ref, body, calendar_url }) {
  const ref = meetingRefFor(campaign, lead_id);
  const rec = {
    meeting_ref: ref, campaign, lead_id, reply_ref, body,
    calendar_url, draft_sha: draftSha(body),
  };
  const p = join(meetingsDir(store), `${ref}.json`);
  try {
    writeFileSync(p, JSON.stringify(rec, null, 2) + "\n", { mode: STORE_FILE_MODE, flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") return { created: false, rec: JSON.parse(readFileSync(p, "utf8")) };
    throw e;
  }
  return { created: true, rec };
}

export function listMeetingDrafts(store, campaign) {
  const d = meetingsDir(store);
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")))
    .filter((r) => !campaign || r.campaign === campaign);
}

// Its own gate. `leads-send` authorises a cold send under ADR-0407's L1 rule; a reply to
// someone who asked for a call is a different decision with a different risk, and one gate
// name for both would let an approval of one authorise the other.
export function meetingApprovalPayload(rec) {
  return {
    what: `send calendar link to ${rec.lead_id} (${rec.campaign}) — they replied interested`,
    gate: "leads-meeting",
    draft_ref: rec.meeting_ref,
    lead_hmac: rec.lead_id,
    campaign: rec.campaign,
    lint_status: "MEETING",
    draft_sha: rec.draft_sha,
  };
}
