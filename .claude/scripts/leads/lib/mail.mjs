// mail.mjs — the POLICY layer for arc's own notification mail (ADR-0415).
//
// `deps.mjs` carries the transport. This module carries the two rules that make it safe to
// send from `automemory.ai` at all, and both are code with fixtures rather than sentences in
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

import { appendFileSync, readFileSync, existsSync } from "node:fs";
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
export const MAIL_REFUSED = 3; // matches the CLI's "refused by a gate" code

export class MailRefusal extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "MailRefusal";
    this.kind = kind; // "config" | "allowlist" | "quota" | "log"
  }
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

// Returns { day, month, unreadable } — counts, never the entries themselves. The log holds
// recipient addresses and lives in the ADR-0410 private store for that reason; a caller that
// only needs a number must not be handed the addresses to get it.
export function readQuota(storeDir, nowTs) {
  const path = mailLogPath(storeDir);
  if (!existsSync(path)) return { day: 0, month: 0, malformed: 0 };

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    // FAIL CLOSED. An unreadable log read as "zero sent today" hands back the full daily
    // allowance every time it is unreadable, which is the one direction this must never fail.
    throw new MailRefusal("log", `the mail log at ${MAIL_LOG} exists but could not be read (${e.code || e.message}) — refusing to send rather than assuming the day is empty`);
  }

  const today = istDay(nowTs);
  const thisMonth = today.slice(0, 7);
  let day = 0, month = 0, malformed = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
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
    if (/(^|[=\s])re_[A-Za-z0-9_-]{16,}/.test(a))
      throw new MailRefusal("config", "something shaped like a Resend API key was passed on the command line — refused. Put it in .env.local; argv is visible in `ps`, in shell history, and verbatim in CI logs.");
  }
}

// ---------- send ----------

// Deterministic, so a crash-retry inside the vendor's 24-hour idempotency window resolves to
// the same send instead of a duplicate. Minute granularity is the deliberate trade: a retry
// seconds later dedups, while a genuine second send of the same brief a minute later is
// allowed through. Anything coarser would swallow real repeats; anything finer would stop
// deduplicating the crash it exists for.
export function mailIdemKey({ to, subject, text, nowTs, kind = "notify" }) {
  const minute = String(nowTs).slice(0, 16); // YYYY-MM-DDTHH:MM
  const digest = createHash("sha256")
    .update([normalizeEmail(to), String(subject), String(text), minute].join(" "), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `${kind}/${digest}`;
}

export async function sendNotification({ to, subject, text, kind = "notify" }, { storeDir, nowTs, env = process.env, argv = process.argv } = {}) {
  // Order is the specification, not an implementation detail. Every refusal below happens
  // before the transport is touched, which is what lets the allowlist test assert "refused
  // before any network call" by pointing the base URL at somewhere unreachable and demanding
  // an allowlist refusal rather than a transport error.
  assertKeyNotInArgv(argv, env);

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
  } catch (e) {
    // The mail HAS been delivered at this point. Saying so is the whole content of this error:
    // a caller that reads it as "the send failed" and retries would send a second copy, and a
    // caller that never hears about it would run with a quota count that is quietly low.
    throw new MailRefusal("log", `the mail WAS SENT (id ${entry.id}) but the delivery log could not be written (${e.code || e.message}) — do not retry this send; the quota count is now under-reporting by one`);
  }
}
