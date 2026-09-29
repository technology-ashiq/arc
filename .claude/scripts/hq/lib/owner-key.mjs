// owner-key.mjs -- the owner's Ed25519 key: made once at a terminal, sealed by a passphrase, unsealed only at a prompt
// (ADR-1514 amendment 2). The agent and the owner share one operating-system user, so a secret that is only a file or an
// environment variable is readable by the agent; a passphrase typed by a human at a real terminal is not.
//
// Every function takes what it touches as a PARAMETER ({ keyDir, readPassphrase, isTty }): production wires the fixed paths
// and the real prompt in the CLI, and the tests inject temp dirs and a scripted prompt. No option or variable of THIS tool
// moves the key. The home directory is the operating system's record of the user (os.userInfo), not the HOME or USERPROFILE
// variables, which any caller can set (attack r1 B6): a door the actor a proof guards against can open defeats the proof
// (ADR-1514 amendment 1, ARC_SPINE_ROOT).
//
// The sealed file is our own, not node's PKCS8 encryption (attack r1 B1: node fixes a weak derivation cost, and the file is
// readable by the agent, so a guessable passphrase would fall to an offline guess): scrypt with a random salt and a large
// memory cost, then AES-256-GCM over the raw private key, in one small JSON file that records its own parameters.
import { createCipheriv, createDecipheriv, createPrivateKey, generateKeyPairSync, randomBytes, scryptSync, sign } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { createInterface } from "node:readline";
import { PAGE_ID_RE, decisionSizeProblem, fingerprint, isUlid, ownerMessage, safeText, sigsShapeProblem } from "./owner-sig.mjs";

export const KEY_FILE = "owner-key.pem";
/** The sealed file's format version and the ONLY key derivation it may name. */
export const SEAL_VERSION = 1;
/** scrypt cost, recorded in the file: 2^17 x 8 x 128 bytes = 128 MiB and a few tenths of a second per guess. */
export const SCRYPT_N = 2 ** 17;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
/** An unseal refuses a file whose recorded cost is outside this band: below it the file was made cheap to guess, above it the file is a memory bomb. */
const N_BAND = [2 ** 17, 2 ** 20];
const SCRYPT_MAXMEM = 2 ** 30;
/** Shorter than this and an offline guess at the sealed file is cheap: the passphrase carries what the derivation cost does not. */
export const MIN_PASSPHRASE = 12;

/**
 * Where the sealed private key lives, outside every repo. The default home is the operating system's own record of the user;
 * HOME and USERPROFILE do not move it. @param {string} [home]
 */
export const ownerKeyDir = (home = userInfo().homedir) => join(home, ".arc-private", "owner");
/** Where the committed public key lives in a tree. @param {string} root */
export const ownerPubPath = (root) => join(root, ".claude", "owner-key.pub");

/** Both ends of the session are a terminal. */
export const stdioIsTty = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/**
 * What to tell an owner whose shell was refused as "not a terminal". Git Bash's default window (mintty) hands node a pipe, so
 * a real human there is refused too; the check is not weakened, the owner is told where a real console is. Pure.
 * @param {Record<string, string | undefined>} [env]
 */
export const terminalHint = (env = process.env) =>
  `run it in PowerShell, cmd or Windows Terminal, or a Linux/macOS terminal${env.MSYSTEM || env.TERM_PROGRAM === "mintty" ? ", or from Git Bash as: winpty node <the same command>" : ""} -- not through the chat`;

/** @param {(() => boolean) | boolean | undefined} isTty */
const tty = (isTty) => (typeof isTty === "function" ? Boolean(isTty()) : isTty === true);

/**
 * One line typed at the terminal, not echoed (a muted output stream, which works on Windows where raw-mode tricks do not).
 * @param {string} prompt @returns {Promise<string>}
 */
export function readPassphraseTty(prompt) {
  return new Promise((resolve, reject) => {
    let muted = false;
    const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
    const rl = createInterface({ input: process.stdin, output: out, terminal: true });
    let done = false;
    rl.on("close", () => { if (!done) reject(new Error("input closed before a passphrase was typed")); });
    process.stdout.write(prompt);
    muted = true;
    rl.question("", (answer) => { done = true; muted = false; rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

const b64 = (/** @type {Buffer} */ b) => b.toString("base64");
/** The bytes GCM authenticates beside the ciphertext: the version and every parameter, so an edited cost cannot open the file. */
const aad = (/** @type {{ v: number, kdf: string, N: number, r: number, p: number, salt: string }} */ h) => Buffer.from(JSON.stringify({ v: h.v, kdf: h.kdf, N: h.N, r: h.r, p: h.p, salt: h.salt }), "utf8");

/**
 * The private key sealed under the typed passphrase, as a JSON document (version, kdf, cost, salt, iv, tag, ciphertext).
 * @param {Buffer} raw the private key, DER @param {string} secret @returns {string}
 */
export function sealKey(raw, secret) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const head = { v: SEAL_VERSION, kdf: "scrypt", N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, salt: b64(salt) };
  const key = scryptSync(secret, salt, 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aad(head));
  const ct = Buffer.concat([c.update(raw), c.final()]);
  return `${JSON.stringify({ ...head, cipher: "aes-256-gcm", iv: b64(iv), tag: b64(c.getAuthTag()), ct: b64(ct) }, null, 2)}\n`;
}

/**
 * The raw key inside a sealed file, or why not. Never throws: a file that is not one of ours, a cost outside the band and a
 * wrong secret are each one sentence. @param {string} text @param {string} secret @returns {{ raw: Buffer | null, why: string }}
 */
export function openKey(text, secret) {
  const no = (/** @type {string} */ why) => ({ raw: null, why });
  /** @type {any} */ let f;
  try { f = JSON.parse(text); } catch { return no("the owner key file is not a sealed key this tool made (an older or damaged file); delete it deliberately and run \"arc-inbox owner-key init\" again"); }
  const int = (/** @type {unknown} */ n) => typeof n === "number" && Number.isInteger(n);
  const str = (/** @type {unknown} */ s, /** @type {number} */ len) => typeof s === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(s) && Buffer.from(s, "base64").length === len;
  if (!f || typeof f !== "object" || f.v !== SEAL_VERSION || f.kdf !== "scrypt" || f.cipher !== "aes-256-gcm" || !int(f.N) || !int(f.r) || !int(f.p) || !str(f.salt, 16) || !str(f.iv, 12) || !str(f.tag, 16) || typeof f.ct !== "string" || f.ct.length > 4096)
    return no("the owner key file is not a sealed key this tool made (an older or damaged file); delete it deliberately and run \"arc-inbox owner-key init\" again");
  if (f.N < N_BAND[0] || f.N > N_BAND[1] || (f.N & (f.N - 1)) !== 0 || f.r !== SCRYPT_R || f.p < 1 || f.p > 4)
    return no(`the owner key file records a key-derivation cost (N=${safeText(f.N, 12)}) outside the accepted band, so it was made cheap to guess or is not safe to open; nothing was signed`);
  try {
    const key = scryptSync(String(secret), Buffer.from(f.salt, "base64"), 32, { N: f.N, r: f.r, p: f.p, maxmem: SCRYPT_MAXMEM });
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(f.iv, "base64"));
    d.setAAD(aad(f));
    d.setAuthTag(Buffer.from(f.tag, "base64"));
    return { raw: Buffer.concat([d.update(Buffer.from(f.ct, "base64")), d.final()]), why: "" };
  } catch { return no("that passphrase does not unseal the owner key; nothing was signed"); }
}

/** Whether something is at the path, whatever it is: a link or a directory counts (existsSync follows links and misses a dangling one). @param {string} p */
const present = (p) => { try { lstatSync(p); return true; } catch { return false; } };
/** @param {unknown} e */
const oneLine = (e) => safeText(String(e && /** @type {Error} */ (e).message || e).split("\n")[0], 160);

/**
 * Make the key pair, seal the private half, commit-ready public half. Refuses (one sentence, and nothing left behind) without a
 * terminal, with a passphrase that is short or typed differently twice, over an existing key, or over an existing public key
 * file. Nothing is created before the last refusal that can be judged first; a write that fails later removes what it made.
 * @param {{ keyDir: string, pubPath: string, readPassphrase: (prompt: string) => Promise<string>, isTty: (() => boolean) | boolean }} a
 * @returns {Promise<{ ok: boolean, why: string, fingerprint: string, keyPath: string }>}
 */
export async function initOwnerKey({ keyDir, pubPath, readPassphrase, isTty }) {
  const no = (/** @type {string} */ why) => ({ ok: false, why, fingerprint: "", keyPath: "" });
  if (!tty(isTty)) return no(`owner-key init needs a real terminal on both stdin and stdout (a passphrase typed into a pipe is one an agent can supply); ${terminalHint()}`);
  const keyPath = join(keyDir, KEY_FILE);
  if (present(keyPath)) return no(`an owner key already exists at ${keyPath}; delete it deliberately if you mean to rotate it (the old key's approvals then need re-signing)`);
  if (present(pubPath)) return no(`a public key file already exists at ${pubPath} (it is the committed trust anchor and is never overwritten silently); delete it deliberately if you mean to rotate the key`);
  const p1 = await readPassphrase("New passphrase for the owner key: ");
  if (typeof p1 !== "string" || p1.trim().length < MIN_PASSPHRASE) return no(`the passphrase must be at least ${MIN_PASSPHRASE} characters; nothing was written`);
  const p2 = await readPassphrase("Type it again: ");
  if (p1 !== p2) return no("the two passphrases differ; nothing was written");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const sealed = sealKey(/** @type {Buffer} */ (privateKey.export({ type: "pkcs8", format: "der" })), p1);
  const pubPem = String(publicKey.export({ type: "spki", format: "pem" }));
  const tmp = `${keyPath}.tmp-${process.pid}`;
  let madePub = false, madeTmp = false;
  const writeNew = (/** @type {string} */ path, /** @type {string} */ data, /** @type {number} */ mode) => { const fd = openSync(path, "wx", mode); try { writeSync(fd, data); } finally { closeSync(fd); } };
  try {
    mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    mkdirSync(dirname(pubPath), { recursive: true });
    writeNew(pubPath, pubPem, 0o644); madePub = true;
    writeNew(tmp, sealed, 0o600); madeTmp = true;
    renameSync(tmp, keyPath);
  } catch (e) {
    if (madeTmp) rmSync(tmp, { force: true });
    if (madePub) rmSync(pubPath, { force: true });
    return no(`could not write the key files (${oneLine(e)}); nothing was left behind, and you can run init again`);
  }
  return { ok: true, why: "", fingerprint: fingerprint(pubPem), keyPath };
}

/**
 * The private key, unsealed with a typed passphrase, or why not. A wrong passphrase is one sentence and nothing else happens.
 * @param {{ keyDir: string, readPassphrase: (prompt: string) => Promise<string> }} a
 * @returns {Promise<{ key: import("node:crypto").KeyObject | null, why: string }>}
 */
export async function unsealOwnerKey({ keyDir, readPassphrase }) {
  const keyPath = join(keyDir, KEY_FILE);
  const no = (/** @type {string} */ why) => ({ key: null, why });
  let st;
  try { st = lstatSync(keyPath); } catch { return no(`there is no owner key at ${keyPath}; run "arc-inbox owner-key init" in a terminal first`); }
  if (!st.isFile() || st.isSymbolicLink()) return no(`${keyPath} is not a regular file, so it is not an owner key; nothing was signed`);
  if (st.size > 16384) return no(`${keyPath} is too large to be an owner key; nothing was signed`);
  let text = "";
  try { text = readFileSync(keyPath, "utf8"); } catch (e) { return no(`the owner key could not be read (${oneLine(e)}); nothing was signed`); }
  const pass = await readPassphrase("Passphrase for the owner key (not shown): ");
  const o = openKey(text, String(pass));
  if (!o.raw) return no(o.why);
  try { return { key: createPrivateKey({ key: o.raw, format: "der", type: "pkcs8" }), why: "" }; }
  catch { return no("the unsealed owner key is not a private key; nothing was signed"); }
}

/**
 * What the owner sees before he is asked to sign: the request's pages, printed only when each entry is a well-formed
 * {page, sha256} (attack r1 B5). Untrusted payload text is never drawn raw on the terminal where he types his passphrase; an
 * entry that is not well formed is shown as a JSON-escaped, control-stripped fragment and named invalid.
 * @param {string} id @param {unknown} pages @returns {string}
 */
export function pageListing(id, pages) {
  const listed = Array.isArray(pages) ? pages : [];
  const rows = listed.slice(0, 200).map((/** @type {any} */ x) => {
    const page = x && typeof x === "object" ? x.page : undefined, hash = x && typeof x === "object" ? x.sha256 : undefined;
    return typeof page === "string" && PAGE_ID_RE.test(page) && typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash)
      ? `  ${page}  ${hash.slice(0, 12)}` : `  (not a valid page entry, will not be signed: ${JSON.stringify(safeText(JSON.stringify(x) ?? "", 60))})`;
  });
  return `inbox: ${isUlid(id) ? id : "?"} asks you to accept ${listed.length} narrative page${listed.length === 1 ? "" : "s"}:\n${rows.join("\n")}${listed.length > 200 ? `\n  ... and ${listed.length - 200} more` : ""}\n`;
}

/**
 * One signature per page of a narrative-accept request, each over the message the gate rebuilds from an accepted.json entry.
 * Refuses without a terminal BEFORE it reads the key or prompts for anything, and refuses a decision too big for one command
 * line before the owner types anything (`reason` is what the decision will carry).
 * @param {{ approval: string, pages: unknown, keyDir: string, readPassphrase: (prompt: string) => Promise<string>, isTty: (() => boolean) | boolean, reason?: string }} a
 * @returns {Promise<{ sigs: Record<string, string> | null, why: string }>}
 */
export async function signAccept({ approval, pages, keyDir, readPassphrase, isTty, reason = "" }) {
  const no = (/** @type {string} */ why) => ({ sigs: null, why });
  if (!tty(isTty)) return no(`approving narrative pages needs a real terminal on both stdin and stdout, and is signed with your passphrase; ${terminalHint()}`);
  if (!isUlid(approval)) return no("the approval id is not a ULID");
  if (!Array.isArray(pages) || pages.length === 0) return no("the request lists no pages, so there is nothing to sign");
  /** @type {Map<string, string>} */ const byPage = new Map();
  for (const x of pages) {
    const page = x && typeof x === "object" ? /** @type {any} */ (x).page : undefined, hash = x && typeof x === "object" ? /** @type {any} */ (x).sha256 : undefined;
    if (typeof page !== "string" || !PAGE_ID_RE.test(page) || typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) return no("the request lists a page entry that is not {page, sha256}; nothing was signed");
    if (byPage.has(page) && byPage.get(page) !== hash) return no(`the request lists ${page} twice with different hashes; nothing was signed`);
    byPage.set(page, hash);
  }
  const big = decisionSizeProblem(approval, reason, pages);
  if (big) return no(`${big}; nothing was signed`);
  const u = await unsealOwnerKey({ keyDir, readPassphrase });
  if (!u.key) return no(u.why);
  /** @type {Record<string, string>} */ const sigs = {};
  for (const [page, hash] of [...byPage].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) sigs[page] = sign(null, Buffer.from(ownerMessage(approval, page, hash), "utf8"), u.key).toString("base64");
  const bad = sigsShapeProblem(sigs);
  return bad ? no(bad) : { sigs, why: "" };
}
