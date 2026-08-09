// store.mjs — the private store, which lives OUTSIDE the repository directory (ADR-0410).
//
// Why outside, not a gitignored directory inside the worktree:
//
//   1. The repo is headed public and git history is forever. An ignored directory is one
//      .gitignore regression or one `git add -f` from a permanent leak.
//   2. `git clean -xfd` DELETES ignored files. It is a routine command. Lead data must never
//      live anywhere git considers disposable.
//
// The risk runs in BOTH directions, which is why isolation is by location and not by rule.
//
// This module also owns the HMAC keyring. Two properties there are load-bearing:
//
//   - the secret is minted by exactly ONE explicit command and never auto-created. A silent
//     mint changes every lead_id, so the suppression ledger matches nothing and a person who
//     unsubscribed gets contacted again.
//   - rotation is ADDITIVE. `secret.v1` is never retired. ADR-0400's first draft said rotation
//     re-derives ids "from dossier emails" -- but ADR-0410 PURGES the dossier on a
//     delete-on-request, so the retained v1 hmac is the only surviving trace of that
//     suppression. Retiring a key silently un-suppresses exactly the people who asked to be
//     forgotten.

import { createHmac, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep, dirname, basename } from "node:path";

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StoreError";
  }
}

// Resolution is env-first with an os.homedir() default -- NEVER a literal "~".
// POSIX sh does not expand ~ inside a variable, and the Windows leg's HOME and USERPROFILE
// differ, so a literal tilde is a path that silently resolves to a directory named "~".
export function storePath() {
  const fromEnv = process.env.ARC_LEADS_STORE;
  const p = fromEnv && fromEnv.trim() ? fromEnv.trim() : join(homedir(), ".arc", "leads");
  return resolve(p);
}

// The store must not sit inside the repo. Checked at every resolution rather than once at
// init, because the env var is mutable and a later run could point it at the tree.
// Containment is checked on the REAL path, case-folded, with Windows prefixes stripped.
// A lexical byte-exact `startsWith` was bypassable four confirmed ways, and every one of them
// lands the store physically inside the worktree where `git clean -xfd` deletes it:
//
//   case      `c:\users\...\arc-leads\leadstore`  -- accepted on the two case-insensitive legs
//   symlink   a junction/symlink pointing INTO the repo -- resolve() is lexical only
//   UNC       `\\localhost\C$\...\arc-leads\leadstore`  -- honoured by node:fs
//   extended  `\\?\C:\...\arc-leads\leadstore`          -- likewise
//
// realpath is applied to the nearest EXISTING ancestor, because the store directory itself may
// not exist yet on the `store init` path.
function realOf(p) {
  // Strip the Windows prefixes FIRST. Doing it after realpath left `\\?\C:\...` and
  // `\\localhost\C$\...` accepted, because realpathSync preserves the spelling it was given
  // and the comparison then had two different-looking strings for one directory. Normalise
  // the INPUT, then resolve it.
  let cur = resolve(stripWinPrefix(String(p)));
  const tail = [];
  for (;;) {
    try { return join(realpathSync.native(cur), ...tail.reverse()); }
    catch {
      const parent = dirname(cur);
      if (parent === cur) return resolve(p); // reached the root with nothing real; lexical is all there is
      tail.push(basename(cur));
      cur = parent;
    }
  }
}

// Windows accepts several spellings of one path. Normalise them to one before comparing.
const stripWinPrefix = (s) =>
  s.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "").replace(/^\\\\localhost\\([A-Za-z])\$/i, "$1:");

// Case-fold only where the filesystem does. Folding on ubuntu would REJECT a legitimately
// distinct path, which is its own bug.
const CASE_INSENSITIVE_FS = process.platform === "win32" || process.platform === "darwin";

// Win32 STRIPS trailing dots and spaces from every path component, so `C:\repo.\store` and
// `C:\repo \store` both open `C:\repo\store`. `realpathSync.native` FAILS on those spellings
// (libuv long-paths them, which disables exactly that normalisation), so `realOf` falls back
// to the lexical string and the prefix comparison missed — a fifth bypass alongside the four
// this header already lists. The store then landed in a directory that Explorer, `cmd` and
// `git` all normalise away and cannot open, which means ADR-0410's delete-on-request purge,
// spelling the path normally, would never find it either.
const stripWinTrailers = (s) =>
  process.platform === "win32" ? s.replace(/[. ]+(?=[\\/]|$)/g, "") : s;

const cmpForm = (s) => {
  const t = stripWinTrailers(stripWinPrefix(s)).replace(/[\\/]+$/, "");
  return CASE_INSENSITIVE_FS ? t.toLowerCase() : t;
};

// The containment TEST, separated from the store's refusal so that every other path-outside-
// the-repo rule reuses this exact comparison instead of growing its own. Phase 02's
// `ingest-reply --file` is the second caller, and a second hand-written comparison there would
// have shipped all four bypasses above again — "validate one read, compare another" (D5) is
// the defect class, and one function with two callers is what closes it.
//
// Returns the resolved real path alongside the verdict, because callers want to name the
// resolved path in their refusal rather than the string the user typed.
export function isInsideRepo(repoRoot, p) {
  const root = realOf(repoRoot);
  const target = realOf(p);
  const r = cmpForm(root);
  const s = cmpForm(target);
  return { inside: s === r || s.startsWith(r + sep) || s.startsWith(r + "/"), resolved: target, root };
}

export function assertOutsideRepo(repoRoot, p = storePath()) {
  const { inside, resolved, root } = isInsideRepo(repoRoot, p);
  if (inside)
    throw new StoreError(
      "STORE_INSIDE_REPO",
      `store resolves to ${resolved}, which is inside the repository at ${root} — lead PII must never live where git can track or clean it (ADR-0410)`
    );
  return resolved;
}

// Canonical version only. `secret.v01` and `secret.v1` both parsed to 1, so `leadId(store,
// email, 1)` resolved to whichever readdirSync happened to return first -- non-deterministic
// across the three-OS matrix, and two different secrets both minting ids labelled v1.
const SECRET_RE = /^secret\.v([1-9][0-9]*)$/;

function secretFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => [f, SECRET_RE.exec(f)])
    .filter(([, m]) => m)
    .map(([f, m]) => ({ file: f, version: Number(m[1]) }))
    .sort((a, b) => a.version - b.version);
}

// Every entry point that is not `store init` calls this. It never creates anything.
export function openStore({ repoRoot } = {}) {
  const dir = repoRoot ? assertOutsideRepo(repoRoot) : storePath();
  const keys = secretFiles(dir);
  if (!existsSync(dir) || keys.length === 0)
    throw new StoreError(
      "STORE_NOT_INITIALISED",
      `store not initialised — check ARC_LEADS_STORE (resolved to ${dir}). Run \`arc-leads store init\`. ` +
        `Nothing is auto-created: a silent mint would change every lead_id and void the suppression ledger.`
    );
  const idPath = join(dir, "store_id");
  if (!existsSync(idPath))
    throw new StoreError("STORE_NOT_INITIALISED", `store at ${dir} has secrets but no store_id — refusing a half-initialised store`);

  const keyring = keys.map((k) => ({
    version: k.version,
    secret: Buffer.from(readFileSync(join(dir, k.file), "utf8").trim(), "hex"),
  }));
  for (const k of keyring)
    if (k.secret.length !== 32)
      throw new StoreError("BAD_SECRET", `secret.v${k.version} is not 32 bytes of hex — refusing rather than deriving ids under a truncated key`);

  return {
    dir,
    storeId: readFileSync(idPath, "utf8").trim(),
    keyring,
    // The CURRENT key is the highest version -- what new ids are minted under.
    current: keyring[keyring.length - 1],
  };
}

export function initStore({ repoRoot } = {}) {
  const dir = repoRoot ? assertOutsideRepo(repoRoot) : storePath();
  // 0700, not the 0755 default. The secret was hardened to 0600 while the dossiers it
  // protects -- the actual names and emails -- were world-readable on ubuntu and macos.
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  mkdirSync(join(dir, "dossiers"), { recursive: true, mode: 0o700 });
  const existing = secretFiles(dir);
  if (existing.length > 0)
    throw new StoreError(
      "STORE_ALREADY_INITIALISED",
      `store at ${dir} already holds secret.v${existing[existing.length - 1].version} — refusing to clobber. ` +
        `Overwriting a secret orphans every lead_id derived under it, including suppressions whose dossier was purged.`
    );
  // flag "wx" -- rotateSecret had it and initStore did not, in the same module. Two live
  // consequences: two concurrent inits both saw an empty keyring and both wrote (one secret
  // silently lost), and on a case-insensitive filesystem a `Secret.v1` slipped past the
  // case-SENSITIVE readdir scan while the case-INSENSITIVE write replaced its bytes in place.
  // That is exactly what STORE_ALREADY_INITIALISED claims to refuse.
  const secret = randomBytes(32);
  try {
    writeFileSync(join(dir, "secret.v1"), secret.toString("hex"), { mode: 0o600, flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST")
      throw new StoreError("STORE_ALREADY_INITIALISED", `a secret already exists at ${dir} (possibly under different casing) — refusing to clobber`);
    throw e;
  }
  const storeId = randomBytes(8).toString("hex");
  writeFileSync(join(dir, "store_id"), storeId, { mode: 0o600, flag: "wx" });
  return { dir, storeId, version: 1 };
}

// Rotation ADDS a version. It never removes one -- see the module header.
export function rotateSecret({ repoRoot } = {}) {
  const store = openStore({ repoRoot });
  const next = store.current.version + 1;
  // initStore refuses to clobber and names the consequence; rotate did not, which made it the
  // one path that could destroy a live secret. Two ways it bit: two concurrent rotations
  // silently lose one, and at 2^53 the increment is a no-op so `next === current` and the
  // write lands ON the live key -- orphaning every id derived under it, including suppressions
  // whose dossier was purged. That is the exact outcome additive rotation exists to prevent.
  if (!Number.isSafeInteger(next) || next <= store.current.version)
    throw new StoreError("BAD_KEY_VERSION", `cannot derive a successor to secret.v${store.current.version}`);
  const path = join(store.dir, `secret.v${next}`);
  if (existsSync(path))
    throw new StoreError("STORE_ALREADY_INITIALISED", `secret.v${next} already exists — refusing to clobber a key that ids may already be derived under`);
  writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  return { dir: store.dir, version: next };
}

// Unicode normalization is NOT optional here. Without NFC, the NFC and NFD spellings of
// "josé@firm.in" are two different HMACs, hence two lead ids, hence two identities --
// suppress one and the other stays contactable. Zero-width characters do the same thing and
// arrive routinely as copy-paste artifacts from web unsubscribe forms; `trim()` strips
// U+FEFF but not U+200B/U+200C/U+200D.
// Written as escapes, never as literal characters. A zero-width character pasted into source
// is invisible in every editor and diff — which is exactly the property that makes it a
// problem in an email, and exactly why it must not be a property of the code that removes it.
const ZERO_WIDTH_CODES = new Set([0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF]);
const stripInvisible = (s) => Array.from(s).filter((ch) => !ZERO_WIDTH_CODES.has(ch.codePointAt(0))).join("");
export const normalizeEmail = (email) =>
  stripInvisible(String(email).normalize("NFC")).trim().toLowerCase();

// The id that reaches the spine. Keyed, not a bare hash: emails are low-entropy, so
// sha256(email) is dictionary-attackable by anyone holding a public directory -- and this
// spine is going public.
export function leadId(store, email, version) {
  const key = version === undefined
    ? store.current
    : store.keyring.find((k) => k.version === version);
  if (!key) throw new StoreError("BAD_KEY_VERSION", `no secret.v${version} in the keyring`);
  const hex = createHmac("sha256", key.secret).update(normalizeEmail(email), "utf8").digest("hex");
  return `lead_hmac_v${key.version}_${hex.slice(0, 32)}`;
}

// Every id this address could EVER have had, newest key first. The suppression guard checks
// all of them: an address suppressed under v1 must stay suppressed after a rotation to v2.
export function leadIdsAllVersions(store, email) {
  return store.keyring.map((k) => leadId(store, email, k.version)).reverse();
}

// The dossier is where the address lives, and this is the ONE function that reads it.
//
// Two callers need it and they need it for opposite reasons: the send-moment guard turns it
// back into the whole keyring of ids, and the real provider hands it to the vendor. They were
// about to be two copies of the same six lines -- defect class D5, and this lane has already
// paid for it twice (validate one read, compare another). The moment one copy grew a
// normalisation the other lacked, a person would be allowlisted under one spelling and
// delivered to under another.
//
// Returns null for EVERY failure -- no dossier, unreadable JSON, absent or non-string email.
// Every caller treats null as a REFUSAL, never as "nothing to check here". The type check is
// not decoration: a number or an object here would reach normalizeEmail as String(value) and
// mint a stable id for a person who does not exist.
export function dossierEmail(store, leadId) {
  try {
    const p = join(store.dir, "dossiers", `${leadId}.json`);
    if (!existsSync(p)) return null;
    const email = JSON.parse(readFileSync(p, "utf8")).email;
    return typeof email === "string" && email.trim() !== "" ? email : null;
  } catch { return null; }
}

// sha256 of the ENCODED secret string (what is on disk), not the raw bytes -- pinned so the
// fingerprint is reproducible from the file without knowing the encoding convention.
export function fingerprint(store) {
  return createHash("sha256").update(store.current.secret.toString("hex"), "utf8").digest("hex").slice(0, 8);
}

// The mode every caller must use when writing anything into the store. Exported so the CLI
// cannot forget it independently -- the dossier and rejected.jsonl writes did.
export const STORE_FILE_MODE = 0o600;
export const STORE_DIR_MODE = 0o700;
