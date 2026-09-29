// owner-sig.mjs -- the pure half of the owner key (ADR-1514 amendment 2): the signed message, the shapes, verify, fingerprint, and
// the ONE reader of the committed public key file.
//
// Only node:crypto and read-only file stats live here: no process, no prompt, no directory listing. That is what lets three
// readers share ONE definition of the message and of the key file -- assertDecision (validate.mjs), the gate
// (docs/narrative-anchors.mjs, which may import no child_process) and narrative-proof.mjs -- and what lets the signer
// (owner-key.mjs) and the verifier never drift apart.
import { createHash, createPublicKey, verify } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, sep } from "node:path";

/** The gate string of a narrative acceptance request (the docs gate's ACCEPT_GATE; the self-test pins them equal). */
export const ACCEPT_GATE = "narrative-accept";
/** Domain prefix of every signed message; a signature made for another purpose can never verify as an acceptance. */
export const ACCEPT_PREFIX = "arc-narrative-accept-v1";
/** A page id is at most this long: 200 ids must fit one command line, and an unbounded id is how a payload outgrows it. */
export const MAX_PAGE_ID = 100;
/** The id grammar of a narrative page, `<dir>/<id>` (the gate's PAGE_ARG), with a length ceiling. */
export const PAGE_ID_RE = /^(?=.{3,100}$)[a-z]+\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** An Ed25519 signature is 64 bytes: base64 of 64 bytes is 86 characters and `==`. Exact length, canonical padding. */
export const SIG_B64_RE = /^[A-Za-z0-9+/]{86}==$/;
/** One decision may sign this many pages. */
export const MAX_SIGNED_PAGES = 200;
/**
 * The decision payload rides one command line (arc-event --payload); Windows caps a whole command line near 32K characters and
 * turns every double quote into two. This is the ceiling on the payload's length plus its quote count.
 */
export const MAX_PAYLOAD_COST = 28000;
/** A public key file is a few hundred bytes; anything past this is not one. */
export const MAX_PUB_BYTES = 4096;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Text made safe to print on one line: every control character and Unicode line break becomes `?`, and the length is capped.
 * Untrusted text (a page name off a disk, a payload field) goes through this before it reaches a terminal or a log.
 * @param {unknown} s @param {number} [max]
 */
export const safeText = (s, max = 80) => String(s).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "?").slice(0, max);

/** @param {unknown} s */
export const sigWellFormed = (s) => {
  if (typeof s !== "string" || !SIG_B64_RE.test(s)) return false;
  // Canonical spelling only: base64 ignores the unused low bits of the last character, so 16 spellings decode alike.
  return Buffer.from(s, "base64").toString("base64") === s;
};

/**
 * The bytes one page's acceptance signs, rebuildable from a committed entry alone (no spine): the approval it rests on, the
 * page, and the sha256 of the text the owner read.
 * @param {string} approval @param {string} page @param {string} sha256
 */
export const ownerMessage = (approval, page, sha256) => `${ACCEPT_PREFIX}\n${approval}\n${page}\n${sha256}`;

/**
 * Why a decision's `sigs` value is not the closed shape, or "": a plain object, page id -> base64 signature of exact length.
 * @param {unknown} sigs @returns {string}
 */
export function sigsShapeProblem(sigs) {
  if (sigs === null || typeof sigs !== "object" || Array.isArray(sigs)) return "sigs must be an object of page -> base64 signature";
  const proto = Object.getPrototypeOf(sigs);
  if (proto !== Object.prototype && proto !== null) return "sigs must be a plain object";
  const keys = Object.keys(sigs);
  if (keys.length === 0) return "sigs is empty";
  if (keys.length > MAX_SIGNED_PAGES) return `sigs names ${keys.length} pages, the ceiling is ${MAX_SIGNED_PAGES}`;
  for (const k of keys) {
    if (!PAGE_ID_RE.test(k)) return `sigs key ${JSON.stringify(safeText(k, 60))} is not a page id (<dir>/<id>, at most ${MAX_PAGE_ID} characters)`;
    if (!sigWellFormed(/** @type {any} */ (sigs)[k])) return `sigs[${JSON.stringify(safeText(k, 60))}] is not a canonical base64 Ed25519 signature of the exact length`;
  }
  return payloadCostProblem({ sigs });
}

/**
 * Why a payload is too big for one command line, or "" (length plus quote count, see MAX_PAYLOAD_COST).
 * @param {unknown} payload @returns {string}
 */
export function payloadCostProblem(payload) {
  const s = JSON.stringify(payload);
  const cost = s.length + (s.match(/"/g) || []).length;
  return cost > MAX_PAYLOAD_COST ? `the decision would be ${cost} characters on one command line, over the ${MAX_PAYLOAD_COST} ceiling; approve fewer pages per request` : "";
}

/**
 * Whether the decision for `pages` would fit, judged BEFORE the owner types a passphrase (a refusal after it wastes his one
 * typed proof). Uses a full-length dummy signature per page; an entry that is not a valid page is signAccept's to refuse.
 * @param {string} approval @param {string} reason @param {unknown} pages @returns {string}
 */
export function decisionSizeProblem(approval, reason, pages) {
  if (!Array.isArray(pages)) return "";
  /** @type {Record<string, string>} */ const sigs = {};
  for (const x of pages) { const p = x && typeof x === "object" ? /** @type {any} */ (x).page : undefined; if (typeof p === "string" && PAGE_ID_RE.test(p)) sigs[p] = `${"A".repeat(86)}==`; }
  return payloadCostProblem({ decides: approval, reason, verdict: "approve", sigs });
}

/** sha256 of the public key's DER, hex, first 16 characters. @param {string} pubPem */
export function fingerprint(pubPem) {
  return createHash("sha256").update(createPublicKey(pubPem).export({ type: "spki", format: "der" })).digest("hex").slice(0, 16);
}

/**
 * Whether `sig` is the owner key's signature over `message`. Never throws: a public key that is not one, or a signature that
 * is not well formed, is simply "no".
 * @param {string} pubPem @param {string} message @param {unknown} sig
 */
export function verifyOwnerSig(pubPem, message, sig) {
  if (!sigWellFormed(sig)) return false;
  try {
    const key = createPublicKey(pubPem);
    if (key.asymmetricKeyType !== "ed25519") return false;
    return verify(null, Buffer.from(message, "utf8"), key, Buffer.from(/** @type {string} */ (sig), "base64"));
  } catch { return false; }
}

/**
 * THE reader of the committed public key file (attack r1 B3): `--accept`, the gate and the base-ref comparison all read it
 * through here, so all three judge the same bytes by one rule. A regular file only -- a symlink, a directory or anything else
 * is refused by name, never followed -- of at most MAX_PUB_BYTES, whose real path stays inside the tree (the tree is the
 * grandparent of `<root>/.claude/owner-key.pub`), holding an Ed25519 public key. `missing` is true only for a file that is
 * simply not there (the first-time bootstrap); every other failure is `missing: false` with a reason.
 * @param {string} abs the file's absolute path @returns {{ pem: string, why: string, missing: boolean }}
 */
export function readOwnerPubFile(abs) {
  const no = (/** @type {string} */ why, missing = false) => ({ pem: "", why, missing });
  if (typeof abs !== "string" || abs === "") return no("has no path");
  let st;
  try { st = lstatSync(abs); } catch (e) { const c = /** @type {any} */ (e) && /** @type {any} */ (e).code; return c === "ENOENT" || c === "ENOTDIR" ? no("is missing", true) : no("cannot be read"); }
  if (st.isSymbolicLink()) return no("is a symlink, which is never followed");
  if (!st.isFile()) return no("is not a regular file");
  if (st.size > MAX_PUB_BYTES) return no(`is ${st.size} bytes, too large for a public key`);
  try {
    const rootReal = realpathSync(dirname(dirname(abs)));
    if (!realpathSync(abs).startsWith(rootReal + sep)) return no("resolves outside the tree");
  } catch { return no("cannot be resolved"); }
  let buf;
  try { buf = readFileSync(abs); } catch { return no("cannot be read"); }
  if (buf.length > MAX_PUB_BYTES) return no("is too large for a public key");
  const pem = buf.toString("utf8");
  try { if (createPublicKey(pem).asymmetricKeyType !== "ed25519") return no("is not an Ed25519 public key"); } catch { return no("is not a public key"); }
  return { pem, why: "", missing: false };
}

/** @param {unknown} s */
export const isUlid = (s) => typeof s === "string" && ULID_RE.test(s);
