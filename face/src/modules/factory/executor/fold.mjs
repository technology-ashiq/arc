// fold.mjs -- factory/executor: every decision the executor room makes, where node can import it with no install
// (face v2 Phase 03, company ring PR, ADR-1320, ADR-1324, ADR-1326, ADR-1327).
//
// v0.7's Executor: the hired hands. arc does not serve this room -- the owner's ruling left it an ADR-1327 exemption
// (ADR-1337) -- so the shell draws it from its exemption row. What is real: the employees, every agent the served
// registry homes (spawned in-house for a task, then gone); and the file the contractors are hired in, engine/router.yaml,
// by its provenance through the door. What is not served: the hires on the books with their four tenure terms, their
// certification and their runs, which /api/roster will fold. Hiring is a session and dispatching and terminating are
// verbs -- none is a button here.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { fmtInt } from "../../../lib/inbox.mjs";
import { fileText } from "../../../lib/company-room.mjs";
import { heldAcrossRooms, roomLink } from "../../../lib/lane-room.mjs";

/** @typedef {import("../../../lib/registry.mjs").Payload} Payload */
/** @typedef {import("../../../lib/registry.mjs").Read} Read */

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {string} badge
 * @property {{ key: string, v: string, l: string, sub: string }[]} kpis
 * @property {import("../../../lib/lane-room.mjs").SourceFile} router
 * @property {import("../../../lib/registry.mjs").NotServed} hires
 * @property {import("../../../lib/registry.mjs").NotServed} certification
 * @property {import("../../../lib/registry.mjs").NotServed} runs
 * @property {{ isVerbPending: true, verb: string, sentence: string }} hireVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} dispatchVerb
 * @property {{ isVerbPending: true, verb: string, sentence: string }} terminateVerb
 * @property {{ canOpen: boolean, room: string }} agentsLink
 * @property {{ canOpen: boolean, room: string }} engineLink
 * @property {string[]} terms
 * @property {Read[]} reads
 */

/**
 * @param {Record<string, Payload>} payloads
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  /** @type {Read[]} */
  const reads = [];
  const held = heldAcrossRooms(ctx, "agents");
  const router = fileText(payloads, ctx, "router", reads).source;
  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: "not in arc's registry · ADR-1327",
    kpis: [
      { key: "employees", v: held.unreadable.length > 0 ? "—" : fmtInt(new Set(held.rows.map((r) => r.name)).size), l: "Employees", sub: "agents, spawned in-house per task" },
      { key: "contractors", v: "—", l: "Contractors on tenure", sub: "not served yet · /api/roster" },
      { key: "certified", v: "—", l: "Certified", sub: "twelve fixtures · not served yet" },
      { key: "runs", v: "—", l: "Runs dispatched", sub: "not served yet · /api/roster" },
    ],
    router,
    hires: notServed(
      "Hires on the books",
      "/api/roster",
      "Every contractor hired in engine/router.yaml with its four terms -- cap, hosted, judge and review_by, its tenure -- the decision that hired it, and the ones past their tenure date.",
    ),
    certification: notServed(
      "Certification",
      "/api/roster",
      "The twelve-fixture certification each hire passes before it is dispatched anything, and which fixture a failed one missed.",
    ),
    runs: notServed(
      "Runs",
      "/api/roster",
      "Every dispatch with its outcome, its receipt and the judge's verdict on the draft it produced.",
    ),
    hireVerb: verbPending(
      "Hire someone",
      "A hire is a session: the four tenure terms are mandatory, the certification runs, and the row lands only on your approval. The work door starts it; the session itself runs through the session door.",
    ),
    dispatchVerb: verbPending(
      "Dispatch a task",
      "A task goes to a certified hire under its cap, and its draft comes back through a judge. It arrives with the work door.",
    ),
    terminateVerb: verbPending(
      "Terminate a hire",
      "A hire past its tenure date is refused by name and proposed for rejustify-or-retire; ending one is a recorded decision, never a quiet edit to its row. It arrives with the work door.",
    ),
    agentsLink: roomLink(ctx, "agents"),
    engineLink: roomLink(ctx, "engine-room"),
    terms: [
      "arc verifies outcomes and never prescribes a contractor's process.",
      "The credential is the leash: a hire reaches only what its cap names, and is refused by name past its tenure date.",
      "A hire is a receipt (ADR-0217), and every hire is planned obsolescence (ADR-0216).",
    ],
    reads,
  };
}
