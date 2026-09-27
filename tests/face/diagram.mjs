// The Reference room's diagrams (Phase 07 PR C, REQ-12, ADR-1348 section 4): face/src/lib/diagram.mjs turns a flow or
// loop spec into geometry, and check() is the honesty of that picture -- no overlapping boxes, every arrow ending on a
// box, the divider in the gap it names. The owner's two figures (arc-wiki-engine_1.html) lay out clean; each mutant of
// their geometry is caught; a spec that cannot be drawn says why instead of drawing something wrong.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib", "diagram.mjs");
const { flow, loop, check } = await import(pathToFileURL(LIB).href);
let ran = 0, failed = 0;
const arm = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};
const clone = (g) => JSON.parse(JSON.stringify(g));

const FIG1 = [
  "source: arc-run --process X",
  "box: Guards | args · budget · root",
  "box: Route | class → tier → driver",
  "box: Terms + boundary | tenure · cap · hosted",
  "box*: Dispatch | driver subprocess",
  "box: Verify + receipt | schema → spine",
  "labels: clean, routed, allowed, JSON",
  "out: exit 2 | operator error",
  "out: exit 2 | unknown class",
  "out: exit 5 | expired row · boundary",
  "out: exit 1 | driver fault",
  "out+: exit 0 | run.completed",
  "divider: 3 | free to refuse | money is spent",
  "note: Three refusals happen before any provider is contacted.",
  "caption: Figure 1 — a run, end to end. | The dashed red line is the money line.",
].join("\n");
const FIG2 = [
  "top: 1 | free, reversible",
  "top: 4 | costs money, leaves receipts",
  "stage~: 1 · Trial | one job, off the rota",
  "stage: 2 · Certify | fixtures green against the real thing",
  "stage: 3 · Hire | one reviewed rota row",
  "stage*: 4 · Working | dispatches · receipts",
  "stage!: 5 · Review date | contract expires",
  "labels: promising, passes, merged, time",
  "reject: 1 | drop it — nothing to undo",
  "fork: Re-justify | new date, reviewed diff",
  "fork!: Retire | revoke key, delete row",
  "back: fork -> 4 | back to work",
  "caption: Figure 2 — the life of a worker.",
].join("\n");

const f1 = flow(FIG1), f2 = loop(FIG2);
arm("fixture: both of the owner's figures lay out with boxes and arrows (vacuous-pass guard)",
  f1.boxes.length === 10 && f1.arrows.length === 9 && f2.boxes.length === 7 && f2.arrows.length >= 8, `${f1.boxes.length}/${f1.arrows.length} ${f2.boxes.length}/${f2.arrows.length}`);
arm("flow: Figure 1 lays out clean -- no spec problem and check() finds nothing", f1.problems.length === 0 && check(f1).length === 0, JSON.stringify([f1.problems, check(f1)]));
arm("flow: the money line stands between box 3 and box 4, and spans the refusal boxes",
  !!f1.divider && f1.divider.x > f1.boxes[2].x + f1.boxes[2].w && f1.divider.x < f1.boxes[3].x && f1.divider.y2 > f1.boxes[5].y + f1.boxes[5].h);
arm("loop: Figure 2 lays out clean, with a dashed arrow back to stage 4 and two forks",
  f2.problems.length === 0 && check(f2).length === 0 && f2.arrows.some((a) => a.key === "back" && a.dash !== "") && f2.boxes.filter((b) => b.key.startsWith("f")).length === 2,
  JSON.stringify([f2.problems, check(f2)]));

const overlap = clone(f1); overlap.boxes[1].x = overlap.boxes[0].x + 10;
const dangling = clone(f1); dangling.ends[0].x = 5; dangling.ends[0].y = 5;
const cut = clone(f1); cut.divider.x = cut.boxes[1].x + cut.boxes[1].w / 2;
const outside = clone(f2); outside.boxes[0].x = outside.w - 5;
arm("MUTANT overlap: a box moved onto its neighbour is caught", check(overlap).some((p) => p.includes("overlap")), JSON.stringify(check(overlap)));
arm("MUTANT dangling: an arrow ending on no box is caught", check(dangling).some((p) => p.includes("on no box")), JSON.stringify(check(dangling)));
arm("MUTANT divider: a money line moved into a box is caught", check(cut).some((p) => p.includes("cuts through")), JSON.stringify(check(cut)));
arm("MUTANT outside: a box pushed off the figure is caught", check(outside).some((p) => p.includes("outside the figure")), JSON.stringify(check(outside)));

const bad = {
  one: flow("box: A"),
  eight: flow(Array.from({ length: 8 }, (_, i) => `box: B${i}`).join("\n")),
  divider: flow("box: A\nbox: B\ndivider: 2 | x | y"),
  unknown: flow("box: A\nbox: B\nzap: 1"),
  labels: flow("box: A\nbox: B\nbox: C\nlabels: only-one"),
  long: flow("box: A title far too long to ever fit inside one box of a five box flow figure\nbox: B\nbox: C\nbox: D\nbox: E"),
  noFork: loop("stage: A\nstage: B\nback: fork -> 1"),
  backward: loop("stage: A\nstage: B\nback: last -> 2"),
};
const silent = Object.entries(bad).filter(([, g]) => g.problems.length === 0).map(([k]) => k);
arm("spec: a flow or loop that cannot be drawn honestly says why -- 1 or 8 boxes, a misplaced divider, an unknown line, a label count, a title too long, a back arrow with nowhere to go",
  silent.length === 0, `no problem reported for: ${silent.join(", ")}`);

const colours = [f1, f2].flatMap((g) => [...g.boxes.flatMap((b) => [b.fill, b.stroke, ...b.lines.map((l) => l.fill)]), ...g.arrows.map((a) => a.stroke), ...g.labels.map((l) => l.fill)]);
arm("tokens: every colour a figure uses is a face token, never a literal", colours.length > 20 && colours.every((c) => /^var\(--[a-z0-9-]+\)$/.test(c)), colours.filter((c) => !/^var\(--/.test(c)).join(" "));
arm("pure: diagram.mjs imports nothing, so node asserts the picture with no install", !/^\s*import\s/m.test(readFileSync(LIB, "utf8")));

console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 11 ? 0 : 1;
