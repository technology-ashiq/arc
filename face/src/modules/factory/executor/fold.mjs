// fold.mjs -- factory/executor: every decision the executor room makes, where node can import it with no install
// (face v2 Phase 03, company ring PR, ADR-1320, ADR-1324, ADR-1326, ADR-1327).
//
// v0.7's Executor: the hired hands. arc does not serve this room -- the owner's ruling left it an ADR-1327 exemption
// (ADR-1337) -- so the shell draws it from its exemption row. What is real: the employees, every agent the served
// registry homes (spawned in-house for a task, then gone); and the file the contractors are hired in, engine/router.yaml,
// by its provenance through the door; and -- through /api/roster (Phase 04) -- the hires on the books with their four
// tenure terms, judged against today, and every dispatch through the runtime with its outcome. What is still NOT
// SERVED: certification, which the engine lane writes as Markdown evidence that no parser reads into a table, and the
// judge's verdict on a draft, which no receipt carries. Hiring is a session and dispatching and terminating are
// verbs -- none is a button here.
import { notServed, verbPending } from "../../../lib/registry.mjs";
import { asArray, cell, field, servedRead, servedTable } from "../../../lib/served.mjs";
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
 * @property {import("../../../lib/served.mjs").ServedTable} hires
 * @property {import("../../../lib/registry.mjs").NotServed} certification
 * @property {import("../../../lib/served.mjs").ServedTable} runs
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
  const st = servedRead(payloads, ctx, reads, "/api/roster");
  const today = field(st.body, "today");
  const hiresTable = servedTable(st, {
    panel: "Hires on the books",
    route: "/api/roster",
    columns: ["hired for", "cap · hosted", "judge", "tenure"],
    listKey: "hires",
    empty: "engine/router.yaml hires no contractor: no row routes to the runtime or carries tenure terms.",
    row: (h) => {
      const name = field(h, "name");
      return name === "" ? null : { key: name, cells: [`${name} · ${field(h, "driver")}`, `${field(h, "cap") || "no cap"} · ${field(h, "hosted") || "hosting unstated"}`, field(h, "judge") || "no judge", `review by ${field(h, "review_by") || "—"}${h["expired"] === true ? " · PAST IT: refused by name" : ""}`] };
    },
    note: [
      today !== "" ? `tenure judged against ${today}` : "",
      "the decision that hired each row is cited in the router file's comments, which its parser does not keep",
    ].filter((n) => n !== "").join(" · "),
  });
  const runsTable = servedTable(st, {
    panel: "Runs",
    route: "/api/roster",
    columns: ["dispatched", "process", "outcome", "receipt"],
    listKey: "runs",
    empty: "No dispatch through the runtime is on this spine.",
    row: (r) => {
      const id = field(r, "id");
      const ms = typeof r["duration_ms"] === "number" ? ` · ${cell(r["duration_ms"])} ms` : "";
      return id === "" ? null : { key: id, cells: [field(r, "ts").slice(0, 16), `${field(r, "process")} · ${field(r, "driver")}`, `${field(r, "outcome") || "unstated"}${ms}`, id] };
    },
    note: "the judge's verdict on a draft is not carried by the run receipt, so it is not drawn",
  });
  return {
    sentence: String(ctx.room.sentence ?? ""),
    lede: String(ctx.room.lede ?? ""),
    badge: "not in arc's registry · ADR-1327",
    kpis: [
      { key: "employees", v: held.unreadable.length > 0 ? "—" : fmtInt(new Set(held.rows.map((r) => r.name)).size), l: "Employees", sub: "agents, spawned in-house per task" },
      { key: "contractors", v: hiresTable.isDrawn ? fmtInt(hiresTable.rows.length) : "—", l: "Contractors on tenure", sub: st.isRead ? "hired in engine/router.yaml" : "reading /api/roster" },
      { key: "certified", v: "—", l: "Certified", sub: "not served · no parser reads the certification evidence" },
      { key: "runs", v: runsTable.isDrawn ? fmtInt(runsTable.rows.length) : "—", l: "Runs dispatched", sub: st.isRead ? "through the runtime, on this spine" : "reading /api/roster" },
    ],
    router,
    hires: hiresTable,
    certification: notServed(
      "Certification",
      "/api/roster",
      "The certification each hire passes before it is dispatched anything, fixture by fixture, and which fixture a failed one missed. The engine lane writes it as Markdown evidence, and no parser reads that into a table yet -- filed to the engine lane.",
    ),
    runs: runsTable,
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
