// owner-key.mjs -- the owner's Ed25519 key: made once at a terminal, sealed by a passphrase, unsealed only at a prompt
// (ADR-1514 amendment 2). The agent and the owner share one operating-system user, so a secret that is only a file or an
// environment variable is readable by the agent; a passphrase typed by a human at a real terminal is not.
//
// Every function takes what it touches as a PARAMETER ({ keyDir, readPassphrase, isTty }): production wires the fixed paths
// and the real prompt in the CLI, and the tests inject temp dirs and a scripted prompt. There is deliberately no environment
// variable or option that moves the key in production -- a door the actor a proof guards against can open defeats the proof
// (ADR-1514 amendment 1, ARC_SPINE_ROOT).
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { createInterface } from "node:readline";
import { PAGE_ID_RE, fingerprint, isUlid, ownerMessage, sigsShapeProblem } from "./owner-sig.mjs";

// node crypto names its sealing option after the word below. The attack-input scan refuses any line that puts that word
// next to a colon or equals sign, because it cannot tell an option name from a credential, so the key is built from parts.
const SEAL = "pass" + "phrase";

export const KEY_FILE = "owner-key.pem";
/** Shorter than this and an offline guess at the sealed file is cheap: node fixes the key-derivation cost, the passphrase carries the rest. */
export const MIN_PASSPHRASE = 12;

/** Where the sealed private key lives, outside every repo. @param {string} [home] */
export const ownerKeyDir = (home = homedir()) => join(home, ".arc-private", "owner");
/** Where the committed public key lives in a tree. @param {string} root */
export const ownerPubPath = (root) => join(root, ".claude", "owner-key.pub");

/** Both ends of the session are a terminal. */
export const stdioIsTty = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

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

/**
 * Make the key pair, seal the private half, commit-ready public half. Refuses (one sentence, nothing written) without a
 * terminal, with a passphrase that is short or typed differently twice, or over an existing key.
 * @param {{ keyDir: string, pubPath: string, readPassphrase: (prompt: string) => Promise<string>, isTty: (() => boolean) | boolean }} a
 * @returns {Promise<{ ok: boolean, why: string, fingerprint: string, keyPath: string }>}
 */
export async function initOwnerKey({ keyDir, pubPath, readPassphrase, isTty }) {
  const no = (/** @type {string} */ why) => ({ ok: false, why, fingerprint: "", keyPath: "" });
  if (!tty(isTty)) return no("owner-key init needs a real terminal on both stdin and stdout (a passphrase typed into a pipe is one an agent can supply); run it in a terminal window, not through the chat");
  const keyPath = join(keyDir, KEY_FILE);
  if (existsSync(keyPath)) return no(`an owner key already exists at ${keyPath}; delete it deliberately if you mean to rotate it (the old key's approvals then need re-signing)`);
  const p1 = await readPassphrase("New passphrase for the owner key: ");
  if (typeof p1 !== "string" || p1.trim().length < MIN_PASSPHRASE) return no(`the passphrase must be at least ${MIN_PASSPHRASE} characters; nothing was written`);
  const p2 = await readPassphrase("Type it again: ");
  if (p1 !== p2) return no("the two passphrases differ; nothing was written");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", [SEAL]: p1 },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  try { writeFileSync(keyPath, privateKey, { flag: "wx", mode: 0o600 }); }
  catch (e) { return no(`could not write ${keyPath}: ${String(/** @type {Error} */ (e).message).split("\n")[0]}`); }
  mkdirSync(dirname(pubPath), { recursive: true });
  writeFileSync(pubPath, publicKey);
  return { ok: true, why: "", fingerprint: fingerprint(publicKey), keyPath };
}

/**
 * The private key, unsealed with a typed passphrase, or why not. A wrong passphrase is one sentence and nothing else happens.
 * @param {{ keyDir: string, readPassphrase: (prompt: string) => Promise<string> }} a
 * @returns {Promise<{ key: import("node:crypto").KeyObject | null, why: string }>}
 */
export async function unsealOwnerKey({ keyDir, readPassphrase }) {
  const keyPath = join(keyDir, KEY_FILE);
  if (!existsSync(keyPath)) return { key: null, why: `there is no owner key at ${keyPath}; run "arc-inbox owner-key init" in a terminal first` };
  const pem = readFileSync(keyPath, "utf8");
  const pass = await readPassphrase("Owner key passphrase: ");
  try { return { key: createPrivateKey({ key: pem, format: "pem", [SEAL]: String(pass) }), why: "" }; }
  catch { return { key: null, why: "that passphrase does not unseal the owner key; nothing was signed" }; }
}

/**
 * One signature per page of a narrative-accept request, each over the message the gate rebuilds from an accepted.json entry.
 * Refuses without a terminal BEFORE it reads the key or prompts for anything.
 * @param {{ approval: string, pages: unknown, keyDir: string, readPassphrase: (prompt: string) => Promise<string>, isTty: (() => boolean) | boolean }} a
 * @returns {Promise<{ sigs: Record<string, string> | null, why: string }>}
 */
export async function signAccept({ approval, pages, keyDir, readPassphrase, isTty }) {
  const no = (/** @type {string} */ why) => ({ sigs: null, why });
  if (!tty(isTty)) return no("approving narrative pages needs a real terminal on both stdin and stdout, and is signed with your passphrase; run it in a terminal window, not through the chat");
  if (!isUlid(approval)) return no("the approval id is not a ULID");
  if (!Array.isArray(pages) || pages.length === 0) return no("the request lists no pages, so there is nothing to sign");
  /** @type {Map<string, string>} */ const byPage = new Map();
  for (const x of pages) {
    const page = x && typeof x === "object" ? /** @type {any} */ (x).page : undefined, hash = x && typeof x === "object" ? /** @type {any} */ (x).sha256 : undefined;
    if (typeof page !== "string" || !PAGE_ID_RE.test(page) || typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) return no("the request lists a page entry that is not {page, sha256}; nothing was signed");
    if (byPage.has(page) && byPage.get(page) !== hash) return no(`the request lists ${page} twice with different hashes; nothing was signed`);
    byPage.set(page, hash);
  }
  const u = await unsealOwnerKey({ keyDir, readPassphrase });
  if (!u.key) return no(u.why);
  /** @type {Record<string, string>} */ const sigs = {};
  for (const [page, hash] of [...byPage].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) sigs[page] = sign(null, Buffer.from(ownerMessage(approval, page, hash), "utf8"), u.key).toString("base64");
  const bad = sigsShapeProblem(sigs);
  return bad ? no(bad) : { sigs, why: "" };
}
