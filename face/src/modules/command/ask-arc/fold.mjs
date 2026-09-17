// fold.mjs -- command/ask-arc: every decision the no-hands reader's screen makes, where node can import
// it with no install (face v2 Phase 03, ADR-1320, ADR-1325).
//
// The port of v0.7's AskArc onto the door. A question is an act the host sends; the answer is read by
// ask.mjs (which half answered, what it cites); every claim becomes a read of the route that can settle
// it, and the standing -- CHECKING until every one has answered -- is ask.mjs's own verdict. The
// boundary panel prints what `noHandsAudit` computes over the same read-only handle the host asks
// through, so a later edit that hands this module a write says so by itself.
import { payloadOf } from "../../../lib/registry.mjs";
import {
  ASK_GRANTS, EXAMPLE_QUESTIONS, askable, claimRead, claimsOf, commandsIn, inboxHandoff, noHandsAudit,
  readAnswer, readOnly, resolutionOf, segments, standingOf,
} from "../../../lib/ask.mjs";
import { Door } from "../../../lib/door.mjs";
import { decodeDoorText, fmtInt } from "../../../lib/inbox.mjs";

/** A door that can never be called: the audit reads the handle's SHAPE, and this fold makes no request. */
const SHAPE_ONLY = new Door({ fetchImpl: () => Promise.reject(new Error("the no-hands audit reads a shape, never the door")) });

/** @param {string} klass */
const standingInk = (klass) => (klass === "verified" || klass === "absence" ? "var(--accent)" : klass === "checking" ? "var(--text-3)" : "var(--text-1)");

/**
 * @typedef {object} Answer
 * @property {string} key
 * @property {string} question
 * @property {boolean} isPending
 * @property {boolean} isRefused
 * @property {boolean} isAnswered
 * @property {{ code: string, human: string }} refusal
 * @property {{ key: string, text: string, isCode: boolean, isEm: boolean, isText: boolean }[]} parts
 * @property {string} half
 * @property {string} halfLine
 * @property {string} standing
 * @property {string} standingLine
 * @property {string} standingInk
 * @property {{ key: string, raw: string, state: string, line: string, detail: string }[]} claims
 * @property {boolean} hasClaims
 * @property {string[]} commands
 * @property {boolean} hasCommands
 * @property {boolean} hasHandoff
 * @property {string} handoffLine
 *
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} draft
 * @property {boolean} canAsk
 * @property {string} blocked
 * @property {boolean} isBlocked
 * @property {boolean} isAsking
 * @property {string} askLabel
 * @property {string[]} examples
 * @property {Answer[]} answers
 * @property {boolean} hasAnswers
 * @property {string} answersChip
 * @property {string[]} noHands
 * @property {boolean} isClean
 * @property {string} audit
 * @property {string} reader
 * @property {string} readerLine
 * @property {boolean} canOpenInbox
 * @property {string} inboxRoom
 * @property {{ isServed: boolean, sentence: string, lede: string, status: string }} chatMcp
 * @property {import("../../../lib/registry.mjs").Read[]} reads
 */

/**
 * @param {Record<string, import("../../../lib/registry.mjs").Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Record<string, string>} */
  const picks = ctx.picks ?? {};
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [];
  const draft = picks.draft ?? "";
  const check = askable(draft);

  const actP = payloadOf(payloads, { route: "/api/ask", act: true });
  /** @type {import("../../../lib/registry.mjs").ActRecord[]} */
  const log = actP.state === "ok" && Array.isArray(actP.data) ? actP.data : [];
  const isAsking = log.some((r) => r.result.state === "pending");
  let lastHalf = "";
  let lastHalfLine = "";

  const answers = log.slice().reverse().map((rec) => {
    const question = typeof rec.body.q === "string" ? rec.body.q : "";
    const base = {
      key: String(rec.n), question, isPending: rec.result.state === "pending", isRefused: false, isAnswered: false,
      refusal: { code: "", human: "" }, parts: [], half: "", halfLine: "", standing: "", standingLine: "", standingInk: "var(--text-3)",
      claims: [], hasClaims: false, commands: [], hasCommands: false, hasHandoff: false, handoffLine: "",
    };
    const result = rec.result;
    if (result.state === "refused") return { ...base, isRefused: true, refusal: { code: result.code, human: result.human } };
    if (result.state !== "ok") return base;
    const asked = readAnswer(result.data);
    if (!asked.ok) return { ...base, isRefused: true, refusal: { code: asked.code, human: asked.human } };
    const claims = claimsOf(asked);
    /** @type {Record<string, import("../../../lib/ask.mjs").Resolution>} */
    const resolutions = {};
    for (const c of claims) {
      const read = claimRead(c);
      reads.push(read);
      const r = resolutionOf(c, payloadOf(payloads, read));
      if (r !== null) resolutions[c.key] = r;
    }
    const standing = standingOf(asked, claims, resolutions);
    const handoff = inboxHandoff(claims, resolutions);
    const commands = commandsIn(asked.answer);
    if (lastHalf === "") { lastHalf = asked.halfLabel; lastHalfLine = asked.halfLine; }
    return {
      ...base,
      isAnswered: true,
      parts: segments(asked.answer).map((s, i) => ({ key: String(i), text: s.text, isCode: s.type === "code", isEm: s.type === "em", isText: s.type === "text" })),
      half: asked.halfLabel,
      halfLine: asked.halfLine,
      standing: standing.label,
      standingLine: standing.line,
      standingInk: standingInk(standing.klass),
      claims: claims.map((c) => {
        const r = Object.hasOwn(resolutions, c.key) ? resolutions[c.key] : undefined;
        return { key: c.key, raw: c.raw, state: r === undefined ? "checking" : r.state, line: r === undefined ? "asking the door…" : r.line, detail: r === undefined || r.detail === null ? "" : r.detail };
      }),
      hasClaims: claims.length > 0,
      commands,
      hasCommands: commands.length > 0,
      hasHandoff: handoff !== null,
      handoffLine: handoff === null ? "" : handoff.line,
    };
  });

  const audit = noHandsAudit(readOnly(SHAPE_ONLY, ASK_GRANTS));
  const inboxRoom = (ctx.rooms || []).find((r) => r.holds && Array.isArray(r.holds.kinds) && r.holds.kinds.includes("approval.requested"));
  const chat = (ctx.rooms || []).find((r) => r.id === "chat-mcp");

  return {
    sentence: decodeDoorText(ctx.room.sentence),
    lede: decodeDoorText(ctx.room.lede),
    draft,
    canAsk: check.ok && !isAsking,
    blocked: check.ok ? "" : check.why,
    isBlocked: !check.ok && draft !== "",
    isAsking,
    askLabel: isAsking ? "Reading…" : "Ask →",
    examples: [...EXAMPLE_QUESTIONS],
    answers,
    hasAnswers: answers.length > 0,
    answersChip: `${fmtInt(answers.length)} this visit`,
    noHands: [
      "Reads the same live state the rooms render, through the door.",
      `May read ${audit.granted.join(", ")}; ${audit.withheld.join(", ") || "nothing that writes"} ${audit.withheld.length === 1 ? "is" : "are"} withheld from the handle it asks through.`,
      "No receipt, no claim: an answer that cannot cite says so, and a citation that does not resolve marks the answer unverified.",
      "The draft of a decision goes to the inbox; this room never stamps.",
    ],
    isClean: audit.clean,
    audit: audit.line,
    reader: lastHalf === "" ? "No question asked this visit" : lastHalf,
    readerLine: lastHalfLine === ""
      ? "The door answers deterministic-first: a question about live state has an exact answer computed from the log, which needs no model, no key and no spend."
      : lastHalfLine,
    canOpenInbox: inboxRoom !== undefined,
    inboxRoom: inboxRoom === undefined ? "" : inboxRoom.id,
    chatMcp: {
      isServed: chat !== undefined,
      sentence: chat === undefined ? "" : decodeDoorText(chat.sentence),
      lede: chat === undefined ? "" : decodeDoorText(chat.lede),
      status: chat === undefined ? "" : `${chat.status} · drawn dotted`,
    },
    reads,
  };
}
