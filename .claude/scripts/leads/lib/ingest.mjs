// ingest.mjs — one reply, end to end (ADR-0405, ADR-0412, ADR-0414).
//
// The ordering here is the phase's whole safety argument and it is not rearrangeable:
//
//   read bytes    -- from a file OUTSIDE the repo, from stdin, or from the ADR-0405
//                    inbound interface. THREE doors, and never argv.
//   parse         -- replies.mjs; a refusal names the offset, never the content
//   resolve lead  -- via the store keyring, so a reply to an address suppressed under an
//                    older key still lands on the right lead
//   persist reply -- store-side, `wx`, so re-ingesting the same bytes is a no-op
//   receipt       -- outreach.replied, keyed on the reply's CONTENT (ADR-0414)
//   consequences  -- suppression / meeting draft, in the SAME run as the ingestion
//
// "In the same run" is a design commitment, not a performance note. The design source asks for
// a calendar reply within a 16:00-IST SLA; drafting at ingestion satisfies that by
// construction in both webhook and manual mode, with no cutoff clock, no business-day
// arithmetic and no public-holiday calendar — none of which this cycle could validate, Phase 3
// being blocked. A deadline you cannot miss beats a deadline you measure.
//
// The receipt comes BEFORE the consequences on purpose. If the process dies between them, the
// reply is on the spine and the sequence is already stopped (reply-stop keys on the receipt,
// not on its class) — so the failure mode is a missing calendar draft, which a human notices,
// rather than a mail sent to someone who replied, which nobody notices until it is public.

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseReply, ReplyParseError, MAX_REPLY_BYTES } from "./replies.mjs";
import { isInsideRepo, leadIdsAllVersions, STORE_FILE_MODE, STORE_DIR_MODE } from "./store.mjs";
import { writeMeetingDraft, meetingApprovalPayload, assertCampaignStore } from "./drafts.mjs";
import { leadsIdem, LEADS_KINDS } from "../../hq/lib/validate-leads.mjs";
import { idemKeys, UNFOLDABLE_REMEDY } from "./spine-read.mjs";
import { canonicalLeadId } from "./guard.mjs";

export class IngestRefusal extends Error {
  constructor(step, message) { super(message); this.name = "IngestRefusal"; this.step = step; }
}

// ---------- reading the bytes ----------

// A reply file inside the repository is refused for the same reason the store is (ADR-0410):
// the repo is headed public, `git clean -xfd` deletes ignored files, and one `git add -f` is
// permanent. Checked with store.mjs's OWN containment function — realpath'd, Windows prefixes
// stripped, case-folded only where the filesystem folds — rather than a `startsWith` written
// again here. The four bypasses that function survived are not worth re-discovering.
export function readReplyFile(repoRoot, path) {
  const p = String(path || "");
  if (!p.trim()) throw new IngestRefusal("usage", "--file needs a path");
  const { inside, resolved, root } = isInsideRepo(repoRoot, p);
  if (inside)
    throw new IngestRefusal(
      "path",
      `${resolved} is inside the repository at ${root} — reply files hold the lead's own words and their address, and must live outside the tree entirely (ADR-0410/0412). ` +
        `Move it under the private store or any path outside the repo and re-run.`
    );
  if (!existsSync(resolved)) throw new IngestRefusal("path", `no such file: ${resolved}`);
  // SIZE BEFORE READ. replies.mjs states "limits before work ... a hostile input cannot make
  // us allocate first and refuse second" -- and both doors into it did exactly that. A 200 MiB
  // file was fully read into memory and only then refused as TOO_LARGE, so the limit protected
  // the parser and nothing else. stat is the check; the read never happens.
  const size = statSync(resolved).size;
  if (size > MAX_REPLY_BYTES)
    throw new IngestRefusal("path", `${resolved} is ${size} bytes; the limit is ${MAX_REPLY_BYTES}. Refused before reading it, not after.`);
  return readFileSync(resolved);
}

// stdin, read to completion as BYTES. `--file` and stdin are the only two doors, and both
// hand over a Buffer: a string here would fold invalid UTF-8 onto U+FFFD and change the
// reply's identity (ADR-0414).
export async function readStdin(stream) {
  const chunks = [];
  let total = 0;
  for await (const c of stream) {
    const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
    total += b.length;
    // A running count, checked per chunk. There is no file to stat here, so this is the only
    // place the ceiling can bite -- and without it a pipe was unbounded, which is strictly
    // worse than the file door it mirrors.
    if (total > MAX_REPLY_BYTES)
      throw new IngestRefusal("stdin", `stdin exceeded ${MAX_REPLY_BYTES} bytes; refusing mid-stream rather than buffering the rest`);
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

// ---------- resolving whose reply it is ----------
//
// Every key version, newest first, and the FIRST id with a dossier wins. A single-version
// lookup would fail to identify anyone researched before a rotation — and failing to identify
// a reply means failing to stop the sequence, which is the same lead getting touch 2 after
// they said no.
export function resolveLead(store, address) {
  for (const id of leadIdsAllVersions(store, address)) {
    const p = join(store.dir, "dossiers", `${id}.json`);
    if (!existsSync(p)) continue;
    const d = JSON.parse(readFileSync(p, "utf8"));
    return { lead_id: d.lead_id || id, campaign: d.campaign, dossier: d };
  }
  return null;
}

// The highest touch already sent to this lead in this campaign. Derived from receipts like
// every other count in this system — a reply's `In-Reply-To` header is attacker-controlled and
// is not consulted for anything that matters.
export function lastTouchOf(events, campaign, leadId) {
  let n = 0;
  for (const e of events)
    if (e.kind === "outreach.sent" && e.payload?.campaign === campaign && e.payload?.lead_id === leadId)
      n = Math.max(n, Number(e.payload.touch_n) || 0);
  return n || null;
}

// ---------- the reply record (store side) ----------
//
// Everything the spine may not hold: the address, the body, the headers we read. Written with
// `wx`, so a second ingestion of the same bytes finds it already there and does not rewrite
// it. The path is the reply_ref, which is the content hash, so "same bytes -> same path" is
// arithmetic rather than a check.
function persistReply(store, rec) {
  const dir = join(store.dir, "replies");
  mkdirSync(dir, { recursive: true, mode: STORE_DIR_MODE });
  const p = join(dir, `${rec.reply_ref}.json`);
  try {
    writeFileSync(p, JSON.stringify(rec, null, 2) + "\n", { mode: STORE_FILE_MODE, flag: "wx" });
    return { fresh: true };
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    // A RE-CLASSIFICATION is refused, loudly, rather than half-applied.
    //
    // `wx` keeps the store record immutable and the idem includes triage_class, so
    // re-ingesting identical bytes under an improved parser that returns a DIFFERENT class
    // mints a second receipt on the spine while the store keeps the old one. Spine and store
    // then disagree about one reply, and on a bounce reclassification that is bounces 1 -> 2,
    // i.e. FROZEN. Two derivations of one value that disagree is D5, and the honest answer is
    // that a reclassification is a `supersedes` correction a human makes deliberately, not
    // something an ingest run does on its own (ADR-0414).
    let prior;
    try { prior = JSON.parse(readFileSync(p, "utf8")); } catch { return { fresh: false }; }
    if (prior.triage_class && prior.triage_class !== rec.triage_class)
      throw new IngestRefusal(
        "reclassified",
        `reply ${rec.reply_ref} is already recorded as "${prior.triage_class}" and this run classifies it "${rec.triage_class}". ` +
          `Refusing: the store would keep one class while the spine gained a receipt for the other. ` +
          `A re-classification is a supersedes correction on the spine, made deliberately (ADR-0414).`
      );
    return { fresh: false };
  }
}

// ---------- the calendar draft ----------
//
// Assembled from a template plus the configured calendar link. No lead-specific text is
// generated here: this reply goes to someone who already said yes, so ADR-0404's
// personalization bar does not apply, and inventing a "personal" line for a warm lead is
// exactly the slop that gate exists to stop.
export function meetingBody({ calendarUrl }) {
  return [
    "Thanks for coming back to me — glad it is useful.",
    "",
    "Easiest is to pick a slot that suits you:",
    `  ${calendarUrl}`,
    "",
    "If none of those work, tell me two or three times that do and I will make one of them work.",
  ].join("\n");
}

// ---------- one reply, end to end ----------
//
// `emit` is injected rather than imported so that this module has no opinion about the spine
// transport, and so a test can assert the exact receipts in the exact order without a spine.
// No `repoRoot` parameter: the path rule belongs to readReplyFile, which is the only function
// that ever sees a path. By the time bytes reach here there is nothing left to contain, and a
// parameter that is accepted and ignored reads to the next caller as a check being performed.
export async function ingestReply({ store, bytes, events, now, emit, config, sourceLabel = "(stdin)", spineIdems = [], spineRead = false }) {
  let parsed;
  try {
    parsed = parseReply(bytes);
  } catch (e) {
    if (e instanceof ReplyParseError)
      // The path is added HERE, by the caller's layer, because the parser is never told it.
      // The parser cannot leak a path it does not have, and this is the only place a path and
      // a parse failure meet.
      throw new IngestRefusal("parse", `${sourceLabel}: ${e.message}`);
    throw e;
  }

  const who = resolveLead(store, parsed.address);
  if (!who)
    throw new IngestRefusal(
      "unknown-lead",
      `${sourceLabel}: reply ${parsed.reply_ref} is from an address with no dossier in this store (checked every key version). ` +
        `The address is deliberately not printed. Open the file to see it — it is not going into a log.`
    );

  // A campaign whose record was minted under a different keyring cannot be reasoned about:
  // its receipts carry ids derived from a secret this run does not have.
  //
  // Converted to an IngestRefusal rather than letting the DraftError fly. In a BATCH the
  // caller catches refusals per reply and carries on; an unconverted error class escapes that
  // loop and halts the run, so one lead whose campaign record is missing would stop every
  // reply behind it from being ingested -- and a reply we fail to ingest is a sequence we
  // fail to stop. The one most likely to be behind it is the unsubscribe.
  // assertCampaignStore, NOT readCampaign. The paragraph above described the keyring binding
  // and the code performed a file-exists check -- a comment claiming a safety property the
  // code does not implement, which is this repository's single most repeated defect and the
  // reason the rule about it exists. The comment in drafts.mjs even named this call site as
  // the one that "carried on accepting", and then left it accepting.
  try {
    assertCampaignStore(store, who.campaign);
  } catch (e) {
    throw new IngestRefusal("campaign", `${sourceLabel}: reply ${parsed.reply_ref} belongs to campaign "${who.campaign}" — ${e.message}`);
  }

  // ADR-0414 makes a re-ingest produce the SAME idem, which the spine then refuses as
  // DUP_IDEM -- correctly, since the receipt is already recorded. But a refusal from the
  // emitter is an ERROR to whatever called it, so the first version of this path turned the
  // ordinary "did that run finish?" re-run into a crash on its second line, and never reached
  // the calendar draft. The receipt layer was idempotent and the command was not.
  //
  // So: an emit whose idem is already on the spine is SKIPPED here, deterministically, from
  // the fold this function was handed. The CLI keeps a second guard for the race (two
  // processes, both past this check) -- belt and braces, because losing that race must be
  // boring rather than an exception.
  // THE SKIP SET IS THE UNION OF BOTH SPINE FILES, AND IT GROWS. Two defects fixed in
  // `cmdResearch` were live in this function at the same time, in the sibling copy of the same
  // idea — which is why the rule is to grep the PATTERN rather than the file:
  //
  //   - it folded `events/*.jsonl` while the emitter refuses from `derived/idem.index`, so a
  //     restored or archived day left keys the fold cannot see and the emitter still rejects
  //     (D5), and every such receipt was quarantined on every attempt;
  //   - the set was a snapshot, so two payloads with one idem inside a single call both passed
  //     the check and the second was refused (D6).
  const onSpine = new Set(events.map((e) => e && e.idem).filter(Boolean));
  // THE INDEX KEYS ARE INJECTED, NOT READ FROM AMBIENT STATE. The first version called
  // `idemKeys()`, which resolves `spineRoot()` out of the environment — so this function, whose
  // own header promises that a test can assert its receipts without a spine, silently began
  // reading whatever `ARC_SPINE_ROOT` happened to point at. In `leads-reply-contract.bats`,
  // which has no `setup()` and passes `events: []`, that is this repository's own untracked
  // index: a suite that passes or fails on a file git does not track, which is the
  // shard-order-ambient-state failure the lane has already recorded once.
  //
  // The CLI passes the real set. A caller that passes nothing gets the events fold alone, which
  // is exactly what a module test wants and what this function did before.
  for (const key of spineIdems) onSpine.add(key);
  // LEADS KINDS ONLY, refused loudly rather than by an obscure throw from three frames down.
  // This wrapper is built entirely on `leadsIdem`, which is defined for the leads vocabulary and
  // for nothing else — a caller who hands it `approval.requested` gets UNKNOWN_KIND out of a
  // module whose name suggests it is a spine problem. That is precisely how the first attempt at
  // the meeting-approval fix crashed every interested reply. The refusal now says what is wrong
  // and what to use instead, at the boundary rather than in the callee.
  const emitOnce = async (kind, payload) => {
    if (!LEADS_KINDS.includes(kind))
      throw new IngestRefusal("internal", `emitOnce is for leads kinds only and was handed "${kind}" — that kind has no stable idem (arc-event salts a non-leads idem with the millisecond), so deduplicating it by idem is not possible. Check the spine for the receipt's own identity field instead.`);
    const idem = leadsIdem(kind, payload);
    if (onSpine.has(idem)) return { duplicate: true, raced: false };
    // THE EMITTER'S OWN ANSWER IS CARRIED OUT, not discarded. The CLI injects an `emit` that
    // tolerates DUP_IDEM, so losing the race returns `{duplicate:true}` from down there — and
    // this wrapper threw it away and reported `{duplicate:false}`, i.e. "a new receipt was
    // written". The run then printed "N ingested, 0 refused" at exit 0 while the tolerated
    // refusal had left a quarantine record, and `report` — the one number this phase produces —
    // refuses while any record exists. Distinguished from `duplicate` because they are
    // different facts: one is "we already had it", the other is "somebody beat us to it and the
    // spine now carries a blocker".
    const res = await emit(kind, payload);
    onSpine.add(idem);
    return { duplicate: false, raced: !!(res && res.duplicate) };
  };

  const inReplyTo = lastTouchOf(events, who.campaign, who.lead_id);
  const replyRec = {
    reply_ref: parsed.reply_ref,
    lead_id: who.lead_id,
    campaign: who.campaign,
    triage_class: parsed.triage_class,
    matched_rule: parsed.matched,
    address: parsed.address,      // PII — store only
    body_text: parsed.body_text,  // PII — store only
    ingested_at: now,
    source: sourceLabel,
    in_reply_to_touch: inReplyTo,
  };
  const { fresh } = persistReply(store, replyRec);

  const payload = {
    lead_id: who.lead_id,
    campaign: who.campaign,
    triage_class: parsed.triage_class,
    ingested_at: now,
    reply_ref: parsed.reply_ref,
    ...(inReplyTo ? { in_reply_to_touch: inReplyTo } : {}),
  };
  // The `{duplicate}` answer is CARRIED, not discarded. `emitFn` in the CLI passes
  // `allowDuplicate: true`, so a lost race is swallowed there and the tolerated refusal still
  // leaves a quarantine record — which makes `report` refuse outright. `cmdResearch` names
  // exactly this case and exits non-zero; this branch threw the flag away and printed
  // "N ingested, 0 refused" at exit 0 while the phase's one number was disabled. D6.
  const repliedEmit = await emitOnce("outreach.replied", payload);

  const out = {
    reply_ref: parsed.reply_ref,
    lead_id: who.lead_id,
    campaign: who.campaign,
    triage_class: parsed.triage_class,
    matched: parsed.matched,
    fresh,
    receipt_duplicate: repliedEmit.duplicate,
    receipt_raced: !!repliedEmit.raced,
    suppressed: false,
    meeting_ref: null,
    meeting_created: false,
  };

  // Suppression, in the same run. `unsubscribe` is a request and `bounce` is a fact, and both
  // end contact with that address — the reasons differ so the two receipts have distinct idems
  // (ADR-0400) and a lead who bounces and later unsubscribes is not deduplicated into one.
  if (parsed.triage_class === "unsubscribe" || parsed.triage_class === "bounce") {
    // THE RACE FLAG IS CARRIED HERE TOO. The reply receipt twenty lines up threads `raced` all
    // the way to a non-zero exit, and this branch dropped it — so a suppression that lost a race
    // left a quarantine record (which makes `report` refuse permanently) behind a run that
    // printed "1 ingested, 0 refused" at exit 0. The guard applied to one emit and omitted on
    // the adjacent one, in the same function, for the fifth time in this lane.
    //
    // It matters more here than there: the receipt that gets lost is the one that stops
    // contacting somebody who asked not to be contacted.
    const suppressEmit = await emitOnce("lead.suppressed", {
      lead_id: who.lead_id,
      campaign: who.campaign,
      reason: parsed.triage_class === "unsubscribe" ? "unsubscribe" : "bounce",
      suppressed_at: now,
    });
    out.suppressed = true;
    out.suppressed_duplicate = suppressEmit.duplicate;
    if (suppressEmit.raced) out.receipt_raced = true;
  }

  // The calendar draft, in the same run as the ingestion that classified it.
  if (parsed.triage_class === "interested") {
    const calendarUrl = String(config?.calendar_url || "").trim();
    if (!calendarUrl)
      throw new IngestRefusal(
        "no-calendar",
        `${sourceLabel}: reply ${parsed.reply_ref} classified interested, but calendar_url is not configured — refusing rather than dropping a warm lead silently. ` +
          `The receipt IS on the spine and the sequence is stopped; set calendar_url in the leads config and re-run this ingestion to mint the draft.`
      );
    const { created, rec } = writeMeetingDraft(store, {
      campaign: who.campaign,
      lead_id: who.lead_id,
      // The REF is keyed on the canonical member of this person's keyring, so a key rotation
      // does not mint a second meeting draft and a second live approval for one human. The
      // record still stores the id the reply resolved to. Same function `cmdDraft` keys its
      // touch on -- one definition of "the canonical id", not two.
      ref_id: canonicalLeadId(store, who.lead_id),
      reply_ref: parsed.reply_ref,
      // Keyed on the LEAD, not the reply -- see writeMeetingDraft.
      body: meetingBody({ calendarUrl }),
      calendar_url: calendarUrl,
    });
    out.meeting_ref = rec.meeting_ref;
    out.meeting_created = created;
    // GUARDED BY THE SPINE, NOT BY A STORE-FILE FLAG — and NOT by `emitOnce`.
    //
    // `created` says whether THIS call wrote the draft file, which is not the question: it
    // answers "no" both when the approval is already on the spine (right outcome, wrong reason)
    // and when a previous run wrote the draft and died before announcing it (wrong outcome —
    // the meeting draft then exists with no approval, permanently, and no re-ingest ever mints
    // one). So the flag had to go.
    //
    // The obvious replacement, `emitOnce` six lines up, is WRONG TWICE, and the first attempt at
    // this fix shipped it: `approval.requested` is not a leads kind, so `leadsIdem` throws
    // UNKNOWN_KIND on it and EVERY interested reply crashed after writing the draft — creating
    // the exact permanent state the paragraph above describes, for every reply rather than for
    // an interrupted one. And even past the throw it could not work: `arc-event` derives a
    // non-leads idem as `sha256(preimage|milliseconds)`, so two emits of one approval never
    // share a key and an idem-set can never contain a previous run's. A payload being
    // deterministic does not make its idem deterministic.
    //
    // An approval's deterministic identity is its `draft_ref`. That is what is checked, and it
    // is the same question `cmdDraft` asks of the spine for outreach approvals.
    const announced = events.some(
      (e) => e && e.kind === "approval.requested" && e.payload && e.payload.draft_ref === rec.meeting_ref
    );
    // "NO APPROVAL FOUND" IS ONLY "NO APPROVAL EXISTS" IF THIS FOLD CAN SEE THE WHOLE SPINE.
    // `cmdDraft` spends twenty lines establishing that and withholds the inference when the
    // idem index holds keys the day files no longer carry; this made the identical inference
    // with the identical consequence — a second undecided `leads-meeting` approval for one
    // human, which the emitter cannot deduplicate because a non-leads idem is millisecond-
    // salted. Same defect, sibling module, one round later, with the answer already in scope as
    // a parameter. The index keys are a superset of the fold on a healthy spine, so anything in
    // the index and not in the fold is history this run cannot read.
    const foldedIdems = new Set(events.map((e) => e && e.idem).filter(Boolean));
    let unfoldable = 0;
    for (const k of spineIdems) if (!foldedIdems.has(k)) unfoldable++;
    if (!announced && unfoldable > 0)
      throw new IngestRefusal("spine", `the meeting draft ${rec.meeting_ref} has no approval in the days this fold can read, but ${unfoldable} idem(s) in derived/idem.index belong to events it cannot see — so "never announced" cannot be told from "announced on a day that is no longer here". Refusing rather than putting a second approval for one meeting in front of a human. ${UNFOLDABLE_REMEDY}`);

    // AN EMPTY FOLD IS NOT A SPINE THAT SAYS NO. This function's header promises a caller can
    // assert its exact receipts "without a spine", and every module test takes that up by
    // passing `events: []` — so on a second call `announced` was false for the same reason it
    // would be on a fresh install, and the meeting was announced twice. Two `approval.requested`
    // for one `meet_` ref: the state `drafts.mjs` calls how the wrong one gets approved, pinned
    // as the expected value by a suite this branch never opened. The production path was right
    // the whole time (`cmdIngestReply` hands over the real fold), which is exactly what made it
    // invisible from here. D6 — the guard moved and its sibling test did not.
    //
    // So the absence of an approval only counts as evidence when there is a fold to read it out
    // of. With none, the honest fallback is the fact this call does know: `created` is true only
    // when it just minted the draft file, and a draft it did not mint has already been through
    // this branch once. The interrupted-run repair the `created` flag could not do is preserved,
    // because in production the fold is never empty by the time a re-ingest reaches here — the
    // previous run's `outreach.replied` is in it.
    // The emit's answer is CARRIED, like both `emitOnce` calls above. This was the one emit in
    // the function whose result was dropped — and the CLI injects an emitter that tolerates
    // DUP_IDEM, so a lost race here reported "1 ingested, 0 refused" at exit 0 while the
    // tolerated refusal left the quarantine record that makes `report` refuse. Third time this
    // exact omission has been found in this file, each time on a different emit.
    // THE CALLER SAYS WHETHER IT SHOWED US THE SPINE. It is not inferred from `events.length`,
    // and the version that inferred it was a CRITICAL of its own: wipe the spine (a fresh clone,
    // a machine move, an `ARC_SPINE_ROOT` repoint) while the store keeps the meeting draft, and
    // `created` is false AND the fold is empty — so the approval was silently never emitted and
    // the run printed "1 ingested, 0 refused". It healed only on a THIRD ingest, and the operator
    // had been given a success line and no reason to run one. That traded a double-emit a module
    // test could see for a silent miss on the path this phase's whole SLA argument rests on.
    //
    // An empty fold has two causes that cannot be told apart from in here — "the caller did not
    // show me a spine" (every module test, deliberately) and "the spine is genuinely empty"
    // (production, after a reset) — and they need opposite answers. So the caller, which knows,
    // states it. Default false, so a caller that says nothing gets the conservative answer.
    if (!announced && (created || spineRead)) {
      const meetingEmit = await emit("approval.requested", meetingApprovalPayload(rec));
      if (meetingEmit && meetingEmit.duplicate) out.receipt_raced = true;
    }
  }

  return out;
}
