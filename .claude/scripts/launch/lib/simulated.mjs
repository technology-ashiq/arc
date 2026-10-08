// The simulated path (REQ-04, ADR-1739): a test-mode payment the webhooks-ledger slot found stored on the venture becomes
// exactly one `revenue.simulated`. It goes through the ledger's own razorpay parser and normalizer, so the ledger's money
// invariants run on it, and then through `arc-event ingest`, whose idem is the payment's content. `ledger-ingest.mjs`
// is not called: it is plan-bound and writes only `revenue.received`.
//
// Called by the runner, inside the venture lock, for each `revenue.simulated` an apply attempt queued. Synchronous, like
// the rest of the runner: the spine is read with the reader's own scan.
import { join } from "node:path";
import { parseRazorpayExport } from "../../hq/lib/ledger/parsers/razorpay.mjs";
import { normalizeRow } from "../../hq/lib/ledger/normalize.mjs";
import { formatIst } from "../../hq/lib/canonical.mjs";
import { scanAll, spineRoot } from "../../hq/spine.mjs";
import { emitReceipt } from "../../core/plan-expect.mjs";
import { ROOT } from "./catalog.mjs";

const ARC_EVENT = join(ROOT, ".claude", "scripts", "hq", "arc-event.mjs");
const KIND = "revenue.simulated";
// The parser's pinned header (parsers/razorpay.mjs COL). Built here as one row; the parser decides whether it is money.
const HEADER = ["record_type", "payment_id", "settlement_id", "gross_amount", "fee", "tax", "net_amount", "currency", "settled_at"];
const PAY = /^pay_[A-Za-z0-9]{6,40}$/;
const RFND = /^rfnd_[A-Za-z0-9]{6,40}$/;

const int = (v) => (typeof v === "number" ? v : typeof v === "string" && /^[0-9]{1,15}$/.test(v) ? Number(v) : NaN);
// Minor units to the export's decimal spelling, by string, never by float: 100 -> "1.00".
const decimal = (minor) => { const d = String(minor).padStart(3, "0"); return `${d.slice(0, -2)}.${d.slice(-2)}`; };

/**
 * The payload and IST stamp a stored payment books as, or a thrown Error naming why it cannot be money.
 * @param {string} venture @param {{ payment_id: string, amount: unknown, fee: unknown, currency: string, paid_at: unknown }} p
 */
export function simulatedPayload(venture, p) {
  if (!p || typeof p !== "object") throw new Error("the queued payment is not an object");
  // A refund is its own positive line naming the charge it returns (ADR-1016): its id is the refund's, never the charge's.
  const refund = "refund_of" in p;
  if (refund && (typeof p.refund_of !== "string" || !PAY.test(p.refund_of))) throw new Error("the queued refund names no Razorpay payment it refunds");
  if (typeof p.payment_id !== "string" || !(refund ? RFND : PAY).test(p.payment_id)) throw new Error(`the queued ${refund ? "refund has no Razorpay refund" : "payment has no Razorpay payment"} id`);
  const amount = int(p.amount);
  const fee = int(p.fee);
  const paid = int(p.paid_at);
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error(`payment ${p.payment_id} has no positive amount`);
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > amount) throw new Error(`payment ${p.payment_id} has a fee that is not 0..amount`);
  if (!Number.isSafeInteger(paid) || paid < 1) throw new Error(`payment ${p.payment_id} has no paid_at`);
  // A foreign currency needs a recorded rate (ADR-1003) and a test payment carries none.
  if (p.currency !== "INR") throw new Error(`payment ${p.payment_id} is in ${String(p.currency).slice(0, 8)}, and a simulated line is INR only`);
  // Razorpay's fee already holds the GST on the fee, and a gateway collects no sales tax on the order: tax is 0.
  // A test payment never settles, so its settlement column says so.
  const row = ["payment", p.payment_id, "simulated", decimal(amount), decimal(fee), "0.00", decimal(amount - fee), "INR", formatIst(paid * 1000)];
  const rows = parseRazorpayExport(`${HEADER.join(",")}\n${row.join(",")}\n`);
  if (rows.length !== 1) throw new Error(`the ledger parser read ${rows.length} rows from one payment`);
  const n = normalizeRow(rows[0], { venture, interval: "one_time" });
  if (refund) n.payload.refund_of = `${n.payload.provider}:${p.refund_of}`;
  return n;
}

/**
 * Books one stored payment as `revenue.simulated` once. Returns { state, id, why }:
 *   landed    recorded now
 *   recorded  already on the spine for this venture (a replay, a second verify, a re-apply) -- nothing written
 *   refused   the ledger, the spine or this path refused it -- nothing written
 *   unknown   the emitter started and its outcome is not known; a re-apply finds it if it landed
 * @param {string} venture @param {object} payment @param {{ process: string }} o
 */
export function recordSimulated(venture, payment, { process: proc }) {
  let n;
  try { n = simulatedPayload(venture, payment); } catch (e) { return { state: "refused", id: null, why: `the ledger would not book it: ${e.message}` }; }
  let root;
  try { root = spineRoot(); } catch (e) { return { state: "refused", id: null, why: `the spine cannot be found (${e.code || "error"})` }; }
  const { events, torn, unreadable } = scanAll(root);
  // A day the reader cannot read may hold this payment: "not on the spine" is never read from it.
  if (torn.length || unreadable.length) return { state: "refused", id: null, why: "the spine has a torn or unreadable day, so whether this payment is booked is unknown" };
  const key = n.payload.provider_payment_id;
  const held = events.map((r) => r.event).find((e) => e && e.kind === KIND && e.payload && e.payload.provider_payment_id === key);
  if (held) {
    if (held.venture !== venture) return { state: "refused", id: null, why: `payment ${key} is already booked for ${String(held.venture).slice(0, 64)}, not ${venture}` };
    return { state: "recorded", id: held.id, why: null };
  }
  // A refund of a charge this venture never booked would sit on the spine as the P&L's REFUND_WITHOUT_CHARGE, unnetted.
  if (n.payload.refund_of) {
    const charge = events.map((r) => r.event).find((e) => e && e.kind === KIND && e.payload && e.payload.provider_payment_id === n.payload.refund_of && !("refund_of" in e.payload));
    if (!charge || charge.venture !== venture) return { state: "refused", id: null, why: `refund ${key} names charge ${n.payload.refund_of}, which is not booked as simulated for ${venture}` };
    // Every refund already booked against the charge counts: two partial refunds may not sum past it.
    const before = events.map((r) => r.event).filter((e) => e && e.kind === KIND && e.payload && e.payload.refund_of === n.payload.refund_of).reduce((s, e) => s + e.payload.amount, 0);
    if (before + n.payload.amount > charge.payload.amount) return { state: "refused", id: null, why: `refund ${key} brings ${n.payload.refund_of}'s refunds to ${before + n.payload.amount}, more than its charge's ${charge.payload.amount}` };
  }
  const got = emitReceipt(ARC_EVENT, KIND, n.payload, { cwd: ROOT, env: { ...process.env, ARC_SPINE_ROOT: root }, command: "ingest", flags: ["--venture", venture, "--process", proc], timeoutMs: 60000 });
  if (got.state === "landed") return { state: "landed", id: got.id, why: got.why };
  // The content idem is the second lock: a duplicate it caught is the same payment, already booked.
  if (got.state === "refused" && /DUP_IDEM/.test(String(got.why))) return { state: "recorded", id: null, why: null };
  return { state: got.state, id: null, why: String(got.why || "the emitter gave no reason").slice(0, 200) };
}
