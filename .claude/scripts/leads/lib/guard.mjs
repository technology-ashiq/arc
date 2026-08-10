// guard.mjs — the send-moment guard chain (ADR-0403) and the single-writer lock.
//
// THE property: approval authorizes an ATTEMPT, never a send. A human approves a draft at
// 09:00, the lead unsubscribes at 09:30, the send fires at 10:00 — and it must not go. So
// every check re-runs at the moment of send, against state derived fresh from receipts.
//
// Chain order is load-bearing and is asserted by fixture:
//
//   rehearsal-allowlist (ADR-0416, only when rehearsal is DECLARED)
//     -> campaign-state (HOLD|FROZEN) -> unresolved-intent -> ALREADY-SENT -> suppression
//     -> reply-stop -> touch-cap (rolling 7d) -> daily-cap (IST) -> send-window -> draft_sha
//
// The rehearsal step is FIRST because it is the outermost question: may this person be
// contacted at all on this run. Every step after it asks a campaign-shaped question, and
// asking those first would be asking them about a recipient we hold no permission for.
//
// The first two steps were added at kickoff by the attack panel. ADR-0403 defined HOLD/FROZEN
// and ADR-0411 defined unresolved intents, but NEITHER was in the chain — so every breaker
// fixture asserted that a receipt had been emitted rather than that a send had stopped. A
// breaker that pauses nothing is the domain-burn failure with a receipt attached.
//
// There is no mutable counter anywhere in this file, and that is deliberate: a cap you can
// reset is not a cap. Every number here is folded from receipts on each call.

import { existsSync, writeFileSync, readFileSync, unlinkSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { istDay, inSendWindow, withinRollingWindow, loadCaps, assertNoCapOverrides } from "./caps.mjs";
import { unresolvedIntents } from "./journal.mjs";
import { leadIdsAllVersions, dossierEmail } from "./store.mjs";
import { loadConfig, effectiveSendingDomain, rehearsalMode, rehearsalRecipients, REHEARSAL_ALLOWLIST_VAR } from "./preflight.mjs";
// The house timestamp grammar, imported rather than re-spelled. `sendCounts` compares window
// bounds against payload timestamps, and a second copy of that pattern here is the same D5 the
// allowlist parsers were just collapsed for.
import { assertTs, isPayloadTs } from "../../hq/lib/validate-leads.mjs";

// The dossier holds the email; this is the only place in the guard that touches it, and
// nothing downstream ever receives it. Without this, `state.suppressed.has(lead_id)` checked
// ONE id -- so after a key rotation every person who unsubscribed under the previous key
// became contactable again, which is the single worst thing this system can do.
//
// The dossier READ itself now lives in store.mjs and is shared with the real provider, which
// needs the same file for the opposite purpose. Two copies of it would be D5 the moment one
// grew a normalisation the other lacked.
//
// Returns null when it cannot resolve (no dossier, no email, or an id that does not belong to
// this store). The caller treats null as a REFUSAL, never as "no suppression found".
// EXPORTED, because `cmdDraft` needs the identical answer and was computing a weaker one.
// Its per-touch approval key was built from the single `lead_id` on the draft, which is the
// fourth adjacent branch of the D6 this function's own comment describes being fixed in three:
// after a key rotation the same human carries a v1 id on yesterday's draft and a v2 id on
// today's, so the "one approval per (campaign, lead, touch)" rule stopped seeing the first one
// and put two live approvals for one touch in the inbox. A second, narrower resolver here would
// be D5 by construction, so there is one.
export function resolveKeyringIds(store, leadId) {
  const email = dossierEmail(store, leadId);
  if (email === null) return null;
  try {
    const ids = leadIdsAllVersions(store, email);
    return ids.includes(leadId) ? ids : null;
  } catch { return null; }
}

// THE ONE CANONICAL ID FOR A HUMAN, across every key version they have ever had.
//
// A `lead_id` is one version of a keyed HMAC, so anything that keys a per-person record on the
// raw id gets a different key after a rotation — which is how one person ends up holding two
// live approvals for one thing. `cmdDraft` resolves its touch key this way; `meetingRefFor`
// hashed the raw id and did not, so a rotation minted a second meeting draft and a second
// `leads-meeting` approval for a lead whose reply had already been handled.
//
// SORTED BY VERSION NUMBER, never `ids[0]` and never a lexicographic sort of the whole string.
//
// The canonical member must not depend on the order the keyring hands them back, or a rotation
// reorders the list and every existing key silently stops matching. The first version of this
// sorted the strings — and an earlier draft of THIS COMMENT noted "it reorders for real at v10,
// which sorts before v1" as the justification for sorting at all, having looked straight at the
// bug and written it down as a feature. `lead_hmac_v10_…` sorts before `lead_hmac_v1_…` because
// `0` (0x30) is below `_` (0x5F), so the canonical member changed identity at the tenth key.
//
// `touchKey` survives that flip because both sides are recomputed in the same run. `meetingRefFor`
// does NOT: it hashes this value into a `meet_` ref that is written to disk as a filename and
// carried in the approval payload. Reproduced end to end — nine additive rotations, then the same
// reply bytes re-ingested, and the store held TWO meeting drafts and TWO undecided
// `leads-meeting` approvals for one human, at exit 0 on a line that reads like a healthy re-run.
// That is the state `drafts.mjs` calls how the wrong one gets approved, produced by the plumbing
// added to prevent it, correct for v2 through v9.
//
// The version is parsed and compared as a NUMBER, so the answer is the oldest id for every
// rotation rather than for the next nine.
//
// BUT ONLY WHEN THE CALLER PASSES AN ID THAT HAS ITS OWN DOSSIER FILE, and an earlier version of
// this sentence promised it unconditionally. `resolveKeyringIds` starts from
// `dossierEmail(store, leadId)`, so an id with no dossier resolves to `null` and this returns the
// RAW id — which after a rotation is the newest, i.e. exactly the value the numeric sort exists
// to avoid. Every production caller passes an id that came from `resolveLead`, which returns the
// id of the dossier it found, so the fallback is unreachable there; the path that could reach it
// is a stored draft whose dossier was removed (an ADR-0410 delete-on-request, a partial restore),
// and that dies first at "no dossier for …" in the incoming half. Stated because a guarantee that
// holds only under a precondition has to name the precondition.
const KEY_VERSION_RE = /^lead_hmac_v(\d+)_/;
export function canonicalLeadId(store, leadId) {
  const ids = resolveKeyringIds(store, leadId);
  if (!ids || !ids.length) return leadId;
  // An id that does not carry a parseable version sorts LAST rather than first: it cannot be
  // shown to be the oldest, and picking it would be a guess with a persisted consequence.
  const ver = (s) => { const m = KEY_VERSION_RE.exec(String(s)); return m ? Number(m[1]) : Number.POSITIVE_INFINITY; };
  return [...ids].sort((a, b) => ver(a) - ver(b) || (a < b ? -1 : a > b ? 1 : 0))[0];
}

// THE ONE PARSE OF `touch_n`, exported so there is exactly one.
//
// The send-moment guard below already compared touches as NUMBERS, for the reason its comment
// gives: `1` and `"1"` interpolate into the same idem while `===` calls them different touches.
// `cmdDraft` then built its duplicate-approval key by interpolating the raw value, so ` 1`,
// `1.0`, `+1`, `1e0` and `01` were five different keys naming one touch — five live approvals
// for one send, from a rule whose whole purpose is that there is exactly one. The fix already
// existed one file away and had simply never been called from the second place (D6), which is
// why it is a shared export now rather than a second copy with the same body.
export function normalizeTouchN(touch_n) {
  const tn = Number(touch_n);
  if (!Number.isSafeInteger(tn) || tn < 1)
    throw new GuardRefusal("bad-touch", `touch_n ${JSON.stringify(touch_n)} is not a positive integer`);
  return tn;
}

// Re-exported, not redefined. The name now lives beside the ONE parse of that variable, in
// preflight.mjs — `rehearsalMode` and this module were reading the same env var through two
// different parsers, and the operator was shown the count from the one that decides nothing.
export { REHEARSAL_ALLOWLIST_VAR };

// The allowlist, mapped forward into ID SPACE.
//
// The list holds ADDRESSES; the send path carries `draft.lead_id`, a keyed HMAC (ADR-0400).
// Resolving the draft's id back to an address in order to compare strings would put a raw
// address on the send path for the sole purpose of a comparison, and it would compare at ONE
// key version. So the addresses are mapped forward instead: every id each allowlisted address
// could EVER have had, unioned.
//
// ALL VERSIONS is the whole point, and it is the mirror image of the bug resolveKeyringIds
// above exists for. That one: checking a single id meant a rotation un-suppressed everyone who
// had unsubscribed. This one: checking a single id means that after a rotation the allowlisted
// people stop matching, so the rehearsal either refuses everything, or -- far worse -- a later
// variant reads the miss as "unknown, therefore not a rehearsal recipient, therefore fine".
export function rehearsalAllowedIds(store, env = process.env, varName = REHEARSAL_ALLOWLIST_VAR) {
  const ids = new Set();
  // `rehearsalRecipients`, not `loadAllowlist` directly: the SHAPE filter that decides whether
  // the lock exists at all must be the same filter that decides which ids are reachable. With
  // the raw list, `ARC_LEADS_REHEARSAL_ALLOWLIST=yes` contributed a keyed id for the string
  // "yes" to this set while `rehearsalMode` reported the lock as absent — two answers about one
  // variable, which is the defect this whole pair was collapsed to close.
  for (const address of rehearsalRecipients(env, varName))
    for (const id of leadIdsAllVersions(store, address)) ids.add(id);
  return ids;
}

export class GuardRefusal extends Error {
  constructor(step, message) { super(message); this.name = "GuardRefusal"; this.step = step; }
}

// ---------- single-writer lock ----------
//
// Counts are derived per send, so two `arc-leads` processes would each read 20-headroom and
// both submit. ADR-0056 forbids concurrent emitters by POLICY; this is the mechanism.
//
// A lock held by a DEAD pid is refused, never auto-broken. That process may be sitting in the
// ack-to-receipt window, and stealing its lock is exactly how a duplicate send happens.
export function acquireLock(store) {
  const p = join(store.dir, ".send.lock");
  let fd;
  try {
    fd = openSync(p, "wx");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let holder = "(unreadable)";
    try { holder = readFileSync(p, "utf8").trim(); } catch { /* fall through with the placeholder */ }
    throw new GuardRefusal(
      "lock",
      `another arc-leads process holds the send lock: ${holder}. Refusing.\n` +
        `If that process is dead, run \`arc-leads unlock\` — the lock is NEVER auto-broken, ` +
        `because a dead process may sit between the provider ack and the receipt, and stealing ` +
        `its lock is how the same mail gets sent twice (ADR-0411).`
    );
  }
  const token = `pid=${process.pid} started=${new Date().toISOString()}`;
  writeFileSync(fd, token + "\n");
  closeSync(fd);

  // The release VERIFIES IT STILL OWNS the lock before unlinking. It used to unlink by path
  // with no check at all, so any stale closure could destroy a different process's lock --
  // latent today (one call site, inside a finally) but one signal handler away from live.
  return () => {
    try {
      if (readFileSync(p, "utf8").trim() !== token) return; // someone else holds it now
      unlinkSync(p);
    } catch { /* already gone, or unreadable -- either way not ours to remove */ }
  };
}

// Is the recorded holder still running? `kill(pid, 0)` tests existence without signalling.
export function lockHolder(store) {
  const p = join(store.dir, ".send.lock");
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf8").trim();
  const m = /^pid=(\d+)/.exec(raw);
  // A 0-byte lock is a real state: a crash between openSync and writeFileSync. The refusal
  // used to print "holds the send lock: ." with no pid, so the operator could not even check
  // whether the holder was alive.
  if (!m) return { raw, pid: null, alive: null };
  const pid = Number(m[1]);
  let alive;
  try { process.kill(pid, 0); alive = true; }
  catch (e) { alive = e.code === "EPERM"; }   // EPERM: it exists and is not ours
  return { raw, pid, alive };
}

// Clearing a stale lock is a HUMAN action with a liveness check, never an automatic one.
//
// The lock was correct in the safe direction -- never auto-broken -- and had NO EXIT. There is
// no signal handler anywhere in this tree, so SIGKILL, Ctrl-C, an OOM kill or power loss all
// skip the `finally`, and nothing documented even named the file. Every future send was then
// refused forever.
//
// This refuses outright while the holder is alive, because auto-clearing is exactly how the
// lock gets stolen from a process sitting in the ack-to-receipt window. And it tells the
// operator to reconcile afterwards: a dead holder may have left an in-flight intent.
export function clearStaleLock(store) {
  const h = lockHolder(store);
  if (!h) return { cleared: false, why: "no send lock is held" };
  if (h.alive) return { cleared: false, why: `the holder is STILL RUNNING (${h.raw}) — refusing. Wait for it, or stop that process first.` };
  const p = join(store.dir, ".send.lock");
  try { unlinkSync(p); } catch (e) { if (e.code !== "ENOENT") throw e; }
  return {
    cleared: true,
    why: `cleared a lock held by a dead process (${h.raw || "0-byte lock file"}). Run \`arc-leads reconcile\` NOW — that process may have left an in-flight intent, and until it is reconciled the spine does not know whether its mail went out.`,
  };
}

// ---------- derived state ----------
//
// Everything below is a fold. `events` comes from the reader; nothing is cached.
export function deriveState(events, { campaign }) {
  const suppressed = new Set();
  const replied = new Set();
  const touches = new Map();   // lead_id -> [submitted_at]
  const perDay = new Map();    // ist day -> count
  let bounces = 0, complaints = 0;

  for (const e of events) {
    const p = e.payload || {};
    if (e.kind === "lead.suppressed") suppressed.add(p.lead_id);
    else if (e.kind === "outreach.replied") {
      replied.add(p.lead_id);
      // BOTH terminal classes self-suppress from the reply receipt alone. `unsubscribe` did
      // and `bounce` did not, in adjacent lines (D6). ingestReply emits an explicit
      // lead.suppressed for both, but its own header documents a crash window between the
      // receipt and its consequences — land in it on a bounce and a confirmed-dead address
      // stays sendable while the campaign counts the bounce against itself.
      if (p.triage_class === "bounce") { bounces++; suppressed.add(p.lead_id); }
      if (p.triage_class === "unsubscribe") suppressed.add(p.lead_id);
    } else if (e.kind === "outreach.sent") {
      if (!touches.has(p.lead_id)) touches.set(p.lead_id, []);
      touches.get(p.lead_id).push(p.submitted_at);
      // Bucketed by the intent's submitted_at, NOT by the spine emit time: a recovery receipt
      // written at 00:10 would otherwise move a 23:55 send onto the next IST day and free a
      // slot on both.
      const d = istDay(p.submitted_at);
      perDay.set(d, (perDay.get(d) || 0) + 1);
    } else if (
      // TYPED, and scoped to the leads module — but NOT to one campaign.
      //
      // The asymmetry this fixes: bounces were counted across every campaign (the branch
      // above has no campaign filter) while complaints were counted for this campaign only.
      // So the MORE severe signal had the NARROWER blast radius, and a spam complaint in
      // campaign A left campaign B sending from the same domain at full rate.
      //
      // The asset these breakers protect is the SENDING DOMAIN, and there is exactly one of
      // those (ADR-0402). A complaint against it is a fact about it, not about whichever
      // campaign happened to trigger it. Both signals are therefore module-wide, which is the
      // safe direction: it freezes more, never less, and each campaign still clears its own
      // freeze through its own inbox approval.
      //
      // The earlier version was scoped and typed to fix a different bug — a free-text regex
      // over every incident on the spine froze leads on another lane's incident text. `module
      // === "leads"` is what fixed that; `campaign === campaign` was collateral, and it is the
      // part that had to go.
      e.kind === "incident.raised" && p.module === "leads" && p.kind === "spam-complaint"
    ) complaints++;
  }
  return { suppressed, replied, touches, perDay, bounces, complaints, campaign };
}

// ---------- the mixing guard's counter (ADR-0416) ----------
//
// The rehearsal exercises the pipeline against five KNOWN people. The claim that has to
// survive it is that no real cold send happened in that window — and that claim is a COUNT.
// A reader that greps its own output for the word "rehearsal" passes for a mutant that changes
// the wording and fails for one that changes the meaning, so the number is derived here and
// the report only prints it.
//
// It lives beside deriveState because both are folds over `outreach.sent` and the bucketing
// rules must not diverge. Note what deriveState deliberately does NOT do: it makes no
// rehearsal/real distinction at all, because a rehearsal send is a real email to a real person
// and consumes a real cap slot. Splitting the CAPS would be the mixing bug pointed the other
// way round.
//
// An UNMARKED receipt counts as REAL. The schema makes `rehearsal` required, so an unmarked
// receipt can only predate that — and "we cannot show this was a rehearsal" is not "it was a
// rehearsal". Counting it as real is what keeps `real === 0` a claim worth making; it is also
// reported on its own, because an operator reading a non-zero real count needs to know whether
// that is five cold sends or five receipts of unknown vintage.
//
// Window bounds are compared as STRINGS. Payload timestamps are pinned to exactly
// YYYY-MM-DDTHH:MM:SS+05:30 by the validator (one spelling per instant), so lexicographic
// order IS chronological order and no parse here can disagree with the one the idem preimage
// used. A stamp that does not even start with a date is never filtered OUT of a window: an
// unplaceable receipt must not escape the count by being unreadable.
//
// THE BOUNDS ARE VALIDATED, and they were not. Every other timestamp in this lane goes through
// `assertTs`; these were taken as raw strings and compared against `+05:30`-pinned payloads, so
// a caller who asked the obvious question got a confident wrong answer in the UNSAFE direction:
//
//   {"from":"2026-08-04T04:00:00Z","to":"2026-08-04T05:00:00Z"}  ->  all zeros (truth: 1 real)
//   date-only bounds ("2026-08-04")                              ->  all zeros
//
// `Z` sorts after `+`, so a UTC spelling of the same hour excludes everything, and a date-only
// bound sorts before every stamp on that day. This is the ONE number ADR-0416's mixing guard
// exists to produce — "no real cold send happened in the rehearsal window" — and a window the
// counter cannot place must be a REFUSAL, never a zero. A zero here is a claim; an exception is
// an operator error.
//
// The CAMPAIGN axis stays an EXACT match, and that is a decision rather than an omission. A
// campaign name is an identifier this system mints and stores, not free text a human retypes
// per query: `assertCampaignStore` resolves it against the store, so a near-miss ("Pilot",
// "pilot ") is not a spelling variant of a real campaign, it is a campaign that does not exist.
// Folding case or trimming here would invent a match rule that no other reader of `p.campaign`
// applies — deriving one fact two ways, which is the defect class this file already carries
// three records of. What is NOT defensible is answering a non-existent campaign with a silent
// zero, and that is the caller's contract to keep: `cmdState` only ever passes campaign names it
// folded out of the spine itself, so every name it asks about is one that exists.
export function sendCounts(events, opts) {
  return foldSends(events, opts).counts;
}

/**
 * The one pass. `sendCounts` is the counts view of it; `counted` is the very same receipts, for
 * a caller that has to say something about them rather than only how many there were.
 *
 * Split out for `supersedes`: a correction that reclassifies a send rehearsal<->real left the
 * superseded original counted alongside it, so ONE physical send appeared in two classes — the
 * one thing the non-negotiable forbids outright. Answering that needs the identities of the
 * receipts inside the window, and re-deriving that set beside the counts would be a second fold
 * over one event list, which is D5 and is exactly what row 8 of the carried-forward table was
 * filed for. One filter, two views.
 */
export function foldSends(events, { campaign = null, from = null, to = null } = {}) {
  if (from !== null) assertTs("sendCounts", "from", from);
  if (to !== null) assertTs("sendCounts", "to", to);
  let rehearsal = 0, real = 0, unmarked = 0, unplaceable = 0;
  const counted = [];
  for (const e of events || []) {
    if (e.kind !== "outreach.sent") continue;
    const p = e.payload || {};
    // EXACT, and `!==` rather than any prefix or fold. `startsWith` here is a surviving mutant
    // that nothing caught: campaign "pilot" would then also count every receipt of "pilot-b",
    // so a report about one campaign would silently answer about a family of them. Pinned by a
    // fixture whose two campaign names are prefixes of each other.
    if (campaign !== null && p.campaign !== campaign) continue;
    const at = String(p.submitted_at == null ? "" : p.submitted_at);
    // `placeable` gates the window comparison ONLY. Adding `if (!placeable) continue;` here is a
    // surviving mutant the comment above forbade and nothing tested: a receipt with a junk
    // `submitted_at` would then vanish from every count, so corrupting one field of one receipt
    // would delete a real send from the number that claims none happened. Pinned by fixture.
    //
    // THE GRAMMAR IS THE PAYLOAD GRAMMAR, not an 11-character prefix of it. The prefix test
    // admitted `2026-08-04T04:00:00Z` — a real send at 09:30 IST — into a lexicographic compare
    // against `+05:30` bounds, where `Z` sorts after `+`, and the 09:00-10:00 IST window that
    // contained it answered `real: 0`. A stamp that is a date but not the pinned spelling is
    // UNPLACEABLE: it is counted in every window (an unplaceable receipt must not escape the
    // count by being unreadable) and it is reported on its own axis, because an operator reading
    // a window's counts needs to know how many of them the window could not actually place.
    const placeable = isPayloadTs(at);
    if (!placeable) unplaceable++;
    if (placeable && from !== null && at < from) continue;
    if (placeable && to !== null && at > to) continue;
    // `=== true`, never `p.rehearsal`. The truthy form is a surviving mutant that reclassifies a
    // REAL send as a rehearsal — the one direction ADR-0416 forbids — because `"false"`, `1` and
    // `"no"` are all truthy. The schema requires a boolean, so a non-boolean can only come from
    // a receipt this build did not write, and the honest reading of one is "unmarked", which
    // counts as real. Pinned by fixture in both directions.
    counted.push(e);
    if (p.rehearsal === true) { rehearsal++; continue; }
    if (p.rehearsal !== false) unmarked++;
    real++;
  }
  return { counted, counts: { rehearsal, real, unmarked, unplaceable, total: rehearsal + real } };
}

/**
 * The campaign names the spine actually carries, as STRINGS.
 *
 * One derivation, because there were two: `cmdReport` resolved the operator's `--campaign`
 * against a string-filtered set of `outreach.sent` campaigns, while `cmdState` keyed a plain
 * object off `p.campaign` raw. A receipt whose `campaign` was absent or non-string therefore
 * produced `campaigns.undefined` with `submitted: 1` sitting beside its own `sends.total: 0` —
 * two derivations of one number disagreeing inside a single printed object — and a receipt
 * naming `__proto__` wrote its count onto `Object.prototype` and vanished from the map entirely.
 */
export function campaignNames(events, kinds = ["outreach.sent"]) {
  const want = new Set(kinds);
  const names = new Set();
  for (const e of events || []) {
    if (!want.has(e.kind)) continue;
    const c = (e.payload || {}).campaign;
    if (typeof c === "string") names.add(c);
  }
  return [...names].sort();
}

// Sample-size-honest breakers (ADR-0403). At n=25 one bounce is 4%, so a bare percentage
// floor freezes on noise — HOLD is the honest small-n response, FREEZE the evidenced one.
// `lifetimeSends` IS GONE FROM THE SIGNATURE, not left unused. It fed only the rate branch
// deleted below, and a parameter a function ignores is a promise it does not keep — the next
// reader assumes a lifetime-scoped check happens here because the argument says so. Existing
// callers passing a second argument are unaffected; the call site in `guardSend` no longer
// computes one for this purpose.
export function breakerState(state) {
  if (state.complaints > 0) return { level: "FROZEN", why: "a spam complaint was recorded against the leads sending domain" };
  if (state.bounces >= 2) // NOT "in this campaign". deriveState counts bounces across every leads campaign,
    // because the asset these breakers protect is the one sending domain -- so an operator
    // told "3 bounces in this campaign" against a campaign holding one goes looking for two
    // that are not there.
    return { level: "FROZEN", why: `${state.bounces} bounces across the leads sending domain` };
  // THE RATE BRANCH THAT USED TO SIT HERE COULD NEVER FIRE, and it is deleted rather than
  // reordered. It read `lifetimeSends >= 50 && bounces / lifetimeSends >= 0.03`, but the check
  // directly above already returns FROZEN at `bounces >= 2` — so it was only ever reached with
  // `bounces <= 1`, where the ratio maxes out at 1/50 = 2%. Its message, `bounce rate X% across
  // N lifetime sends`, could not be printed by any input this system can produce (D3).
  //
  // Reordering would have been the wrong repair: 3% of 50 is 1.5, so every rate that clears the
  // threshold already implies two bounces, and the absolute rule fires first and says something
  // truer. A threshold that adds nothing is not made useful by making it reachable.
  if (state.bounces === 1) return { level: "HOLD", why: "the first bounce on this domain — sends pause until a human reviews the cause" };
  return { level: "OK", why: null };
}

// A campaign's HOLD/FROZEN clearance is a DECISION on the spine, never a file and never a
// flag. `--force`, a raised config value and an env override are all refused by construction:
// there is no code path that clears this other than an inbox approval.
// A clearance must name the INCIDENT it clears, and it must be an approval of a leads
// clearance request. The first version matched a free-text regex over every
// `decision.recorded` on the whole spine, which was wrong in five separate ways, each
// confirmed by an adversarial pass:
//
//   * ANY approve decision counted -- one emitted by evolve or develop cleared a leads FREEZE
//   * the match was unanchored, so "raise the bounce thres|HOLD|" cleared a HOLD, and
//     "auto|pilot|" matched campaign "pilot" (D2, an unanchored match on a legitimate variant)
//   * a decision whose text said HOLD IT cleared the hold
//   * the clearance was PERMANENT -- one approval pre-cleared every future breaker forever
//   * `campaign` was interpolated RAW into a RegExp: campaign "a|b" made any reason
//     containing "b" a clearance, and campaign "(" threw a bare SyntaxError out of the guard
//
// The fix removes the regex entirely. A clearance is now a typed pairing on the spine:
// an `approval.requested` with gate `leads-breaker` naming {campaign, level, incident_id},
// approved by a `decision.recorded` that DECIDES it. Structure, not prose.
export function clearedByInbox(events, campaign, level, incidentId) {
  const requests = events.filter(
    (e) => e.kind === "approval.requested" &&
      e.payload?.gate === "leads-breaker" &&
      e.payload?.campaign === campaign &&
      e.payload?.level === level &&
      // Bound to the SPECIFIC incident, so a clearance cannot pre-authorise a future breaker.
      e.payload?.incident_id === incidentId
  );
  for (const req of requests) {
    // Latest decision wins, so a reject after an approve revokes it (see approvedShaFor).
    const decisions = events.filter((e) => e.kind === "decision.recorded" && e.payload?.decides === req.id && req.id);
    const last = decisions[decisions.length - 1];
    if (last && last.payload?.verdict === "approve") return true;
  }
  return false;
}

// The identity of the CURRENT breaker state: what fired, and on the evidence of how many
// bounces/complaints. A clearance is bound to this, so resolving one HOLD does not silently
// authorise the next one.
export function incidentIdFor(campaign, breaker, state) {
  return `${campaign}:${breaker.level}:b${state.bounces}:c${state.complaints}`;
}

// ---------- the chain ----------
export function guardSend({ events, store, draft, now, config, env = process.env }) {
  assertNoCapOverrides();
  const caps = loadCaps(config);
  const { campaign, lead_id, touch_n, draft_sha, approved_sha } = draft;

  // 0. rehearsal containment (ADR-0416), compared in ID SPACE — see rehearsalAllowedIds.
  //
  //    Gated on DECLARED, not on "the mode resolved cleanly". A declared-but-incomplete
  //    rehearsal leaves `eff.rehearsal` FALSE, so keying the check off that flag would turn a
  //    broken rehearsal config into an unguarded send — the fail-open wearing a fix's clothes.
  //    unsubscribeHeader refuses that state too, which is precisely why this must not lean on
  //    it: a guard that holds only because a different function happens to throw first is not
  //    a guard, and that is defect class D6 as this file has already recorded it three times.
  //
  //    When rehearsal is NOT declared there is no list in the world to check against. That
  //    path is held elsewhere and deliberately: `sending_domain` is empty, so ADR-0402's
  //    dedicated-domain row and unsubscribeHeader both refuse, and the per-recipient list for
  //    real cold outbound is a Phase-05 question this slice must not pretend to answer.
  // Every id this address could EVER have had. RESOLVED HERE, from the store, and never taken
  // from the caller: a caller-supplied list is a list that can be short, and a SHORT list is
  // exactly the rotation hole wearing a fix's clothes (a probe passing only the current id
  // sent to an unsubscriber). The guard owns the check, so no call site can weaken it.
  //
  // Hoisted ABOVE the rehearsal step because step 0 needs it too — see the binding check below.
  // It is a read and it never throws, so nothing about the refusal ORDER moved.
  const allIds = resolveKeyringIds(store, lead_id);

  if (rehearsalMode(env).declared) {
    let cfg;
    try { cfg = loadConfig(config); }
    catch (e) {
      throw new GuardRefusal("rehearsal-mode", `rehearsal mode is DECLARED but the leads config could not be read (${e.message}) — refusing rather than resolving the mode from a config that is not there (ADR-0416).`);
    }
    const eff = effectiveSendingDomain(cfg, env);
    if (eff.blocked)
      throw new GuardRefusal("rehearsal-mode", `ADR-0416 rehearsal mode is DECLARED but incomplete, so the send is refused rather than quietly falling back: ${eff.blocked}`);
    let allowed;
    try { allowed = rehearsalAllowedIds(store, env); }
    catch (e) {
      throw new GuardRefusal("rehearsal-allowlist", `the ADR-0416 rehearsal allowlist could not be read: ${e.message}`);
    }
    // The ADDRESS is never echoed, here or in the refusal. An allowlist refusal is exactly the
    // line most likely to be read out of a CI log by someone who should not have the address,
    // and the operator already knows which recipients they listed. The lead id is a keyed HMAC
    // and is safe to name, truncated, so the refusal can be matched to a draft.
    if (!allowed.has(lead_id))
      throw new GuardRefusal(
        "rehearsal-allowlist",
        `lead ${String(lead_id).slice(0, 24)}... is not on the ADR-0416 rehearsal allowlist (${allowed.size} id(s) across every key version of ${REHEARSAL_ALLOWLIST_VAR}) — refused BEFORE any network call. The address is not echoed; check ${REHEARSAL_ALLOWLIST_VAR} in .env.local.`
      );
    // MEMBERSHIP IS NOT CONTAINMENT. The line above asks only "is this id on the list"; nothing
    // in it binds the id to the address in the DOSSIER behind it, and the dossier is what the
    // provider will actually deliver to. A dossier filed at the id of an allowlisted address but
    // holding a stranger's address cleared this step outright — containment then rested entirely
    // on the later suppression step, and the mutant that deletes that step left
    // leads-rehearsal-send, leads-provider-contract and leads-receipts all green.
    //
    // So the round trip is asserted HERE as well as at the wire (deps.mjs resolveRecipient): the
    // address behind this id must re-derive to this id under some key version. Two independent
    // refusals for one property is the point — a guard that holds only because a different
    // function happens to throw first is not a guard, and this file has already recorded that
    // lesson (D6) three times.
    //
    // `rehearsal-allowlist` class, not `suppression`: the question being answered is still "may
    // this person be contacted at all on this run", and the operator needs the ADR-0416 sentence
    // rather than a suppression one. Step 4 asks the same store the same question for a
    // different reason and keeps its own refusal.
    if (!allIds)
      throw new GuardRefusal(
        "rehearsal-allowlist",
        `lead ${String(lead_id).slice(0, 24)}... cleared the ADR-0416 allowlist in id space, but the dossier behind that id does not hold an address that derives back to it under any key version — the dossier is missing, holds no usable email, was edited, or belongs to another store. The allowlist authorises an ID; the vendor is handed an ADDRESS, and refusing here is what stops those being two different people. Refused BEFORE any network call; neither value is echoed.`
      );
  }
  const state = deriveState(events, { campaign });

  // 1. campaign state
  const breaker = breakerState(state);
  const incidentId = incidentIdFor(campaign, breaker, state);
  if (breaker.level !== "OK" && !clearedByInbox(events, campaign, breaker.level, incidentId))
    throw new GuardRefusal("campaign-state", `campaign "${campaign}" is ${breaker.level}: ${breaker.why}. Clear it with an approved leads-breaker request naming incident "${incidentId}" — no flag, config value, env var or free-text approval does (ADR-0403).`);

  // 2. unresolved intent — conservative until reconciled. Blunt on purpose: at <=20 sends/day
  //    refusing everything until a crash is reconciled costs a command, and the alternative
  //    is a duplicate to a real human.
  const pending = unresolvedIntents(store);
  if (pending.length)
    throw new GuardRefusal("unresolved-intent", `${pending.length} unresolved send intent(s) in the journal. No send is attempted anywhere until \`arc-leads reconcile\` has run (ADR-0411).`);

  // 3. ALREADY SENT. Found by walking the send path end to end rather than by reading it: a
  //    second run of the daily command re-entered the whole chain for a draft that had already
  //    been sent, because the touch cap counts touches (1 of 2 used) and nothing asked the
  //    narrower question "has THIS touch already gone out?".
  //
  //    The receipt idem stopped the duplicate RECEIPT, so the spine stayed honest -- but only
  //    after the provider had already been asked to submit again. On the fake that is
  //    invisible (it is idempotent by key); on a real provider it is a second submit, and the
  //    only thing standing between it and a duplicate email is the provider honouring the
  //    idempotency key. Depending on that is exactly what ADR-0411 says not to do.
  // Compared as NUMBERS. `touch_n` reaches here from a store JSON file that nothing
  // re-validates, and the idem formula interpolates it -- so 1 and "1" produce the SAME idem
  // while `===` says they are different touches. Two derivations of one value that disagree
  // (D5): the guard let a second submit through, and the reconciler voided an intent whose
  // receipt was sitting on the spine.
  const tn = normalizeTouchN(touch_n);
  // EVERY key version, here and in steps 5 and 6 below.
  //
  // Step 4 resolved the whole keyring and steps 3, 5 and 6 each checked ONE id — the same
  // defect, in three adjacent branches, under a comment calling the single-id version "the
  // single worst thing this system can do" (D6). After a rotation the receipts a person
  // already has carry their v1 id while a fresh draft carries v2, so: a `no` or `later` reply
  // did not stop the sequence, the already-sent check did not see the send that had gone out,
  // and the rolling touch cap reset to zero. Only `unsubscribe` and `bounce` were protected,
  // and only because they land in the keyring-wide suppression set.
  //
  // `allIds` is null when the lead cannot be resolved; step 4 refuses on that. Until then,
  // fall back to the single id so the earlier steps still check what they can.
  const idsToCheck = allIds || [lead_id];
  const isThisLead = (id) => idsToCheck.includes(id);
  const alreadySent = events.some(
    (e) => e.kind === "outreach.sent" &&
      e.payload?.campaign === campaign &&
      isThisLead(e.payload?.lead_id) &&
      Number(e.payload?.touch_n) === tn
  );
  if (alreadySent)
    throw new GuardRefusal("already-sent", `touch ${touch_n} to this lead in "${campaign}" already has an outreach.sent receipt — refusing before the provider is asked, rather than relying on it to deduplicate.`);

  // 4. suppression — checked across EVERY key version, so a rotation cannot un-suppress
  //    someone who asked to be forgotten (ADR-0400's keyring).
  if (!allIds)
    throw new GuardRefusal("suppression", `could not resolve this lead's id across the store keyring (missing dossier, missing email, or a lead from another store) — refusing rather than checking a single id, because a key rotation would then miss a suppression made under the previous key (ADR-0400).`);
  const hit = allIds.find((id) => state.suppressed.has(id));
  if (hit)
    throw new GuardRefusal("suppression", `lead is on the suppression ledger${hit === lead_id ? "" : ` under a PREVIOUS key version (${hit.slice(0, 20)}...)`} — unsubscribed, bounced, or manually suppressed. This survives across campaigns, key rotations and dossier deletion.`);

  // 5. reply-stop. This is the TOCTOU case: a reply recorded AFTER approval permanently
  //    blocks the send that approval authorized. Keyring-wide, like step 4 — a reply under a
  //    previous key is still that person answering.
  const repliedAs = idsToCheck.find((id) => state.replied.has(id));
  if (repliedAs)
    throw new GuardRefusal("reply-stop", `lead has already replied${repliedAs === lead_id ? "" : ` under a PREVIOUS key version (${repliedAs.slice(0, 20)}...)`} — the sequence stops itself. Approval authorized an attempt, not a send (ADR-0403).`);

  // 6. rolling touch cap — rolling, not a calendar week: a calendar week lets two touches
  //    land Sunday and Monday and calls it two weeks. Touches are summed across every key
  //    version, or a rotation would hand every lead a fresh allowance.
  const allTouches = idsToCheck.flatMap((id) => state.touches.get(id) || []);
  const prior = allTouches.filter((t) => withinRollingWindow(t, now, caps.rolling_window_days));
  // A touch recorded AFTER `now` means the clock moved backwards, not that the touch does not
  // count. Treating it as outside the window emptied the touch cap under any backward skew.
  const future = allTouches.filter((t) => Date.parse(t) > Date.parse(now));
  if (future.length)
    throw new GuardRefusal("clock-skew", `${future.length} touch(es) for this lead are stamped AFTER the current send time (${now}) — refusing rather than counting them as outside the rolling window.`);
  if (prior.length >= caps.touches_per_lead)
    throw new GuardRefusal("touch-cap", `lead already had ${prior.length} touch(es) in the rolling ${caps.rolling_window_days}-day window; the cap is ${caps.touches_per_lead}.`);

  // 7. daily cap — SUBMITTED sends only; attempts the provider refused do not count.
  //    Effective count includes unresolved intents, but step 2 already refused those.
  const day = istDay(now);
  const today = state.perDay.get(day) || 0;
  if (today >= caps.per_ist_day)
    throw new GuardRefusal("daily-cap", `${today} send(s) already submitted on IST day ${day}; the cap is ${caps.per_ist_day}. Raising it in config is refused above the hard ceiling (ADR-0403).`);

  // 8. send window
  if (!inSendWindow(now, caps.send_window_ist))
    throw new GuardRefusal("send-window", `${now} is outside the IST send window (${caps.send_window_ist.start}-${caps.send_window_ist.end}, weekdays).`);

  // 9. draft sha — approval binds the EXACT content. Edited-after-approval is refused
  //    (ADR-0412, evolve's candidate_sha discipline applied to outreach).
  if (!approved_sha || draft_sha !== approved_sha)
    throw new GuardRefusal("draft-sha", `the draft changed after approval (approved ${String(approved_sha).slice(0, 12)}, current ${String(draft_sha).slice(0, 12)}). Approval binds exact content (ADR-0412).`);

  return { ok: true, day, submittedToday: today, priorTouches: prior.length, breaker: breaker.level };
}
