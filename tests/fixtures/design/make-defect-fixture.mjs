// Regenerate the planted-defect fixture from the real route.
//
// The fixture is a defect-INJECTED CLONE, generated rather than hand-edited, so that when the
// real page changes the fixture can be rebuilt instead of drifting into a stale copy of a page
// that no longer exists. The planted defects are the contract: a critic reading the rendered
// PNG must class at least the lorem ipsum as VIOLATION. If it does not, the critique protocol
// is not working, and that is exactly what this fixture exists to prove.
//
//   node tests/fixtures/design/make-defect-fixture.mjs
//
// Anchors are asserted, never assumed: a silent no-op replace would produce a fixture with no
// defects in it, which would then "pass" every critique and prove nothing.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "docs/strategy/arc-hq-mockup.html";
const OUT = "tests/fixtures/design/arc-hq-mockup-defect.html";

let t = readFileSync(SRC, "utf8");

const must = (needle, label) => {
  if (!t.includes(needle)) {
    console.error(`make-defect-fixture: anchor missing (${label}) -- the real page changed shape.`);
    console.error("Update the anchor here rather than shipping a fixture with no planted defect.");
    process.exit(1);
  }
};

// DEFECT 1 -- lorem ipsum shipped as content. Always a VIOLATION (content contract, frozen
// plan 2.4 D). The single most unambiguous thing a design critic must never let through.
const EVENT = "Nightly hunt: 214 posts scanned (r/smallbusiness, r/IndiaTax) → clustered → <b>5 candidates scored</b>";
must(EVENT, "06:02 event text");
t = t.replace(EVENT, "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do <b>eiusmod tempor</b>");

// DEFECT 2 + 3 -- KPI labels far below the AA contrast floor, and two KPI cards given random
// corner radii, breaking the shape system. Both are visible ONLY in the render, which is the
// point: they are invisible to a source read and obvious to a vision pass.
must("</style>", "stylesheet close");
t = t.replace(
  "</style>",
  [
    "  /* planted defect: KPI labels at ~1.4:1, far below the declared AA floor */",
    "  .kpi .label{color:#232320 !important}",
    "  /* planted defect: random radii breaking the shape system */",
    "  .kpi:nth-child(2){border-radius:22px !important}",
    "  .kpi:nth-child(4){border-radius:2px !important}",
    "</style>",
  ].join("\n"),
);

must("<title>", "title tag");
t = t.replace(
  "<title>",
  [
    "<!-- FIXTURE -- defect-injected clone of docs/strategy/arc-hq-mockup.html.",
    "     Regenerate: node tests/fixtures/design/make-defect-fixture.mjs",
    "     Planted defects:",
    "       1. lorem ipsum in the 06:02 event  (content contract -> VIOLATION)",
    "       2. KPI labels below AA contrast     (a11y floor      -> VIOLATION)",
    "       3. inconsistent radii on KPI 2 + 4  (shape system    -> WEAKNESS or VIOLATION)",
    "     Never edit this file by hand and never point a live surface at it. -->",
    "<title>DEFECT FIXTURE — ",
  ].join("\n"),
);

writeFileSync(OUT, t);
console.log(`make-defect-fixture: wrote ${OUT} (3 planted defects)`);
