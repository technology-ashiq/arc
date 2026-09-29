// owner-sig.mjs -- the pure half of the owner key (ADR-1514 amendment 2): the signed message, the shapes, verify, fingerprint.
//
// Only node:crypto lives here: no file, no process, no prompt. That is what lets three readers share ONE definition of the
// message -- assertDecision (validate.mjs), the gate (docs/narrative-anchors.mjs, which may import no child_process) and
// narrative-proof.mjs -- and what lets the signer (owner-key.mjs) and the verifier never drift apart.
import { createHash, createPublicKey, verify } from "node:crypto";

/** The gate string of a narrative acceptance request (the docs gate's ACCEPT_GATE; the self-test pins them equal). */
export const ACCEPT_GATE = "narrative-accept";
/** Domain prefix of every signed message; a signature made for another purpose can never verify as an acceptance. */
export const ACCEPT_PREFIX = "arc-narrative-accept-v1";
/** The id grammar of a narrative page, `<dir>/<id>` (the gate's PAGE_ARG). */
export const PAGE_ID_RE = /^[a-z]+\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** An Ed25519 signature is 64 bytes: base64 of 64 bytes is 86 characters and `==`. Exact length, canonical padding. */
export const SIG_B64_RE = /^[A-Za-z0-9+/]{86}==$/;
/** One decision may sign this many pages (the payload rides one command line; Windows caps that near 32K characters). */
export const MAX_SIGNED_PAGES = 200;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** @param {unknown} s */
export const sigWellFormed = (s) => typeof s === "string" && SIG_B64_RE.test(s);

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
    if (!PAGE_ID_RE.test(k)) return `sigs key ${JSON.stringify(k.slice(0, 60))} is not a page id (<dir>/<id>)`;
    if (!sigWellFormed(/** @type {any} */ (sigs)[k])) return `sigs[${JSON.stringify(k)}] is not a base64 Ed25519 signature of the exact length`;
  }
  return "";
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

/** @param {unknown} s */
export const isUlid = (s) => typeof s === "string" && ULID_RE.test(s);
