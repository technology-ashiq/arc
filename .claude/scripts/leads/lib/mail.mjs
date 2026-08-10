// mail.mjs — the POLICY layer for arc's own notification mail (ADR-0415).
//
// `deps.mjs` carries the transport. This module carries the two rules that make it safe to
// send from the product domain at all, and both are code with fixtures rather than sentences in
// an ADR:
//
//   1. ALLOWLIST. The recipient must be on `ARC_LEADS_MAIL_ALLOWLIST`, checked before any
//      network call. This is the whole reason the PRODUCT domain can carry a send path:
//      ADR-0402 keeps the outreach path off the product domain, and this keeps the product
//      domain off strangers. Neither rule is a judgement call at runtime.
//   2. QUOTA. Resend's free tier is 100/day and 3,000/month on one domain. Past it the vendor
//      429s, and a NOTIFICATION path that stops silently is worse than no notifications at
//      all — the operator would read silence as "nothing broke".
//
// Deliberately NOT here, per ADR-0415: a spine event kind. A notification is the postman, not
// the news. The fact it carries — the canary failed, the phase closed, an approval is waiting —
// already has its own receipt, and emitting `mail.sent` would double spine volume to record
// the delivery of something already recorded.
//
// This module must not import the outreach path (`sequencer.mjs`, `guard.mjs`, `journal.mjs`,
// `drafts.mjs`, `personalization.mjs`, `replies.mjs`, `preflight.mjs`, `ingest.mjs`). Sharing
// `deps.mjs` — the dumb transport shelf every dependency in this lane sits on — is not the
// coupling ADR-0402 forbids; sharing the outreach POLICY would be.

import { appendFileSync, readFileSync, chmodSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { normalizeEmail, STORE_FILE_MODE } from "./store.mjs";
import { istDay } from "./caps.mjs";
import { mailer } from "./deps.mjs";

// Free-tier ceilings (ADR-0415, checked 2026-08-08). These are the VENDOR's numbers, so they
// are a ceiling this code refuses to cross rather than a target it aims at: crossing them
// means the vendor refuses, and the refusal arrives as a 429 that reads like transient noise.
export const DAILY_CAP = 100;
export const MONTHLY_CAP = 3000;

export const MAIL_LOG = "mail-log.jsonl";

export class MailRefusal extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "MailRefusal";
    this.kind = kind; // see MAIL_EXIT for the closed set
  }
}

// The kind-to-exit-code map lives HERE, beside the throws, and the CLI imports it. It was
// previously a `MAIL_REFUSED` constant that no caller read while the CLI hardcoded its own
// numbers — two derivations of one value free to disagree silently (D5).
//
// The split that matters is `log` versus `sent-unlogged`. Both are logging failures and they
// mean opposite things to a caller: `log` is a pre-send refusal, so nothing was delivered and a
// retry is correct; `sent-unlogged` means the mail IS in the recipient's inbox and a retry
// sends a second copy. Sharing one exit code made "retry" and "never retry" indistinguishable.
export const MAIL_EXIT = Object.freeze({
  config: 2,          // misconfiguration — nothing was attempted
  allowlist: 3,       // refused by a gate — nothing was attempted
  quota: 3,           // refused by a gate — nothing was attempted
  log: 3,             // refused BEFORE the send because the log was unreadable — safe to retry
  "sent-unlogged": 5, // the mail WAS delivered and the log write failed — never retry
});

// ---------- what a credential file may NOT carry ----------

// `.env.local` carries CREDENTIALS. It may not carry the doors that decide whether a send is
// real, when "today" is, where the store lives, or which host receives the Bearer token.
//
// The CLI's startup guard runs at module evaluation, BEFORE `.env.local` is read, so without
// this list a file holding `ARC_LEADS_FAKE=1` walks straight past it and switches the
// notification path to the fake: "mail sent", exit 0, nothing delivered — the silent no-op this
// whole module exists to prevent. `ARC_LEADS_NOW` would rebucket the daily cap onto a fabricated
// day and stamp every log line with it. `ARC_LEADS_MAIL_BASE_URL` would send
// `Authorization: Bearer <key>` to a host of the file's choosing.
//
// It lives here, next to the rules it protects, rather than in the CLI, so it can be tested
// without writing a `.env.local` into a real repository root.
export const ENV_LOCAL_FORBIDDEN = Object.freeze([
  "ARC_LEADS_FAKE",
  "ARC_LEADS_NOW",
  "ARC_LEADS_STORE",
  "ARC_LEADS_MAIL_BASE_URL",
  "LEADS_FIXTURE_DIR",
]);

// CASE-FOLDED, because `process.env` IS on Windows and this list is not.
//
// `ENV_LOCAL_FORBIDDEN.includes(n)` was an exact match, so a `.env.local` carrying
// `arc_leads_fake=1` passed the guard untouched — and then `env["arc_leads_fake"] = "1"` set
// `ARC_LEADS_FAKE` for the whole process, because Node's environment object folds case on
// Windows. Verified on this box: `usingFakes()` false before the load, true after, with the
// guard reporting nothing to refuse. That is the exact outcome this list exists to prevent,
// reachable on the windows CI leg and on the owner's machine by changing the shift key.
//
// Folded rather than "also check the lowercase spelling": the failing variant set is every
// mixed case of five names, not two spellings of them (D1 — a grammar pinned to one form).
const FORBIDDEN_UPPER = ENV_LOCAL_FORBIDDEN.map((n) => n.toUpperCase());

export function assertEnvLocalNames(names = [], fileLabel = ".env.local") {
  const smuggled = names.filter((n) => FORBIDDEN_UPPER.includes(String(n).toUpperCase()));
  if (smuggled.length)
    throw new MailRefusal("config", `${fileLabel} sets ${smuggled.join(", ")} — refused. That file is for credentials; these variables decide whether a send is real, which day the cap buckets to, where the store lives, and which host receives the key, and they are refused from a file precisely because the startup guard runs before the file is read and cannot see them there.`);
  return names;
}

// ---------- the house timestamp grammar ----------

// `istDay` slices the first ten characters and `mailIdemKey` slices the first sixteen. Both
// silently accept anything longer, so an unvalidated `nowTs` is two bugs at once: a date-only
// string collapses every notification that day onto ONE idempotency key (the vendor dedups
// them and every mail after the first is silently discarded), and a `...Z` offset buckets
// 5h30m of every day into the wrong IST day and, at a month boundary, the wrong month.
//
// The CLI already validates `ARC_LEADS_NOW` against exactly this grammar because "it buckets
// the daily cap". The function parameter that feeds the same buckets had no equivalent check —
// the guard applied at one door and omitted at the adjacent one (D6).
const IST_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/;

export function assertTimestamp(nowTs) {
  const s = String(nowTs == null ? "" : nowTs);
  if (!IST_TS_RE.test(s))
    throw new MailRefusal("config", "the timestamp is not in the house grammar YYYY-MM-DDTHH:MM:SS+05:30 — refusing, because a shorter or differently-offset value buckets the daily cap wrong and collapses distinct notifications onto one idempotency key");
  return s;
}

// ---------- allowlist ----------

// `normalizeEmail` is imported from store.mjs and NOT reimplemented, which matters more than
// it looks. That function is what `leadId` hashes, so it is the definition of address identity
// everywhere else in this lane — NFC plus zero-width stripping plus trim plus lowercase. A
// second normalizer here would disagree with it on exactly the inputs an attacker chooses: a
// zero-width space inside an allowlisted address would be a different string to a naive
// comparison and the same person to the suppression ledger.
//
// (`research-lint.mjs` has its own `normKey` that does NFC+trim+lowercase WITHOUT the
// zero-width strip. That divergence is real and predates this module; it is reported rather
// than quietly patched here, because a fix outside this phase belongs in `/arc-change`.)
export function loadAllowlist(env = process.env, varName = "ARC_LEADS_MAIL_ALLOWLIST") {
  const raw = env[varName];
  if (raw === undefined || String(raw).trim() === "")
    throw new MailRefusal("config", `${varName} is unset — refusing to send. An empty allowlist is not "everyone", it is "nobody", and that is the only safe reading of a missing guard.`);
  const list = String(raw).split(",").map((s) => normalizeEmail(s)).filter((s) => s !== "");
  if (list.length === 0)
    throw new MailRefusal("config", `${varName} is set but holds no usable address`);
  return new Set(list);
}

export function assertAllowed(to, allowlist) {
  const norm = normalizeEmail(to == null ? "" : to);
  if (norm === "") throw new MailRefusal("allowlist", "no recipient given");
  if (!allowlist.has(norm))
    // The address is NOT echoed. An allowlist refusal is exactly the event most likely to be
    // read out of a CI log by someone who should not have the address, and the operator
    // already knows which address they typed.
    throw new MailRefusal("allowlist", "recipient is not on the mail allowlist — refused before any network call (ADR-0415). The address is not echoed here; check ARC_LEADS_MAIL_ALLOWLIST in .env.local.");
  return norm;
}

// ---------- quota ----------

export function mailLogPath(storeDir) {
  return join(storeDir, MAIL_LOG);
}

// Returns { day, month, malformed } — counts, never the entries themselves. The log holds
// recipient addresses and lives in the ADR-0410 private store for that reason; a caller that
// only needs a number must not be handed the addresses to get it.
export function readQuota(storeDir, nowTs) {
  const path = mailLogPath(storeDir);

  // ONE read decides both questions. The first version asked `existsSync` and then read, which
  // reintroduced the fail-open this function exists to prevent, one line above the branch that
  // prevents it: `existsSync` answers false for EVERY error, not only for "absent" — a parent
  // that is a file, EACCES when the directory is not listable, ELOOP, a dangling symlink — and
  // each of those was answered with "nothing sent today, here is the full allowance".
  //
  // ENOENT alone is NOT enough to conclude "absent", and this is the cross-platform trap: with
  // a regular file where the store directory should be, Linux and macOS report ENOTDIR while
  // Windows reports ENOENT for the very same broken path. Trusting the code would have failed
  // closed on two legs and open on the third — the invisible-on-the-box-that-wrote-it divergence
  // this repo keeps getting caught by. So ENOENT is confirmed against the DIRECTORY: if the
  // store is not a listable directory, the log is unreadable, not absent.
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    const code = (e && e.code) || e.message;
    if (code === "ENOENT") {
      let st = null;
      try { st = statSync(storeDir); } catch (e2) {
        throw new MailRefusal("log", `the mail log could not be read: the store directory itself is unreadable (${(e2 && e2.code) || e2.message}) — refusing to send rather than assuming the day is empty`);
      }
      if (!st.isDirectory())
        throw new MailRefusal("log", "the mail log could not be read: the store path is not a directory — refusing to send rather than assuming the day is empty");
      return { day: 0, month: 0, malformed: 0 };
    }
    throw new MailRefusal("log", `the mail log at ${MAIL_LOG} could not be read (${code}) — refusing to send rather than assuming the day is empty`);
  }

  const today = istDay(nowTs);
  const thisMonth = today.slice(0, 7);
  let day = 0, month = 0, malformed = 0;

  for (const line of text.split(/\r?\n/)) {
    // Only a TRULY empty line is skipped, which is the trailing newline every append leaves.
    // Skipping `line.trim() === ""` also exempted spaces, tabs and NBSP — an entire class of
    // unreadable line — from the consumed-a-send rule below, so a log corrupted to blanks
    // silently restored the whole day's allowance.
    if (line === "") continue;
    let rec = null;
    try { rec = JSON.parse(line); } catch { rec = null; }
    // A line we cannot read still CONSUMED a send when it was written. Counting it toward both
    // buckets is the conservative direction: it lowers the remaining allowance. Skipping it —
    // the obvious implementation — would let a corrupted log silently restore quota, which is
    // the same fail-open shape as the unreadable-file branch above.
    if (!rec || typeof rec.ts !== "string") { malformed++; day++; month++; continue; }
    let d;
    try { d = istDay(rec.ts); } catch { malformed++; day++; month++; continue; }
    if (d === today) day++;
    if (d.slice(0, 7) === thisMonth) month++;
  }
  return { day, month, malformed };
}

export function assertQuota(storeDir, nowTs, caps = { daily: DAILY_CAP, monthly: MONTHLY_CAP }) {
  const q = readQuota(storeDir, nowTs);
  if (q.day >= caps.daily)
    throw new MailRefusal("quota", `daily mail quota reached: ${q.day} of ${caps.daily} already sent on ${istDay(nowTs)} IST. Refusing LOUDLY rather than dropping the message — a notification that vanishes reads as "nothing broke".`);
  if (q.month >= caps.monthly)
    throw new MailRefusal("quota", `monthly mail quota reached: ${q.month} of ${caps.monthly} sent this month. Refusing LOUDLY rather than dropping the message.`);
  return q;
}

// ---------- the secret must not travel by argv ----------

// argv is world-readable in `ps` on every leg, lands in shell history, and is captured verbatim
// by CI job logs. `caps.mjs` already refuses cap overrides arriving this way; this is the same
// door for the credential.
export function assertKeyNotInArgv(argv = process.argv, env = process.env) {
  const actual = env.RESEND_API_KEY;
  for (const arg of argv) {
    const a = String(arg);
    if (actual && actual.length >= 8 && a.includes(actual))
      throw new MailRefusal("config", "the Resend API key was passed on the command line — refused. It belongs in .env.local and nowhere else: argv is visible in `ps`, in shell history, and verbatim in CI logs.");
    // Shape check as well as value check, because the value check only catches the key we
    // already hold. Someone pasting a DIFFERENT key on the command line is making the same
    // mistake and gets the same refusal.
    //
    // UNANCHORED on purpose. The first version required `^`, `=` or whitespace before the
    // token, which caught `--key=re_...` — the one shape its test used — and let through
    // `{"RESEND_API_KEY":"re_..."}`, `--key:re_...`, `-Hre_...`, `[re_...]` and `x,re_...`,
    // five of ten realistic shapes (D2). A key is a leak wherever in the argument it sits, so
    // its position must not be part of the test.
    if (/re_[A-Za-z0-9_-]{16,}/.test(a))
      throw new MailRefusal("config", "something shaped like a Resend API key was passed on the command line — refused. Put it in .env.local; argv is visible in `ps`, in shell history, and verbatim in CI logs.");
  }
}

// ---------- send ----------

// Deterministic, so a crash-retry inside the vendor's 24-hour idempotency window resolves to
// the same send instead of a duplicate. Minute granularity is the deliberate trade: a retry
// seconds later dedups, while a genuine second send of the same brief a minute later is
// allowed through. Anything coarser would swallow real repeats; anything finer would stop
// deduplicating the crash it exists for.
//
// The fields are LENGTH-PREFIXED rather than joined on a separator. Any separator has to be a
// character the fields cannot contain, and the first version used a raw NUL byte typed
// literally into the source — invisible in every editor and diff, and enough to make ripgrep
// classify this file as binary and stop printing its lines to review tooling. Length prefixes
// are injective for every possible field content, so no character is load-bearing and nothing
// invisible is holding the property up. `store.mjs` states the rule this violated: control
// characters are written as escapes, never as literal bytes.
export function mailIdemKey({ to, subject, text, nowTs, kind = "notify" }) {
  const minute = String(nowTs).slice(0, 16); // YYYY-MM-DDTHH:MM
  const parts = [normalizeEmail(to), String(subject), String(text), minute];
  const preimage = parts.map((p) => `${p.length}:${p}`).join("");
  const digest = createHash("sha256").update(preimage, "utf8").digest("hex").slice(0, 32);
  return `${kind}/${digest}`;
}

export async function sendNotification({ to, subject, text, kind = "notify" }, { storeDir, nowTs, env = process.env, argv = process.argv } = {}) {
  // Order is the specification, not an implementation detail. Every refusal below happens
  // before the transport is touched, which is what lets the allowlist test assert "refused
  // before any network call" by pointing the base URL at somewhere unreachable and demanding
  // an allowlist refusal rather than a transport error.
  assertKeyNotInArgv(argv, env);
  assertTimestamp(nowTs);

  const from = env.ARC_LEADS_MAIL_FROM;
  if (!from || String(from).trim() === "")
    throw new MailRefusal("config", "ARC_LEADS_MAIL_FROM is unset — set it in .env.local (see .env.example). It must be an address on a domain verified with the vendor.");
  if (!subject || String(subject).trim() === "")
    throw new MailRefusal("config", "refusing to send a mail with no subject");

  const allowlist = loadAllowlist(env);
  const recipient = assertAllowed(to, allowlist);
  assertQuota(storeDir, nowTs);

  const idem_key = mailIdemKey({ to: recipient, subject, text, nowTs, kind });
  const ack = await mailer().send({ to: recipient, from: String(from).trim(), subject, text, idem_key });

  // The log is written only AFTER an ack, so a refused or crashed send never consumes quota.
  // The reverse order would be safer against double-sends and is wrong here: the vendor's
  // idempotency key already covers the double-send, and a log entry for a mail that never
  // left would silently shrink the allowance every time the vendor was unreachable.
  appendMailLog(storeDir, { ts: nowTs, to: recipient, id: ack.id, kind });
  return { id: ack.id, to: recipient, idem_key };
}

export function appendMailLog(storeDir, entry) {
  const path = mailLogPath(storeDir);
  try {
    appendFileSync(path, JSON.stringify(entry) + "\n", { mode: STORE_FILE_MODE });
    // `mode` on appendFileSync is consulted only when the file is CREATED, so a log that
    // already exists — restored from a backup, made under a looser umask, or created by a test
    // harness with `printf ""` — keeps whatever mode it had and the private-mode claim quietly
    // stops being true. This file holds every notified recipient address, so the mode is
    // re-asserted on every append. Windows has no POSIX mode bits and ignores this; the leg
    // that can enforce it is the leg that does.
    try { chmodSync(path, STORE_FILE_MODE); } catch { /* not enforceable on this platform */ }
  } catch (e) {
    // The mail HAS been delivered at this point. Saying so is the whole content of this error:
    // a caller that reads it as "the send failed" and retries would send a second copy, and a
    // caller that never hears about it would run with a quota count that is quietly low. It is
    // a DIFFERENT kind from the pre-send `log` refusal for exactly that reason — see MAIL_EXIT.
    throw new MailRefusal("sent-unlogged", `the mail WAS SENT (id ${entry.id}) but the delivery log could not be written (${e.code || e.message}) — do not retry this send; the quota count is now under-reporting by one`);
  }
}
