// fold.mjs -- company/law: every decision the law room makes, where node can import it with no install
// (face v2 Phase 03, company ring, ADR-1320, ADR-1324).
//
// The port of v0.7's Law onto the door. v0.7 typed its articles and its precedence into the bundle; here every one is
// read from CONSTITUTION.md as the door serves it -- the version, the precedence line, the adoption line, the three
// eternal articles, the working ones, how an amendment is made and the teeth -- so the room says what the file says,
// and a section the file stops carrying reads as unread rather than as no law at all. The adoption receipts are the
// spine's: the registry homes constitution.adopted here. There is no verb: an amendment is the owner's, by the CLI.
import { fmtInt } from "../../../lib/inbox.mjs";
import { constitutionOf, fileText } from "../../../lib/company-room.mjs";
import { countedOn, kindCount, laneRoom } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/company-room.mjs").Article} Article */

/**
 * @typedef {import("../../../lib/lane-room.mjs").LaneRoom & {
 *   badge: string,
 *   kpis: { key: string, v: string, l: string, sub: string }[],
 *   doc: import("../../../lib/lane-room.mjs").SourceFile,
 *   law: import("../../../lib/company-room.mjs").Constitution,
 *   isLawRead: boolean,
 *   precedence: { key: string, label: string, isFirst: boolean, isLast: boolean }[],
 *   hasPrecedence: boolean,
 *   adoption: string,
 *   eternal: Article[],
 *   working: Article[],
 *   eternalNote: string,
 *   workingNote: string,
 *   amendment: string[],
 *   amendmentNote: string,
 *   teeth: string[],
 *   teethNote: string,
 *   amendBy: string,
 *   showEternalNote: boolean,
 *   showWorkingNote: boolean,
 *   isAmendmentEmpty: boolean,
 *   isTeethEmpty: boolean,
 * }} Folded
 */

const UNREAD = "the file the door served carries no such section, so none is drawn -- and none is claimed absent";
const UNREADABLE = "the file carries this section in a shape this reader cannot read, so none is drawn -- and none is claimed absent";

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  const base = laneRoom(payloads, ctx, { trailEmpty: "No constitution.adopted receipt is on the page the door sent." });
  /** @type {import("../../../lib/registry.mjs").Read[]} */
  const reads = [];
  const file = fileText(payloads, ctx, "constitution", reads);
  const law = constitutionOf(file.text);
  const isLawRead = file.source.isRead && law.isRead;
  /** @param {unknown[]} list @param {string} key */
  const count = (list, key) => (isLawRead && !law.unread.includes(key) && !law.unreadable.includes(key) ? fmtInt(list.length) : "—");
  /** @param {string} key @param {string} what */
  const note = (key, what) => (!isLawRead ? "" : law.unread.includes(key) ? `${what}: ${UNREAD}.` : law.unreadable.includes(key) ? `${what}: ${UNREADABLE}.` : "");
  return {
    ...base,
    reads: [...base.reads, ...reads],
    badge: isLawRead && law.version !== "" ? `the constitution · ${law.version}` : "the constitution · not read",
    kpis: [
      { key: "eternal", v: count(law.eternal, "eternal"), l: "Eternal articles", sub: "unamendable -- read from the file" },
      { key: "working", v: count(law.working, "working"), l: "Working articles", sub: "amendable, with friction" },
      { key: "version", v: isLawRead && law.version !== "" ? law.version : "—", l: "Version", sub: "the file's own title" },
      { key: "adopted", v: kindCount(base, "constitution.adopted"), l: "Adoption receipts", sub: countedOn(base, "constitution.adopted") },
    ],
    doc: file.source,
    law,
    isLawRead,
    precedence: law.precedence.map((label, i) => ({ key: `${i}-${label}`, label, isFirst: i === 0, isLast: i === law.precedence.length - 1 })),
    hasPrecedence: isLawRead && law.precedence.length > 0,
    adoption: isLawRead ? law.adoption : "",
    eternal: isLawRead ? law.eternal : [],
    working: isLawRead ? law.working : [],
    eternalNote: note("eternal", "Eternal articles"),
    workingNote: note("working", "Working articles"),
    amendment: isLawRead ? law.amendment : [],
    amendmentNote: note("amendment", "Amendment process"),
    teeth: isLawRead ? law.teeth : [],
    teethNote: note("enforcement", "Enforcement"),
    showEternalNote: note("eternal", "x") !== "",
    showWorkingNote: note("working", "x") !== "",
    isAmendmentEmpty: !isLawRead || law.amendment.length === 0,
    isTeethEmpty: !isLawRead || law.teeth.length === 0,
    amendBy: "An amendment is the owner's alone, by the steps the constitution states above, and it lands as a fresh constitution.adopted receipt that supersedes the last. No machine amends, and this room offers no button for it.",
  };
}
