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
function fingerprintOf(store) {
  return createHash("sha256").update(store.current.secret.toString("hex"), "utf8").digest("hex").slice(0, 8);
}

// A run under a different keyring cannot safely touch this campaign: every lead_id would be
// derived under a secret the campaign's receipts were not written with, so the suppression
// ledger and the cap counts would both be reading a different population.
export function assertCampaignStore(store, campaign) {
  const rec = readCampaign(store, campaign);
  const fp = fingerprintOf(store);
  if (rec.store_fingerprint !== fp || rec.store_id !== store.storeId)
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
