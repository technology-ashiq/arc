#!/usr/bin/env node
// tokens-contrast.mjs -- every text-on-surface contrast ratio of the HQ's two moods, COMPUTED
// from docs/design/system/tokens.css and written into that file's header by this script, never
// typed (face v2 Phase 01, REQ-02, ADR-1322, ADR-1331).
//
// What it measures, declared, because a gate that decides which pairs count decides what it can
// catch (CLAUDE.md, "a gate that transforms what it measures must declare what the transform
// destroys"):
//   - the moods are `html.hq` (dark) and `html.hq.hq-light` (paper), each resolved over the
//     `:root` block exactly as the cascade does: light = :root < html.hq < html.hq.hq-light;
//   - TEXT: every ink and hue token as text on EVERY surface token (bg-0..bg-4, well, input-bg),
//     floor 4.5:1 -- not only the surfaces a component happens to use today;
//   - CHIP: each hue as text on its own 10% tint over bg-2 (the kit's Chip), floor 4.5:1, the
//     tint built from the hue's `-rgb` triple -- so a triple that disagrees with its hex is a
//     finding of its own, checked independently of the hex;
//   - FILL: text on a solid fill (on-fill on accent and green, bg-0 on the primary button's
//     text-1), floor 4.5:1;
//   - UI (3:1, WCAG 1.4.11): each hue as a meter fill against the track over bg-2, and the
//     accent focus ring against every surface;
//   - LAW: council resolves to --accent-dim and never to violet (ADR-1322), simulated resolves
//     to violet, live resolves to the accent and never to green (tokens.css collision 3).
// What it does NOT measure: the `:root` landing block (it keeps its own v0.4-intake notes and is
// not a mood), anything inside an @media block (only durations live there), hairlines and
// borders that carry no information, and any colour a component writes that is not a token --
// the colour-literal lint owns that.
//
// Usage:
//   tokens-contrast.mjs [--file PATH]            check: exit 0 pass · 1 findings · 2 setup error
//   tokens-contrast.mjs [--file PATH] --write    recompute the header block and write it; still
//                                                exits 1 when a pair is under its floor
//   tokens-contrast.mjs --selftest               the negative controls, on in-memory mutants
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
export const DEFAULT_FILE = join(REPO, "docs", "design", "system", "tokens.css");

export const TEXT_FLOOR = 4.5;
export const UI_FLOOR = 3;
export const ROOT = ":root";
export const DARK = "html.hq";
export const LIGHT = "html.hq.hq-light";
export const MOODS = [
  { name: "dark", selector: DARK, chain: [ROOT, DARK] },
  { name: "light", selector: LIGHT, chain: [ROOT, DARK, LIGHT] },
];
export const SURFACES = ["bg-0", "bg-1", "bg-2", "bg-3", "bg-4", "well", "input-bg"];
export const TEXT = ["text-1", "text-2", "text-3", "accent", "accent-dim", "green", "amber", "red", "violet", "blue"];
export const HUES = ["accent", "green", "amber", "red", "violet", "blue"];
export const BEGIN = "BEGIN computed-contrast";
export const END = "END computed-contrast";

export class SetupError extends Error {}

/**
 * The CSS with every comment replaced by spaces of the same length, so offsets survive. String
 * aware: a quoted value holding the two comment characters is not a comment. An unterminated
 * comment or string is a named error -- a scanner that stops scanning says so.
 */
export function stripComments(css) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end === -1) throw new SetupError(`unterminated comment starting at offset ${i}`);
      out += css.slice(i, end + 2).replace(/[^\n]/g, " ");
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === "\\") j++;
        else if (css[j] === "\n") throw new SetupError(`unterminated string starting at offset ${i}`);
        j++;
      }
      if (j >= css.length) throw new SetupError(`unterminated string starting at offset ${i}`);
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const normSelector = (s) => s.trim().replace(/\s+/g, " ");

/**
 * Top-level rules only: `selector { body }` at brace depth 0. A rule nested in @media or any other
 * block is not a top-level declaration of a mood and is not read. Unbalanced braces are an error.
 * @returns {{ selector: string, body: string }[]}
 */
export function topLevelRules(cssNoComments) {
  const rules = [];
  let depth = 0;
  let start = 0;
  let open = -1;
  let quote = null;
  for (let i = 0; i < cssNoComments.length; i++) {
    const c = cssNoComments[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth < 0) throw new SetupError(`unbalanced "}" at offset ${i}`);
      if (depth === 0) {
        rules.push({ selector: normSelector(cssNoComments.slice(start, open)), body: cssNoComments.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      // A top-level statement such as @import or @charset: not a rule, skipped by position.
      start = i + 1;
    }
  }
  if (depth !== 0) throw new SetupError(`unbalanced "{": ${depth} block(s) never closed`);
  return rules;
}

/** `--name: value` declarations of one rule body, in order. A nested block inside is refused. */
export function declarations(body, selector) {
  const out = [];
  let depth = 0;
  let cur = "";
  let quote = null;
  const flush = () => {
    const d = cur.trim();
    cur = "";
    if (d === "") return;
    const colon = d.indexOf(":");
    if (colon === -1) throw new SetupError(`${selector}: a declaration with no colon: ${JSON.stringify(d.slice(0, 60))}`);
    const name = d.slice(0, colon).trim();
    const value = d.slice(colon + 1).trim();
    if (name.startsWith("--")) {
      if (!/^--[a-zA-Z0-9-]+$/.test(name)) throw new SetupError(`${selector}: malformed custom property name ${JSON.stringify(name)}`);
      out.push({ name: name.slice(2), value });
    }
  };
  for (const c of body) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth < 0) throw new SetupError(`${selector}: unbalanced parentheses in a declaration`);
    if (c === "{" || c === "}") throw new SetupError(`${selector}: a nested block inside a mood rule is not read by this gate`);
    if (c === ";" && depth === 0) { flush(); continue; }
    cur += c;
  }
  if (depth !== 0 || quote) throw new SetupError(`${selector}: unbalanced parentheses or quotes in a declaration`);
  flush();
  return out;
}

/** Each wanted selector's merged custom properties (later declarations win, as in the cascade). */
export function scopes(css) {
  const rules = topLevelRules(stripComments(css));
  const found = new Map();
  for (const r of rules) {
    for (const sel of r.selector.split(",").map(normSelector)) {
      if (sel !== ROOT && sel !== DARK && sel !== LIGHT) continue;
      if (r.selector.includes(",")) throw new SetupError(`selector list ${JSON.stringify(r.selector)} mixes a mood with other selectors; a mood block stands alone`);
      const map = found.get(sel) ?? new Map();
      for (const d of declarations(r.body, sel)) map.set(d.name, d.value);
      found.set(sel, map);
    }
  }
  return found;
}

/** Resolve `var(--x[, fallback])` textually against a scope chain, with cycle detection. */
export function resolveValue(name, chainMaps, seen = []) {
  if (seen.includes(name)) throw new SetupError(`var() cycle: ${[...seen, name].map((n) => `--${n}`).join(" -> ")}`);
  let raw;
  for (let i = chainMaps.length - 1; i >= 0; i--) {
    if (chainMaps[i].has(name)) { raw = chainMaps[i].get(name); break; }
  }
  if (raw === undefined) return undefined;
  return substituteVars(raw, chainMaps, [...seen, name]);
}

function substituteVars(text, chainMaps, seen) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("var(", i);
    if (at === -1) { out += text.slice(i); break; }
    if (at > 0 && /[a-zA-Z0-9_-]/.test(text[at - 1])) { out += text.slice(i, at + 4); i = at + 4; continue; }
    out += text.slice(i, at);
    let depth = 1;
    let j = at + 4;
    while (j < text.length && depth > 0) { if (text[j] === "(") depth++; else if (text[j] === ")") depth--; j++; }
    if (depth !== 0) throw new SetupError(`unclosed var( in ${JSON.stringify(text)}`);
    const inner = text.slice(at + 4, j - 1);
    const comma = inner.indexOf(",");
    const ref = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    if (!/^--[a-zA-Z0-9-]+$/.test(ref)) throw new SetupError(`var() names ${JSON.stringify(ref)}, not a custom property`);
    const got = resolveValue(ref.slice(2), chainMaps, seen);
    if (got !== undefined) out += got;
    else if (comma !== -1) out += substituteVars(inner.slice(comma + 1).trim(), chainMaps, seen);
    else throw new SetupError(`var(${ref}) is not defined in this mood and has no fallback`);
    i = j;
  }
  return out;
}

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const RGB_FN = new RegExp(String.raw`^rgba?\(\s*(${NUM})\s*[, ]\s*(${NUM})\s*[, ]\s*(${NUM})\s*(?:[,/]\s*(${NUM})(%?)\s*)?\)$`, "i");

/**
 * A colour value as [r, g, b, a] with channels 0-255 and a in 0-1. Only the forms a token file
 * needs: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() with numbers, `transparent`. Anything else
 * is a named error -- an unreadable colour is never a pass.
 */
export function parseColor(value) {
  const v = String(value).trim();
  if (/^transparent$/i.test(v)) return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = [0, 2, 4, 6].map((k) => (k < h.length ? parseInt(h.slice(k, k + 2), 16) : 255));
    return [n[0], n[1], n[2], n[3] / 255];
  }
  m = RGB_FN.exec(v);
  if (m) {
    const ch = [m[1], m[2], m[3]].map(Number);
    let a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] === "%" ? 100 : 1);
    if (ch.some((c) => !Number.isFinite(c) || c < 0 || c > 255) || !Number.isFinite(a) || a < 0 || a > 1) {
      throw new SetupError(`colour out of range: ${JSON.stringify(v)}`);
    }
    return [...ch, a];
  }
  throw new SetupError(`not a colour this gate can read: ${JSON.stringify(v)}`);
}

/** `fg` composited over an OPAQUE `bg`. */
export function over(fg, bg) {
  if (bg[3] !== 1) throw new SetupError("compositing onto a translucent backdrop has no single answer");
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
}

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
/** WCAG 2.x contrast ratio of two OPAQUE colours. */
export function contrast(a, b) {
  if (a[3] !== 1 || b[3] !== 1) throw new SetupError("contrast is defined between opaque colours; composite first");
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Two decimals, truncated: a cell never displays a floor it does not clear. */
export const show = (r) => (Math.floor(r * 100) / 100).toFixed(2);

const sameRgb = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * Everything computed for one mood, from the token file's text alone.
 * @returns {{ mood, text: object, chip: object, fill: object[], ui: object[], law: object[], findings: string[] }}
 */
export function computeMood(scopeMap, mood) {
  const findings = [];
  const chainMaps = mood.chain.map((s) => scopeMap.get(s) ?? new Map());
  const get = (name) => {
    const v = resolveValue(name, chainMaps);
    if (v === undefined) { findings.push(`${mood.name}: missing token --${name}`); return null; }
    try { return { raw: v, color: parseColor(v) }; }
    catch (e) { findings.push(`${mood.name}: --${name} ${e.message}`); return null; }
  };

  const base = get("bg-0");
  if (base && base.color[3] !== 1) findings.push(`${mood.name}: --bg-0 must be opaque, it is the ground every other surface sits on`);
  const ground = base && base.color[3] === 1 ? base.color : null;
  const surface = (name) => {
    const s = get(name);
    if (!s || !ground) return null;
    return s.color[3] === 1 ? s.color : over(s.color, ground);
  };
  const surfaces = SURFACES.map((n) => ({ name: n, color: surface(n) }));

  const text = {};
  for (const t of TEXT) {
    const fg = get(t);
    text[t] = surfaces.map((s) => {
      if (!fg || !s.color) return null;
      const r = contrast(over(fg.color, s.color), s.color);
      if (r < TEXT_FLOOR) findings.push(`${mood.name}: --${t} on --${s.name} is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
      return r;
    });
  }

  const chip = {};
  const bg2 = surfaces.find((s) => s.name === "bg-2").color;
  for (const h of HUES) {
    const fg = get(h);
    const tripleRaw = resolveValue(`${h}-rgb`, chainMaps);
    if (tripleRaw === undefined) { findings.push(`${mood.name}: missing token --${h}-rgb`); chip[h] = null; continue; }
    let tint;
    try { tint = parseColor(`rgba(${tripleRaw}, 0.1)`); }
    catch (e) { findings.push(`${mood.name}: --${h}-rgb ${e.message}`); chip[h] = null; continue; }
    if (fg && !sameRgb(fg.color, tint)) findings.push(`${mood.name}: --${h}-rgb (${tripleRaw}) disagrees with --${h} (${fg.raw})`);
    if (!fg || !bg2) { chip[h] = null; continue; }
    const ground2 = over(tint, bg2);
    const r = contrast(over(fg.color, ground2), ground2);
    if (r < TEXT_FLOOR) findings.push(`${mood.name}: --${h} on its own chip tint is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
    chip[h] = r;
  }

  const fill = [];
  const pairFill = (fgName, bgName, label) => {
    const fg = get(fgName);
    const bg = get(bgName);
    if (!fg || !bg || !ground) return;
    const bgc = bg.color[3] === 1 ? bg.color : over(bg.color, ground);
    const r = contrast(over(fg.color, bgc), bgc);
    if (r < TEXT_FLOOR) findings.push(`${mood.name}: ${label} is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
    fill.push({ label, ratio: r });
  };
  pairFill("on-fill", "accent", "on-fill on accent");
  pairFill("on-fill", "green", "on-fill on green");
  pairFill("bg-0", "text-1", "bg-0 on text-1 (primary button)");

  const ui = [];
  const track = get("track");
  if (track && bg2) {
    const trackGround = over(track.color, bg2);
    for (const h of HUES) {
      const fg = get(h);
      if (!fg) continue;
      const r = contrast(over(fg.color, trackGround), trackGround);
      if (r < UI_FLOOR) findings.push(`${mood.name}: --${h} meter fill on --track is ${show(r)}:1, under ${UI_FLOOR}:1`);
      ui.push({ label: `${h} meter`, ratio: r });
    }
  }
  const ring = get("accent");
  if (ring) {
    const worst = surfaces.filter((s) => s.color).map((s) => ({ s, r: contrast(over(ring.color, s.color), s.color) }))
      .reduce((a, b) => (a === null || b.r < a.r ? b : a), null);
    if (worst) {
      if (worst.r < UI_FLOOR) findings.push(`${mood.name}: the accent focus ring on --${worst.s.name} is ${show(worst.r)}:1, under ${UI_FLOOR}:1`);
      ui.push({ label: `focus ring (worst: ${worst.s.name})`, ratio: worst.r });
    }
  }

  // The reserved meanings, as resolved values rather than as the spelling of a var().
  const law = [];
  const equal = (a, b) => { const x = get(a); const y = get(b); return x && y ? sameRgb(x.color, y.color) && x.color[3] === y.color[3] : null; };
  const lawCheck = (label, ok) => {
    if (ok === null) return;
    law.push({ label, ok });
    if (!ok) findings.push(`${mood.name}: LAW ${label}`);
  };
  lawCheck("council renders --accent-dim (ADR-1322)", equal("kind-council", "accent-dim"));
  const councilViolet = equal("kind-council", "violet");
  lawCheck("council never renders violet (ADR-1322)", councilViolet === null ? null : !councilViolet);
  lawCheck("simulated renders violet (the non-real family)", equal("sim-fg", "violet"));
  lawCheck("live renders the accent (collision 3)", equal("mode-live", "accent"));
  const liveGreen = equal("mode-live", "green");
  lawCheck("live never renders green (collision 3)", liveGreen === null ? null : !liveGreen);

  return { mood: mood.name, text, chip, fill, ui, law, findings: [...new Set(findings)] };
}

/** The whole analysis: which moods exist, and every finding across them. */
export function analyse(css) {
  const scopeMap = scopes(css);
  const findings = [];
  for (const sel of [ROOT, DARK, LIGHT]) if (!scopeMap.has(sel)) findings.push(`missing selector ${sel}`);
  const moods = MOODS.map((m) => computeMood(scopeMap, m));
  for (const m of moods) findings.push(...m.findings);
  return { moods, findings };
}

/** The header block, as this script renders it. The only legitimate spelling of these numbers. */
export function renderBlock(analysis) {
  const W = 9;
  const cell = (r) => (r === null || r === undefined ? "--".padStart(W - 1) + " " : `${show(r).padStart(W - 1)}${r < TEXT_FLOOR ? "!" : " "}`);
  const lines = [BEGIN];
  lines.push(`   generated by tests/face/tokens-contrast.mjs --write; its check mode FAILS when this`);
  lines.push(`   block differs from a recompute. "!" marks a pair under its floor.`);
  for (const m of analysis.moods) {
    const sel = MOODS.find((x) => x.name === m.mood).selector;
    lines.push("");
    lines.push(`   ${m.mood} (${sel}) -- text on surface, floor ${TEXT_FLOOR}:1`);
    lines.push(`   ${"token".padEnd(11)}${[...SURFACES, "chip"].map((s) => `${s.padStart(W - 1)} `).join("")}`);
    for (const t of TEXT) {
      const chip = HUES.includes(t) ? cell(m.chip[t]) : "";
      lines.push(`   ${t.padEnd(11)}${(m.text[t] ?? []).map(cell).join("")}${chip}`);
    }
    for (const f of m.fill) lines.push(`   fill  ${f.label.padEnd(34)}${cell(f.ratio)}`);
    for (const u of m.ui) lines.push(`   ui    ${u.label.padEnd(34)}${show(u.ratio).padStart(W - 1)}${u.ratio < UI_FLOOR ? "!" : " "} (floor ${UI_FLOOR}:1)`);
    for (const l of m.law) lines.push(`   law   ${l.label} -- ${l.ok ? "holds" : "BROKEN"}`);
  }
  lines.push(`   ${END}`);
  // No trailing whitespace: the block lives in a tracked file that whitespace checks read.
  return lines.map((l) => l.replace(/\s+$/, "")).join("\n");
}

/** The block currently in the file, or null when either marker is absent. */
export function currentBlock(css) {
  const b = css.indexOf(BEGIN);
  const e = css.indexOf(END);
  if (b === -1 || e === -1 || e < b) return null;
  if (css.indexOf(BEGIN, b + 1) !== -1 || css.indexOf(END, e + 1) !== -1) throw new SetupError("the computed-contrast markers appear more than once");
  return css.slice(b, e + END.length);
}

/** Findings for a check: the analysis, plus a header that is missing, typed or stale. */
export function checkText(css) {
  const analysis = analyse(css);
  const findings = [...analysis.findings];
  const have = currentBlock(css);
  if (have === null) findings.push(`the header has no computed-contrast block (markers "${BEGIN}" / "${END}")`);
  else if (have !== renderBlock(analysis)) findings.push("the header's contrast block differs from a recompute -- it is stale or typed; run tokens-contrast.mjs --write");
  return { analysis, findings };
}

/** The file text with its block replaced by a fresh render. The markers must already exist. */
export function writeText(css) {
  const analysis = analyse(css);
  const have = currentBlock(css);
  if (have === null) throw new SetupError(`cannot write: the file has no "${BEGIN}" ... "${END}" markers to write between`);
  return { text: css.replace(have, () => renderBlock(analysis)), analysis };
}

function selftest(file) {
  const css = readFileSync(file, "utf8");
  const { text: fresh } = writeText(css);
  let ok = true;
  const arm = (label, cond) => { if (!cond) ok = false; console.log(`${label.padEnd(60)} ${cond ? "PASS" : "FAIL"}`); };
  const has = (t, re) => checkText(t).findings.some((f) => re.test(f));
  const mutate = (from, to) => { if (!fresh.includes(from)) throw new SetupError(`selftest mutant anchor not found: ${from}`); return fresh.replace(from, to); };
  const lightBlock = /html\.hq\.hq-light\s*\{/;

  arm("the freshly written file checks clean", checkText(fresh).findings.length === 0);
  arm("a hand-typed number in the block FAILS", has(fresh.replace(/(text-1\s+)(\d)/, (m, a, d) => a + (d === "9" ? "8" : "9")), /stale or typed/));
  arm("a missing block FAILS", has(fresh.replace(BEGIN, "BEGIN something-else"), /no computed-contrast block/));
  arm("a missing light mood FAILS by name", has(fresh.replace(lightBlock, "html.hq.hq-dim {"), /missing selector html\.hq\.hq-light/));
  // --text-3 dropped to the surface colour in the light mood: the lowest possible contrast.
  arm("a light --text-3 under 4.5:1 FAILS", has(mutate("--text-3: #636b77", "--text-3: #c9cdd3"), /light: --text-3 on --bg-\d is \d\.\d\d:1, under 4\.5:1/));
  arm("a -rgb triple that disagrees with its hex FAILS", has(fresh.replace(/(html\.hq\s*\{[\s\S]*?--blue-rgb:\s*)[^;]+/, "$18, 9, 7"), /dark: --blue-rgb .* disagrees with --blue/));
  arm("council repointed at violet FAILS the law", has(fresh.replace(/(html\.hq\s*\{[\s\S]*?)(--kind-council:\s*)[^;]+/, "$1$2var(--violet)"), /LAW council renders --accent-dim/));
  arm("live repointed at green FAILS the law", has(fresh.replace(/(html\.hq\s*\{[\s\S]*?)(--mode-live:\s*)[^;]+/, "$1$2var(--green)"), /LAW live never renders green/));
  arm("a missing --blue FAILS by name", has(fresh.replace(/--blue:/g, "--bleu:"), /missing token --blue\b/));
  // One closing brace removed from the dark block: the rest of the file would be read as part of
  // it. That is refused whole, never half-read.
  let refused = false;
  try { analyse(fresh.replace(/(html\.hq\s*\{[^}]*)\}/, "$1")); } catch (e) { refused = e instanceof SetupError; }
  arm("an unbalanced file is refused, not half-read", refused);
  console.log(`tokens-contrast selftest: ${ok ? "PASS" : "FAIL"}`);
  return ok ? 0 : 1;
}

export function parseArgs(argv) {
  const opts = { file: DEFAULT_FILE, write: false, selftest: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (seen.has(a)) throw new SetupError(`${a} given twice`);
    seen.add(a);
    if (a === "--write") opts.write = true;
    else if (a === "--selftest") opts.selftest = true;
    else if (a === "--file") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--") || v.trim() === "") throw new SetupError("--file needs a path");
      opts.file = resolve(v);
      i++;
    } else throw new SetupError(`unknown argument ${JSON.stringify(a)} (flags: --file PATH, --write, --selftest)`);
  }
  if (opts.selftest && opts.write) throw new SetupError("--selftest never writes; it runs alone");
  return opts;
}

function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`tokens-contrast: ${e.message}`); return 2; }
  try {
    if (opts.selftest) return selftest(opts.file);
    const css = readFileSync(opts.file, "utf8");
    if (opts.write) {
      const { text, analysis } = writeText(css);
      if (text !== css) writeFileSync(opts.file, text);
      console.log(`tokens-contrast: wrote the computed-contrast block (${analysis.findings.length} finding(s))`);
      for (const f of analysis.findings) console.log(`FAIL ${f}`);
      return analysis.findings.length ? 1 : 0;
    }
    const { analysis, findings } = checkText(css);
    const pairs = analysis.moods.reduce((n, m) => n + Object.values(m.text).flat().filter((r) => r !== null).length
      + Object.values(m.chip).filter((r) => r !== null && r !== undefined).length + m.fill.length + m.ui.length, 0);
    for (const f of findings) console.log(`FAIL ${f}`);
    console.log(`tokens-contrast: moods=${analysis.moods.length} pairs=${pairs} findings=${findings.length}`);
    return findings.length ? 1 : 0;
  } catch (e) {
    console.error(`tokens-contrast: ${e instanceof SetupError ? "" : "unexpected: "}${e.message}`);
    return 2;
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) process.exitCode = main(process.argv.slice(2));
