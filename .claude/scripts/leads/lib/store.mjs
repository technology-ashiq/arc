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
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

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
export function assertOutsideRepo(repoRoot, p = storePath()) {
  const root = resolve(repoRoot);
  const store = resolve(p);
  if (store === root || store.startsWith(root + sep))
    throw new StoreError(
      "STORE_INSIDE_REPO",
      `store resolves to ${store}, which is inside the repository at ${root} — lead PII must never live where git can track or clean it (ADR-0410)`
    );
  return store;
}

const SECRET_RE = /^secret\.v(\d+)$/;

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
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "dossiers"), { recursive: true });
  const existing = secretFiles(dir);
  if (existing.length > 0)
    throw new StoreError(
      "STORE_ALREADY_INITIALISED",
      `store at ${dir} already holds secret.v${existing[existing.length - 1].version} — refusing to clobber. ` +
        `Overwriting a secret orphans every lead_id derived under it, including suppressions whose dossier was purged.`
    );
  const secret = randomBytes(32);
  writeFileSync(join(dir, "secret.v1"), secret.toString("hex"), { mode: 0o600 });
  const storeId = randomBytes(8).toString("hex");
  writeFileSync(join(dir, "store_id"), storeId, { mode: 0o600 });
  return { dir, storeId, version: 1 };
}

// Rotation ADDS a version. It never removes one -- see the module header.
export function rotateSecret({ repoRoot } = {}) {
  const store = openStore({ repoRoot });
  const next = store.current.version + 1;
  writeFileSync(join(store.dir, `secret.v${next}`), randomBytes(32).toString("hex"), { mode: 0o600 });
  return { dir: store.dir, version: next };
}

export const normalizeEmail = (email) => String(email).trim().toLowerCase();

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

// sha256 of the ENCODED secret string (what is on disk), not the raw bytes -- pinned so the
// fingerprint is reproducible from the file without knowing the encoding convention.
export function fingerprint(store) {
  return createHash("sha256").update(store.current.secret.toString("hex"), "utf8").digest("hex").slice(0, 8);
}
