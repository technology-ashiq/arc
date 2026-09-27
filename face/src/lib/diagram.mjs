// diagram.mjs -- the Reference room's two diagram layouts, computed from a small spec (ADR-1348 section 4).
//
// A narrative carries a fenced ```flow or ```loop block; this turns its spec into geometry -- boxes, arrow paths,
// labels, a divider -- that the kit's <Diagram> only maps to <svg> elements. Every number and every colour token is
// decided here, so node can assert the picture without a browser: `check()` is what the fixture runs, and a spec
// this cannot lay out honestly comes back with its problems, which the page shows instead of a wrong picture.
//
// Two layouts and no third (ADR-1348's revisit trigger):
//   flow -- boxes left to right with a label on each arrow, an optional refusal box under each, an optional divider
//           (the "money line") between two boxes with a caption either side. Figure 1 of arc-wiki-engine_1.html.
//   loop -- stages left to right, an optional fork into two outcomes, and a dashed arrow back to an earlier stage.
//           Figure 2 of the same page.
//
// Spec grammar, one `key: value` per line; `Title | sub-line` splits a box's two lines:
//   flow: box / box* (highlighted) · labels: a, b, c · out / out+ (ok) / out: - (none) · divider: <after box n> |
//         left | right · source: text · note: text · caption: Title | rest
//   loop: stage / stage* / stage! (warn) / stage~ (dashed) · labels · top: <n> | text · reject: <n> | text ·
//         fork / fork! (two at most) · back: fork -> <n> | label  or  back: last -> <n> | label · note · caption

export const VIEW_W = 920;
const M = 20;
const INNER = VIEW_W - 2 * M;

const TONE = {
  plain: { fill: "var(--bg-2)", stroke: "var(--text-2)", ink: "var(--text-1)", sub: "var(--text-2)", width: 1.4 },
  accent: { fill: "var(--accent-wash)", stroke: "var(--accent)", ink: "var(--accent)", sub: "var(--accent)", width: 2 },
  warn: { fill: "var(--bg-3)", stroke: "var(--red)", ink: "var(--red)", sub: "var(--red)", width: 1.6 },
  ok: { fill: "var(--accent-wash)", stroke: "var(--accent)", ink: "var(--accent)", sub: "var(--accent)", width: 1.2 },
};

/**
 * @typedef {{ key: string, x: number, y: number, w: number, h: number, rx: number, fill: string, stroke: string,
 *   strokeWidth: number, dash: string, lines: { key: string, x: number, y: number, text: string, size: number,
 *   weight: number, fill: string, mono: boolean }[] }} Box
 * @typedef {{ key: string, d: string, stroke: string, dash: string, head: "ink"|"warn"|"none" }} Arrow
 * @typedef {{ key: string, x: number, y: number, text: string, size: number, fill: string, anchor: "start"|"middle"|"end", mono: boolean, weight: number }} Label
 * @typedef {{ kind: "flow"|"loop", w: number, h: number, boxes: Box[], arrows: Arrow[], labels: Label[],
 *   divider: { x: number, y1: number, y2: number } | null, caption: { title: string, rest: string },
 *   ends: { x: number, y: number, arrow: string }[], problems: string[] }} Geometry
 */

const str = /** @param {unknown} v @returns {string} */ (v) => (typeof v === "string" ? v : "");

/** @param {string} text @returns {{ key: string, mark: string, value: string }[]} */
function specLines(text) {
  /** @type {{ key: string, mark: string, value: string }[]} */
  const out = [];
  for (const raw of str(text).split(/\r?\n/)) {
    const l = raw.trim();
    if (l === "" || l.startsWith("#")) continue;
    const m = /^([a-z]+)([*!~+]?)\s*:\s*(.*)$/.exec(l);
    out.push(m ? { key: str(m[1]), mark: str(m[2]), value: str(m[3]).trim() } : { key: "", mark: "", value: l });
  }
  return out;
}

const pair = /** @param {string} v @returns {[string, string]} */ (v) => {
  const i = v.indexOf("|");
  return i < 0 ? [v.trim(), ""] : [v.slice(0, i).trim(), v.slice(i + 1).trim()];
};

/** Approximate advance width of a system-ui glyph, as a share of the font size. */
const CHAR = 0.52;
const fits = /** @param {string} t @param {number} size @param {number} w */ (t, size, w) => t.length * size * CHAR <= w;

/**
 * Wrap a line into at most `max` lines that fit `w` at `size`; whatever cannot fit is reported, never clipped silently.
 * @param {string} text @param {number} size @param {number} w @param {number} max @param {string[]} problems @param {string} where
 * @returns {string[]}
 */
function wrap(text, size, w, max, problems, where) {
  if (text === "") return [];
  const words = text.split(/\s+/);
  /** @type {string[]} */
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur === "" ? word : `${cur} ${word}`;
    if (fits(next, size, w) || cur === "") cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur !== "") lines.push(cur);
  if (lines.length > max || lines.some((l) => !fits(l, size, w))) problems.push(`${where}: "${text}" does not fit its box -- shorten it`);
  return lines.slice(0, max);
}

/**
 * A box with a title and up to two sub-lines, centred.
 * @param {string} key @param {number} x @param {number} y @param {number} w @param {number} h @param {keyof TONE} tone
 * @param {string} title @param {string} sub @param {boolean} dashed @param {string[]} problems @returns {Box}
 */
function box(key, x, y, w, h, tone, title, sub, dashed, problems) {
  const t = TONE[tone];
  let size = 13;
  if (!fits(title, size, w - 12)) size = 11.5;
  const tl = wrap(title, size, w - 12, 1, problems, `${key} title`);
  const sl = wrap(sub, 10.5, w - 12, h >= 60 ? 2 : 1, problems, `${key} sub-line`);
  const rows = tl.length + sl.length;
  const lineH = 16;
  let cy = y + h / 2 - ((rows - 1) * lineH) / 2 + 4;
  const lines = [];
  for (const [i, text] of tl.entries()) { lines.push({ key: `${key}-t${i}`, x: x + w / 2, y: cy, text, size, weight: tone === "plain" ? 600 : 700, fill: t.ink, mono: false }); cy += lineH; }
  for (const [i, text] of sl.entries()) { lines.push({ key: `${key}-s${i}`, x: x + w / 2, y: cy - 1, text, size: 10.5, weight: 400, fill: t.sub, mono: false }); cy += lineH - 2; }
  return { key, x, y, w, h, rx: 8, fill: t.fill, stroke: t.stroke, strokeWidth: t.width, dash: dashed ? "5 4" : "", lines };
}

const toneOf = /** @param {string} mark @returns {keyof TONE} */ (mark) => (mark === "*" ? "accent" : mark === "!" ? "warn" : mark === "+" ? "ok" : "plain");

/** @param {string} v @returns {{ title: string, rest: string }} */
const captionOf = (v) => { const [title, rest] = pair(v); return { title, rest }; };

/**
 * @param {string} text the fenced block's body
 * @returns {Geometry}
 */
export function flow(text) {
  /** @type {string[]} */
  const problems = [];
  const spec = specLines(text);
  const specBoxes = spec.filter((s) => s.key === "box");
  const outs = spec.filter((s) => s.key === "out");
  const labelsLine = spec.find((s) => s.key === "labels");
  const labelTexts = labelsLine ? labelsLine.value.split(",").map((s) => s.trim()) : [];
  const dividerLine = spec.find((s) => s.key === "divider");
  const source = str(spec.find((s) => s.key === "source")?.value);
  const note = str(spec.find((s) => s.key === "note")?.value);
  const caption = captionOf(str(spec.find((s) => s.key === "caption")?.value));
  for (const s of spec) if (!["box", "out", "labels", "divider", "source", "note", "caption"].includes(s.key)) problems.push(`flow: "${s.key || s.value}" is not a flow line`);

  const n = specBoxes.length;
  if (n < 2 || n > 7) problems.push(`flow: ${n} boxes -- a flow draws 2 to 7`);
  if (labelTexts.length > 0 && labelTexts.length !== n - 1) problems.push(`flow: ${labelTexts.length} arrow labels for ${n - 1} arrows`);
  if (outs.length > n) problems.push(`flow: ${outs.length} refusal boxes for ${n} boxes`);

  const gap = n <= 5 ? 45 : 26;
  const w = n > 0 ? (INNER - (n - 1) * gap) / n : INNER;
  const y0 = source !== "" ? 60 : 40;
  const h = 66;
  const hasOuts = outs.some((o) => o.value !== "-");
  let divider = null;
  let after = 0;
  if (dividerLine) {
    after = Number.parseInt(pair(dividerLine.value)[0], 10);
    if (!Number.isInteger(after) || after < 1 || after >= n) problems.push(`flow: divider after box ${pair(dividerLine.value)[0]} -- it goes between two boxes, 1 to ${n - 1}`);
  }
  /** @type {Box[]} */
  const boxes = [];
  /** @type {Arrow[]} */
  const arrows = [];
  /** @type {Label[]} */
  const labels = [];
  /** @type {{ x: number, y: number, arrow: string }[]} */
  const ends = [];
  for (const [i, s] of specBoxes.slice(0, 7).entries()) {
    const [title, sub] = pair(s.value);
    boxes.push(box(`b${i}`, M + i * (w + gap), y0, w, h, toneOf(s.mark), title, sub, false, problems));
  }
  for (let i = 0; i + 1 < boxes.length; i++) {
    const a = /** @type {Box} */ (boxes[i]), b = /** @type {Box} */ (boxes[i + 1]);
    const y = y0 + h / 2;
    arrows.push({ key: `a${i}`, d: `M${a.x + a.w},${y} L${b.x - 4},${y}`, stroke: "var(--text-2)", dash: "", head: "ink" });
    ends.push({ x: a.x + a.w, y, arrow: `a${i}` }, { x: b.x, y, arrow: `a${i}` });
    const lt = str(labelTexts[i]);
    if (lt !== "") {
      if (!fits(lt, 10, gap + 30)) problems.push(`flow: arrow label "${lt}" is longer than its arrow`);
      labels.push({ key: `l${i}`, x: a.x + a.w + gap / 2, y: y - 9, text: lt, size: 10, fill: "var(--text-3)", anchor: "middle", mono: false, weight: 400 });
    }
  }
  const outY = y0 + h + 54;
  for (const [i, o] of outs.slice(0, boxes.length).entries()) {
    if (o.value === "-") continue;
    const b = /** @type {Box} */ (boxes[i]);
    const [title, sub] = pair(o.value);
    const tone = o.mark === "+" ? "ok" : "warn";
    boxes.push(box(`o${i}`, b.x + 2, outY, b.w - 4, 42, tone, title, sub, false, problems));
    const cx = b.x + b.w / 2;
    arrows.push({ key: `r${i}`, d: `M${cx},${y0 + h} L${cx},${outY - 4}`, stroke: tone === "ok" ? "var(--text-2)" : "var(--red)", dash: "", head: tone === "ok" ? "ink" : "warn" });
    ends.push({ x: cx, y: y0 + h, arrow: `r${i}` }, { x: cx, y: outY, arrow: `r${i}` });
  }
  const bottom = hasOuts ? outY + 42 : y0 + h;
  if (dividerLine && after >= 1 && after < boxes.length && after < n) {
    const a = /** @type {Box} */ (boxes[after - 1]), b = /** @type {Box} */ (boxes[after]);
    // Right of the gap's middle, so the arrow label centred in the gap stays readable beside the line.
    const x = a.x + a.w + (b.x - a.x - a.w) * 0.78;
    divider = { x, y1: y0 - 28, y2: bottom + 34 };
    const [, left = "", right = ""] = dividerLine.value.split("|").map((s) => s.trim());
    if (left !== "") labels.push({ key: "dl", x: x - 8, y: bottom + 30, text: left, size: 10.5, fill: "var(--red)", anchor: "end", mono: true, weight: 400 });
    if (right !== "") labels.push({ key: "dr", x: x + 8, y: bottom + 30, text: right, size: 10.5, fill: "var(--red)", anchor: "start", mono: true, weight: 400 });
  }
  if (source !== "") labels.push({ key: "src", x: M, y: y0 - 12, text: source, size: 11, fill: "var(--text-3)", anchor: "start", mono: true, weight: 400 });
  let hgt = bottom + (divider ? 48 : 20);
  if (note !== "") {
    if (!fits(note, 11.5, INNER)) problems.push(`flow: the note is longer than the figure is wide`);
    labels.push({ key: "note", x: VIEW_W / 2, y: hgt + 6, text: note, size: 11.5, fill: "var(--text-3)", anchor: "middle", mono: false, weight: 400 });
    hgt += 26;
  }
  return { kind: "flow", w: VIEW_W, h: hgt, boxes, arrows, labels, divider, caption, ends, problems };
}

/**
 * @param {string} text the fenced block's body
 * @returns {Geometry}
 */
export function loop(text) {
  /** @type {string[]} */
  const problems = [];
  const spec = specLines(text);
  const stages = spec.filter((s) => s.key === "stage");
  const forks = spec.filter((s) => s.key === "fork");
  const labelsLine = spec.find((s) => s.key === "labels");
  const labelTexts = labelsLine ? labelsLine.value.split(",").map((s) => s.trim()) : [];
  const backLine = spec.find((s) => s.key === "back");
  const note = str(spec.find((s) => s.key === "note")?.value);
  const caption = captionOf(str(spec.find((s) => s.key === "caption")?.value));
  for (const s of spec) if (!["stage", "fork", "labels", "back", "top", "reject", "note", "caption"].includes(s.key)) problems.push(`loop: "${s.key || s.value}" is not a loop line`);

  const n = stages.length;
  if (n < 2 || n > 6) problems.push(`loop: ${n} stages -- a loop draws 2 to 6`);
  if (forks.length > 2) problems.push(`loop: ${forks.length} forks -- a loop forks into two at most`);
  if (labelTexts.length > 0 && labelTexts.length !== n - 1) problems.push(`loop: ${labelTexts.length} arrow labels for ${n - 1} arrows`);

  const gap = 35;
  const w = n > 0 ? (INNER - (n - 1) * gap) / n : INNER;
  const y0 = spec.some((s) => s.key === "top") ? 70 : 40;
  const h = 70;
  /** @type {Box[]} */
  const boxes = [];
  /** @type {Arrow[]} */
  const arrows = [];
  /** @type {Label[]} */
  const labels = [];
  /** @type {{ x: number, y: number, arrow: string }[]} */
  const ends = [];
  for (const [i, s] of stages.slice(0, 6).entries()) {
    const [title, sub] = pair(s.value);
    boxes.push(box(`s${i}`, M + i * (w + gap), y0, w, h, s.mark === "~" ? "plain" : toneOf(s.mark), title, sub, s.mark === "~", problems));
  }
  const stageBox = /** @param {number} i @returns {Box} */ (i) => /** @type {Box} */ (boxes[i]);
  const nStages = boxes.length;
  for (let i = 0; i + 1 < nStages; i++) {
    const a = stageBox(i), b = stageBox(i + 1);
    const y = y0 + h / 2;
    arrows.push({ key: `a${i}`, d: `M${a.x + a.w},${y} L${b.x - 4},${y}`, stroke: "var(--text-2)", dash: "", head: "ink" });
    ends.push({ x: a.x + a.w, y, arrow: `a${i}` }, { x: b.x, y, arrow: `a${i}` });
    const lt = str(labelTexts[i]);
    if (lt !== "") {
      if (!fits(lt, 9.5, gap + 30)) problems.push(`loop: arrow label "${lt}" is longer than its arrow`);
      labels.push({ key: `l${i}`, x: a.x + a.w + gap / 2, y: y - 9, text: lt, size: 9.5, fill: "var(--text-3)", anchor: "middle", mono: false, weight: 400 });
    }
  }
  const stageIndex = /** @param {string} v @returns {number} */ (v) => {
    const k = Number.parseInt(v, 10);
    return Number.isInteger(k) && k >= 1 && k <= nStages ? k - 1 : -1;
  };
  for (const s of spec.filter((x) => x.key === "top")) {
    const [at, text] = pair(s.value);
    const i = stageIndex(at);
    if (i < 0) { problems.push(`loop: top caption on stage ${at}, which does not exist`); continue; }
    labels.push({ key: `top${i}`, x: stageBox(i).x + w / 2, y: y0 - 22, text, size: 10.5, fill: "var(--text-3)", anchor: "middle", mono: true, weight: 400 });
  }
  let low = y0 + h;
  for (const s of spec.filter((x) => x.key === "reject")) {
    const [at, text] = pair(s.value);
    const i = stageIndex(at);
    if (i < 0) { problems.push(`loop: reject under stage ${at}, which does not exist`); continue; }
    const cx = stageBox(i).x + w / 2;
    arrows.push({ key: `rj${i}`, d: `M${cx},${y0 + h} L${cx},${y0 + h + 34}`, stroke: "var(--red)", dash: "", head: "warn" });
    ends.push({ x: cx, y: y0 + h, arrow: `rj${i}` });
    labels.push({ key: `rjt${i}`, x: cx, y: y0 + h + 50, text, size: 10, fill: "var(--red)", anchor: "middle", mono: false, weight: 400 });
    low = Math.max(low, y0 + h + 56);
  }
  const last = nStages > 0 ? stageBox(nStages - 1) : null;
  const forkY = y0 + h + 76;
  const splitY = y0 + h + 42;
  const fw = 180, fh = 56;
  /** @type {Box[]} */
  const forkBoxes = [];
  if (last && forks.length > 0) {
    const xs = forks.length === 2 ? [VIEW_W - M - 2 * fw - 45, VIEW_W - M - fw] : [last.x + last.w / 2 - fw / 2];
    for (const [i, s] of forks.slice(0, 2).entries()) {
      const [title, sub] = pair(s.value);
      const fx = Math.max(M, Math.min(VIEW_W - M - fw, Number(xs[i] ?? M)));
      const fb = box(`f${i}`, fx, forkY, fw, fh, s.mark === "!" ? "warn" : "plain", title, sub, false, problems);
      boxes.push(fb);
      forkBoxes.push(fb);
      const lx = last.x + last.w / 2, cx = fx + fw / 2;
      const warn = s.mark === "!";
      arrows.push({ key: `fk${i}`, d: `M${lx},${y0 + h} L${lx},${splitY} L${cx},${splitY} L${cx},${forkY - 4}`, stroke: warn ? "var(--red)" : "var(--text-2)", dash: "", head: warn ? "warn" : "ink" });
      ends.push({ x: lx, y: y0 + h, arrow: `fk${i}` }, { x: cx, y: forkY, arrow: `fk${i}` });
    }
    low = forkY + fh;
  }
  if (backLine && last) {
    const [route, label] = pair(backLine.value);
    const m = /^(fork|last)\s*->\s*(\d+)$/.exec(route);
    const target = m ? stageIndex(str(m[2])) : -1;
    if (!m || target < 0) problems.push(`loop: back "${route}" -- write "fork -> <stage>" or "last -> <stage>"`);
    else {
      const t = stageBox(target);
      const tx = t.x + t.w / 2;
      const up = y0 + h + 50;
      if (str(m[1]) === "fork") {
        const f = forkBoxes[0];
        if (!f) problems.push(`loop: back from a fork, but the loop has no fork`);
        else {
          const fy = f.y + f.h / 2, lx = f.x - 50;
          if (lx < M) problems.push(`loop: the back arrow from the fork has no room to the left of it`);
          arrows.push({ key: "back", d: `M${f.x},${fy} L${lx},${fy} L${lx},${up} L${tx},${up} L${tx},${y0 + h + 4}`, stroke: "var(--text-2)", dash: "4 3", head: "ink" });
          ends.push({ x: f.x, y: fy, arrow: "back" }, { x: tx, y: y0 + h, arrow: "back" });
          if (label !== "") labels.push({ key: "backl", x: lx + 8, y: up - 6, text: label, size: 9.5, fill: "var(--text-3)", anchor: "start", mono: false, weight: 400 });
        }
      } else {
        if (target >= nStages - 1) problems.push(`loop: back from the last stage must go to an earlier one`);
        const lx = last.x + last.w / 2;
        arrows.push({ key: "back", d: `M${lx},${y0 + h} L${lx},${up} L${tx},${up} L${tx},${y0 + h + 4}`, stroke: "var(--text-2)", dash: "4 3", head: "ink" });
        ends.push({ x: lx, y: y0 + h, arrow: "back" }, { x: tx, y: y0 + h, arrow: "back" });
        if (label !== "") labels.push({ key: "backl", x: (lx + tx) / 2, y: up + 16, text: label, size: 9.5, fill: "var(--text-3)", anchor: "middle", mono: false, weight: 400 });
        low = Math.max(low, up + 22);
      }
    }
  }
  let hgt = low + 24;
  if (note !== "") {
    if (!fits(note, 11.5, INNER)) problems.push(`loop: the note is longer than the figure is wide`);
    labels.push({ key: "note", x: VIEW_W / 2, y: hgt + 4, text: note, size: 11.5, fill: "var(--text-3)", anchor: "middle", mono: false, weight: 400 });
    hgt += 24;
  }
  return { kind: "loop", w: VIEW_W, h: hgt, boxes, arrows, labels, divider: null, caption, ends, problems };
}

/**
 * The picture's honesty, asserted on geometry alone: no two boxes overlap, every arrow end sits on a box edge, the
 * divider stands in the gap it names and inside the figure, and everything drawn is inside the view box.
 * @param {Geometry} g @returns {string[]}
 */
export function check(g) {
  const out = [];
  const bs = g.boxes;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = /** @type {Box} */ (bs[i]), b = /** @type {Box} */ (bs[j]);
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`boxes ${a.key} and ${b.key} overlap`);
  }
  const onEdge = /** @param {number} x @param {number} y */ (x, y) => bs.some((b) =>
    (Math.abs(x - b.x) <= 6 || Math.abs(x - (b.x + b.w)) <= 6) && y >= b.y - 6 && y <= b.y + b.h + 6
    || (Math.abs(y - b.y) <= 6 || Math.abs(y - (b.y + b.h)) <= 6) && x >= b.x - 6 && x <= b.x + b.w + 6);
  for (const e of g.ends) if (!onEdge(e.x, e.y)) out.push(`arrow ${e.arrow} ends at ${Math.round(e.x)},${Math.round(e.y)}, on no box`);
  if (g.divider) {
    const d = g.divider;
    const hit = bs.filter((b) => b.y < d.y2 && d.y1 < b.y + b.h).find((b) => d.x > b.x && d.x < b.x + b.w);
    if (hit) out.push(`the divider at x=${Math.round(d.x)} cuts through box ${hit.key}`);
    if (d.y1 < 0 || d.y2 > g.h) out.push(`the divider runs outside the figure`);
  }
  for (const b of bs) if (b.x < 0 || b.y < 0 || b.x + b.w > g.w || b.y + b.h > g.h) out.push(`box ${b.key} is outside the figure`);
  return out;
}
