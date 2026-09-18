#!/usr/bin/env node
// tokens-contrast.mjs -- every text-on-surface contrast ratio of the HQ's two moods, COMPUTED
// from docs/design/system/tokens.css and written into that file's header by this script, never
// typed (face v2 Phase 01, REQ-02, ADR-1322, ADR-1331).
//
// What it measures, declared, because a gate that decides which pairs count decides what it can
// catch (CLAUDE.md, "a gate that transforms what it measures must declare what the transform
// destroys"):
//   - the moods are `html.hq` (dark) and `html.hq.hq-light` (paper), each resolved over `:root`
//     exactly as the cascade does: light = :root < html.hq < html.hq.hq-light;
//   - EVERY colour token the moods resolve has a ROLE (ROLES below). A colour token with no role
//     is a finding: a token this gate cannot place is a token it cannot measure;
//   - SURFACE tokens must be opaque. TEXT tokens are measured on every surface, floor 4.5:1;
//   - CHIP: each hue as text on its own 10% tint over each page surface (bg-0..bg-3), the tint
//     built from the hue's `-rgb` triple, so a triple that disagrees with its hex is a finding;
//   - FILL: text on a solid fill (every on-X over its X, and the primary button), floor 4.5:1;
//   - UI (3:1, WCAG 1.4.11): each hue as a meter fill on the track over bg-2, and --focus-ring on
//     every surface;
//   - LAW, by reference AND by hue: council is var(--accent-dim) and sits in the accent's hue,
//     far from violet (ADR-1322); simulated is var(--violet); live is var(--accent), far from
//     green (tokens.css collision 3); money is var(--green); needs-you is var(--amber).
// And what the FILE may contain: a custom property may be declared only in the three mood blocks
// (plus `--dur-*` under prefers-reduced-motion), never with !important -- a declaration anywhere
// else is one the browser applies and this gate cannot read, so it is refused by name.
// What it does NOT measure: the `:root` landing's own notes (typed at the v0.4 intake; the
// landing is not a mood), decorative tokens (hairlines, washes, scrims: they carry no text), and
// any colour a component writes that is not a token -- the colour-literal lint owns that.
//
// Usage:
//   tokens-contrast.mjs [--file PATH]            check: exit 0 pass · 1 findings · 2 setup error
//   tokens-contrast.mjs [--file PATH] --write    recompute the header block and write it; still
//                                                exits 1 when a pair is under its floor
//   tokens-contrast.mjs [--file PATH] --selftest the negative controls, on in-memory mutants
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
export const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

// The table's columns and rows are the base names; every other name of the same role is
// measured identically and listed by the value it shares, or gets a row of its own.
export const SURFACES = ["bg-0", "bg-1", "bg-2", "bg-3", "bg-4", "well", "input-bg"];
export const CHIP_SURFACES = ["bg-0", "bg-1", "bg-2", "bg-3"];
export const TEXT = ["text-1", "text-2", "text-3", "accent", "accent-dim", "green", "amber", "red", "violet", "blue"];
export const HUES = ["accent", "green", "amber", "red", "violet", "blue"];
export const ROLES = {
  surface: [...SURFACES, "panel", "ground"],
  text: [...TEXT, "prose", "meta", "faint", "sim-fg", "mode-live", "mode-replay", "mode-sim",
    "kind-factory", "kind-money", "kind-decision", "kind-council", "kind-system"],
  fillText: ["on-fill", "on-accent", "on-green", "on-amber", "on-red", "on-violet"],
  ui: ["focus-ring"],
  decor: ["line-1", "line-2", "track", "scrim", "accent-line", "accent-wash", "sim-line", "panel-border",
    "hairline", "hairline-strong", "mode-bg"],
};
export const FILLS = [
  ["on-fill", "accent"], ["on-fill", "green"], ["on-accent", "accent"], ["on-green", "green"],
  ["on-amber", "amber"], ["on-red", "red"], ["on-violet", "violet"], ["bg-0", "text-1"],
];
// Hue bands for the laws, in degrees on the HSL wheel.
// Measured on v0.7's palette: the accent (teal) and green sit 44 degrees apart in the dark mood
// and 38 in the light, so the distinct band is 30; violet sits 80+ degrees from all of them.
export const SAME_HUE = 15;
export const DISTINCT_HUE = 30;
export const BEGIN = "BEGIN computed-contrast";
export const END = "END computed-contrast";

export class SetupError extends Error {}

const NAMED_COLOURS = new Set(("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue "
  + "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue "
  + "darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid "
  + "darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink "
  + "deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold "
  + "goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush "
  + "lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey "
  + "lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime "
  + "limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen "
  + "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin "
  + "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise "
  + "palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue "
  + "saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow "
  + "springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen "
  + "transparent currentcolor canvas canvastext").split(" "));

/** Whether a resolved value is shaped like a colour at all (the whole value, not a part of it). */
export function colourShaped(value) {
  const v = String(value).trim().toLowerCase();
  return /^#[0-9a-z]+$/.test(v) || /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(v) || NAMED_COLOURS.has(v);
}

/**
 * The CSS with every comment replaced by spaces of the same length, so offsets survive. Aware of
 * strings AND of unquoted url(), inside which the two comment characters are just characters. An
 * unterminated comment, string or url() is a named error: a scanner that stops says so.
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
    if ((c === "u" || c === "U") && /^url\(/i.test(css.slice(i, i + 4)) && !/[a-zA-Z0-9_-]/.test(css[i - 1] ?? "")) {
      let j = i + 4;
      while (j < css.length && /\s/.test(css[j])) j++;
      if (css[j] !== '"' && css[j] !== "'") {
        const close = css.indexOf(")", j);
        if (close === -1) throw new SetupError(`unterminated url( starting at offset ${i}`);
        out += css.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

const normSelector = (s) => s.trim().replace(/\s+/g, " ");

/**
 * Every rule at every depth: `{ path, body }`, where path is the list of preludes from the top
 * (`["@media (x)", ":root"]`) and body is the rule's own text with nested blocks cut out.
 * Unbalanced braces are an error.
 */
export function allRules(cssNoComments) {
  const rules = [];
  const walk = (text, path) => {
    let depth = 0;
    let start = 0;
    let open = -1;
    let quote = null;
    let own = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "{") {
        if (depth === 0) {
          open = i;
          // What precedes the prelude in this segment is this rule's own declarations.
          const seg = text.slice(start, i);
          own += seg.slice(0, seg.lastIndexOf(";") + 1);
        }
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth < 0) throw new SetupError(`unbalanced "}" in ${path.join(" > ") || "the file"}`);
        if (depth === 0) {
          const seg = text.slice(start, open);
          const prelude = normSelector(seg.slice(seg.lastIndexOf(";") + 1));
          walk(text.slice(open + 1, i), [...path, prelude]);
          start = i + 1;
        }
      }
    }
    if (depth !== 0) throw new SetupError(`unbalanced "{": ${depth} block(s) never closed in ${path.join(" > ") || "the file"}`);
    own += text.slice(start);
    if (path.length) rules.push({ path, body: own });
  };
  walk(cssNoComments, []);
  return rules;
}

/** `--name: value` declarations of one rule's own body, in order. */
export function declarations(body, where) {
  const out = [];
  let depth = 0;
  let cur = "";
  let quote = null;
  const flush = () => {
    const d = cur.trim();
    cur = "";
    if (d === "") return;
    const colon = d.indexOf(":");
    if (colon === -1) return; // a stray fragment of a selector list or an at-statement, not a declaration
    const name = d.slice(0, colon).trim();
    const value = d.slice(colon + 1).trim();
    if (name.startsWith("--")) {
      if (!/^--[a-zA-Z0-9-]+$/.test(name)) throw new SetupError(`${where}: malformed custom property name ${JSON.stringify(name)}`);
      out.push({ name: name.slice(2), value });
    }
  };
  for (const c of body) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth < 0) throw new SetupError(`${where}: unbalanced parentheses in a declaration`);
    if (c === ";" && depth === 0) { flush(); continue; }
    cur += c;
  }
  if (depth !== 0 || quote) throw new SetupError(`${where}: unbalanced parentheses or quotes in a declaration`);
  flush();
  return out;
}

/**
 * The three moods' merged custom properties, plus every declaration the gate refuses: a custom
 * property outside the three exact top-level mood blocks, or with !important.
 * @returns {{ scopes: Map<string, Map<string, string>>, refused: string[] }}
 */
export function scopes(css) {
  const found = new Map();
  const refused = [];
  for (const r of allRules(stripComments(css))) {
    const where = r.path.join(" > ");
    const decls = declarations(r.body, where);
    const top = r.path.length === 1 ? r.path[0] : null;
    const mood = top === ROOT || top === DARK || top === LIGHT;
    for (const d of decls) {
      if (/!\s*important\s*$/i.test(d.value)) {
        refused.push(`--${d.name} is declared !important in "${where}"; !important reorders the cascade this gate models`);
        continue;
      }
      if (mood) {
        const map = found.get(top) ?? new Map();
        map.set(d.name, d.value);
        found.set(top, map);
      } else if (r.path.length === 2 && r.path[0] === REDUCED_MOTION && r.path[1] === ROOT && /^dur-/.test(d.name)) {
        // durations only: the one sanctioned place a token changes outside a mood block
      } else {
        refused.push(`--${d.name} is declared in "${where}", where no mood is read -- declare it in :root, html.hq or html.hq.hq-light`);
      }
    }
  }
  return { scopes: found, refused };
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
  const VAR = /var\(/gi;
  while (i < text.length) {
    VAR.lastIndex = i;
    const hit = VAR.exec(text);
    if (!hit) { out += text.slice(i); break; }
    const at = hit.index;
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

/** The names a token reaches by pure `var(--x)` references, starting with itself. */
export function referencePath(name, chainMaps) {
  const path = [name];
  let cur = name;
  for (;;) {
    let raw;
    for (let i = chainMaps.length - 1; i >= 0; i--) if (chainMaps[i].has(cur)) { raw = chainMaps[i].get(cur); break; }
    const m = raw === undefined ? null : /^var\(\s*--([a-zA-Z0-9-]+)\s*\)$/.exec(raw.trim());
    if (!m || path.includes(m[1])) return path;
    path.push(m[1]);
    cur = m[1];
  }
}

const NUM = String.raw`(?:\d+\.?\d*|\.\d+)`;
const LEGACY_RGB = new RegExp(String.raw`^rgba?\(\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*(?:,\s*(${NUM})(%?)\s*)?\)$`, "i");
const MODERN_RGB = new RegExp(String.raw`^rgba?\(\s*(${NUM})\s+(${NUM})\s+(${NUM})\s*(?:\/\s*(${NUM})(%?)\s*)?\)$`, "i");

/**
 * A colour value as [r, g, b, a] with channels 0-255 and a in 0-1. Only the forms a browser reads
 * the same way: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() in ALL-comma or ALL-space syntax,
 * `transparent`. A mixed-separator rgb() is invalid CSS and is refused, never read generously.
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
  m = LEGACY_RGB.exec(v) ?? MODERN_RGB.exec(v);
  if (m) {
    const ch = [m[1], m[2], m[3]].map(Number);
    const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] === "%" ? 100 : 1);
    if (ch.some((c) => !Number.isFinite(c) || c > 255) || !Number.isFinite(a) || a > 1) {
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

/** HSL hue in degrees, of the colour as drawn (alpha ignored). */
export function hue([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  if (mx === mn) return null;
  const d = mx - mn;
  const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return h * 60;
}
export const hueDistance = (a, b) => (a === null || b === null ? null : Math.min(Math.abs(a - b), 360 - Math.abs(a - b)));

/** Two decimals, truncated: a cell never displays a floor it does not clear. */
export const show = (r) => (Math.floor(r * 100) / 100).toFixed(2);

const sameRgba = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** Everything computed for one mood, from the token file's text alone. */
export function computeMood(scopeMap, mood) {
  const findings = [];
  const chainMaps = mood.chain.map((s) => scopeMap.get(s) ?? new Map());
  const cache = new Map();
  const get = (name) => {
    if (cache.has(name)) return cache.get(name);
    let got = null;
    const v = resolveValue(name, chainMaps);
    if (v === undefined) findings.push(`${mood.name}: missing token --${name}`);
    else {
      try { got = { raw: v, color: parseColor(v) }; }
      catch (e) { findings.push(`${mood.name}: --${name} ${e.message}`); }
    }
    cache.set(name, got);
    return got;
  };

  // Every colour token the mood resolves has a role, and parses.
  const roleOf = new Map();
  for (const [role, names] of Object.entries(ROLES)) for (const n of names) roleOf.set(n, role);
  const declared = new Set(chainMaps.flatMap((m) => [...m.keys()]));
  for (const name of [...declared].sort()) {
    let v;
    try { v = resolveValue(name, chainMaps); } catch (e) { findings.push(`${mood.name}: --${name} ${e.message}`); continue; }
    if (v === undefined || !colourShaped(v)) continue;
    if (!roleOf.has(name)) findings.push(`${mood.name}: --${name} is a colour with no role in this gate -- give it one (surface, text, fill, ui, decor) or it is never measured`);
    get(name);
  }

  const base = get("bg-0");
  const surfaceColor = (name) => {
    const s = get(name);
    if (!s) return null;
    if (s.color[3] !== 1) { findings.push(`${mood.name}: surface --${name} is translucent; a surface is opaque, or no ratio on it has a single answer`); return null; }
    return s.color;
  };
  const surfaceNames = ROLES.surface.filter((n) => declared.has(n) || SURFACES.includes(n));
  const surfaces = surfaceNames.map((n) => ({ name: n, color: surfaceColor(n) }));
  const byName = (n) => surfaces.find((s) => s.name === n)?.color ?? null;

  const text = {};
  const worstOf = {};
  const textNames = ROLES.text.filter((n) => declared.has(n) || TEXT.includes(n));
  for (const t of textNames) {
    const fg = get(t);
    text[t] = surfaces.map((s) => {
      if (!fg || !s.color) return null;
      const r = contrast(over(fg.color, s.color), s.color);
      if (r < TEXT_FLOOR) findings.push(`${mood.name}: --${t} on --${s.name} is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
      return r;
    });
    const measured = text[t].filter((r) => r !== null);
    worstOf[t] = measured.length ? Math.min(...measured) : null;
  }

  const chip = {};
  for (const h of HUES) {
    const fg = get(h);
    const tripleRaw = resolveValue(`${h}-rgb`, chainMaps);
    if (tripleRaw === undefined) { findings.push(`${mood.name}: missing token --${h}-rgb`); chip[h] = null; continue; }
    let tint;
    try { tint = parseColor(`rgba(${tripleRaw}, 0.1)`); }
    catch (e) { findings.push(`${mood.name}: --${h}-rgb ${e.message}`); chip[h] = null; continue; }
    if (fg && !(fg.color[0] === tint[0] && fg.color[1] === tint[1] && fg.color[2] === tint[2])) {
      findings.push(`${mood.name}: --${h}-rgb (${tripleRaw}) disagrees with --${h} (${fg.raw})`);
    }
    if (!fg) { chip[h] = null; continue; }
    const ratios = CHIP_SURFACES.map((n) => {
      const bg = byName(n);
      if (!bg) return null;
      const ground = over(tint, bg);
      const r = contrast(over(fg.color, ground), ground);
      if (r < TEXT_FLOOR) findings.push(`${mood.name}: --${h} on its own chip tint over --${n} is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
      return r;
    }).filter((r) => r !== null);
    chip[h] = ratios.length ? Math.min(...ratios) : null;
  }

  const fill = [];
  for (const [fgName, bgName] of FILLS) {
    const fg = get(fgName);
    const bg = get(bgName);
    const label = bgName === "text-1" ? `${fgName} on ${bgName} (primary button)` : `${fgName} on ${bgName}`;
    if (!fg || !bg || !base || base.color[3] !== 1) continue;
    const bgc = bg.color[3] === 1 ? bg.color : over(bg.color, base.color);
    const r = contrast(over(fg.color, bgc), bgc);
    if (r < TEXT_FLOOR) findings.push(`${mood.name}: ${label} is ${show(r)}:1, under ${TEXT_FLOOR}:1`);
    fill.push({ label, ratio: r });
  }

  const ui = [];
  const track = get("track");
  const bg2 = byName("bg-2");
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
  const ring = get("focus-ring");
  if (ring) {
    const worst = surfaces.filter((s) => s.color).map((s) => ({ s, r: contrast(over(ring.color, s.color), s.color) }))
      .reduce((a, b) => (a === null || b.r < a.r ? b : a), null);
    if (worst) {
      if (worst.r < UI_FLOOR) findings.push(`${mood.name}: --focus-ring on --${worst.s.name} is ${show(worst.r)}:1, under ${UI_FLOOR}:1`);
      ui.push({ label: `focus-ring (worst: ${worst.s.name})`, ratio: worst.r });
    }
  }

  // The reserved meanings: the reference a token is spelled through, AND the hue it lands in, so
  // a value one step off violet is caught as surely as a var(--violet).
  const law = [];
  const lawCheck = (label, ok) => {
    law.push({ label, ok });
    if (!ok) findings.push(`${mood.name}: LAW ${label}`);
  };
  const refs = (n) => referencePath(n, chainMaps);
  const hueOf = (n) => { const g = get(n); return g ? hue(g.color) : null; };
  const near = (a, b, deg) => { const d = hueDistance(hueOf(a), hueOf(b)); return d !== null && d <= deg; };
  const far = (a, b, deg) => { const d = hueDistance(hueOf(a), hueOf(b)); return d !== null && d >= deg; };
  lawCheck("council is var(--accent-dim) (ADR-1322)", refs("kind-council").includes("accent-dim"));
  lawCheck(`council sits in the accent's hue, within ${SAME_HUE} degrees (ADR-1322)`, near("kind-council", "accent", SAME_HUE));
  lawCheck(`council is at least ${DISTINCT_HUE} degrees from violet (ADR-1322)`, far("kind-council", "violet", DISTINCT_HUE));
  lawCheck("simulated is var(--violet) (the non-real family)", refs("sim-fg").includes("violet") && refs("mode-sim").includes("violet"));
  lawCheck(`violet is at least ${DISTINCT_HUE} degrees from accent, green, amber and red`, ["accent", "green", "amber", "red"].every((n) => far("violet", n, DISTINCT_HUE)));
  lawCheck("live is var(--accent) (collision 3)", refs("mode-live").includes("accent"));
  lawCheck(`live is at least ${DISTINCT_HUE} degrees from green (collision 3)`, far("mode-live", "green", DISTINCT_HUE));
  lawCheck("money is var(--green)", refs("kind-money").includes("green"));
  lawCheck("needs-you is var(--amber)", refs("kind-decision").includes("amber"));

  // Which names share a base name's value: listed, so a re-spelled alias changes the header.
  const shares = [];
  const extras = [];
  for (const t of textNames.filter((n) => !TEXT.includes(n))) {
    const me = get(t);
    const twin = me ? TEXT.find((b) => { const g = get(b); return g && sameRgba(g.color, me.color); }) : undefined;
    if (twin) shares.push(`${t}=${twin}`);
    else if (worstOf[t] !== null) extras.push({ label: t, ratio: worstOf[t] });
  }
  for (const s of surfaceNames.filter((n) => !SURFACES.includes(n))) {
    const me = byName(s);
    const twin = me ? SURFACES.find((b) => { const g = byName(b); return g && sameRgba(g, me); }) : undefined;
    if (twin) shares.push(`${s}=${twin}`);
    else extras.push({ label: `surface ${s} (its own value)`, ratio: null });
  }

  return {
    mood: mood.name, text, chip, fill, ui, law, shares, extras,
    surfaces: SURFACES, findings: [...new Set(findings)],
  };
}

/** The whole analysis: which moods exist, and every finding across them. */
export function analyse(css) {
  const { scopes: scopeMap, refused } = scopes(css);
  const findings = [];
  for (const sel of [ROOT, DARK, LIGHT]) if (!scopeMap.has(sel)) findings.push(`missing selector ${sel}`);
  findings.push(...refused);
  const moods = MOODS.map((m) => computeMood(scopeMap, m));
  for (const m of moods) findings.push(...m.findings);
  return { moods, findings };
}

/** The header block, as this script renders it. The only legitimate spelling of these numbers. */
export function renderBlock(analysis) {
  const W = 9;
  const cell = (r) => (r === null || r === undefined ? "--".padStart(W - 1) + " " : `${show(r).padStart(W - 1)}${r < TEXT_FLOOR ? "!" : " "}`);
  const lines = [BEGIN];
  lines.push("   generated by tests/face/tokens-contrast.mjs --write; its check mode FAILS when this");
  lines.push(`   block differs from a recompute. "!" marks a pair under its floor. chip = the worst of`);
  lines.push(`   a hue on its own tint over ${CHIP_SURFACES.join(", ")}.`);
  for (const m of analysis.moods) {
    const sel = MOODS.find((x) => x.name === m.mood).selector;
    lines.push("");
    lines.push(`   ${m.mood} (${sel}) -- text on surface, floor ${TEXT_FLOOR}:1`);
    lines.push(`   ${"token".padEnd(11)}${[...SURFACES, "chip"].map((s) => `${s.padStart(W - 1)} `).join("")}`);
    for (const t of TEXT) {
      const chip = HUES.includes(t) ? cell(m.chip[t]) : "";
      lines.push(`   ${t.padEnd(11)}${(m.text[t] ?? []).slice(0, SURFACES.length).map(cell).join("")}${chip}`);
    }
    for (const e of m.extras) lines.push(`   extra ${e.label.padEnd(34)}${e.ratio === null ? "measured under every text row" : `${cell(e.ratio)} (worst surface)`}`);
    if (m.shares.length) {
      let row = "   same value:";
      for (const s of m.shares) {
        if (row.length + s.length + 1 > 96) { lines.push(row); row = "              "; }
        row += ` ${s}`;
      }
      lines.push(row);
    }
    for (const f of m.fill) lines.push(`   fill  ${f.label.padEnd(34)}${cell(f.ratio)}`);
    for (const u of m.ui) lines.push(`   ui    ${u.label.padEnd(34)}${show(u.ratio).padStart(W - 1)}${u.ratio < UI_FLOOR ? "!" : " "} (floor ${UI_FLOOR}:1)`);
    for (const l of m.law) lines.push(`   law   ${l.label} -- ${l.ok ? "holds" : "BROKEN"}`);
  }
  lines.push(`   ${END}`);
  // No trailing whitespace: the block lives in a tracked file that whitespace checks read.
  return lines.map((l) => l.replace(/\s+$/, "")).join("\n");
}

/** One line ending throughout: the analysis, the block and the written file are all LF. */
export const normalise = (css) => css.replace(/\r\n/g, "\n");

/** The block currently in the file, or null when the markers are absent. Markers must sit in a comment. */
export function currentBlock(css) {
  const count = (s) => css.split(s).length - 1;
  const nb = count(BEGIN);
  const ne = count(END);
  if (nb === 0 && ne === 0) return null;
  if (nb !== 1 || ne !== 1) throw new SetupError("the computed-contrast markers must each appear exactly once");
  const b = css.indexOf(BEGIN);
  const e = css.indexOf(END);
  if (e < b) throw new SetupError("the END computed-contrast marker comes before BEGIN");
  const stripped = stripComments(css);
  for (const [at, len] of [[b, BEGIN.length], [e, END.length]]) {
    if (stripped.slice(at, at + len).trim() !== "") throw new SetupError("a computed-contrast marker sits outside a comment");
  }
  return css.slice(b, e + END.length);
}

/** Findings for a check: the analysis, plus a header that is missing, typed or stale. */
export function checkText(raw) {
  const css = normalise(raw);
  const analysis = analyse(css);
  const findings = [...analysis.findings];
  const have = currentBlock(css);
  if (have === null) findings.push(`the header has no computed-contrast block (markers "${BEGIN}" / "${END}")`);
  else if (have !== renderBlock(analysis)) findings.push("the header's contrast block differs from a recompute -- it is stale or typed; run tokens-contrast.mjs --write");
  return { analysis, findings };
}

/** The file text with its block replaced by a fresh render, verified readable before it is returned. */
export function writeText(raw) {
  const css = normalise(raw);
  const analysis = analyse(css);
  const have = currentBlock(css);
  if (have === null) throw new SetupError(`cannot write: the file has no "${BEGIN}" ... "${END}" markers to write between`);
  const text = css.replace(have, () => renderBlock(analysis));
  // The writer never produces a file its own reader refuses.
  const again = checkText(text);
  if (again.findings.some((f) => /stale or typed|no computed-contrast block/.test(f))) {
    throw new SetupError("cannot write: the rewritten file does not read back as its own block");
  }
  return { text, analysis };
}

function selftest(file) {
  const { text: fresh } = writeText(readFileSync(file, "utf8"));
  let ok = true;
  const arm = (label, cond) => { if (!cond) ok = false; console.log(`${label.padEnd(66)} ${cond ? "PASS" : "FAIL"}`); };
  const has = (t, re) => { try { return checkText(t).findings.some((f) => re.test(f)); } catch { return false; } };
  const refusedWhole = (t) => { try { checkText(t); return false; } catch (e) { return e instanceof SetupError; } };
  const mutate = (from, to) => { if (!fresh.includes(from)) throw new SetupError(`selftest mutant anchor not found: ${from}`); return fresh.replace(from, to); };
  const inBlock = (sel, from, to) => {
    const at = fresh.search(new RegExp(`\\n${sel.replace(/\./g, "\\.")}\\{`));
    if (at === -1) throw new SetupError(`selftest mutant block not found: ${sel}`);
    const end = fresh.indexOf("\n}", at);
    const block = fresh.slice(at, end);
    if (!block.includes(from)) throw new SetupError(`selftest mutant anchor not found in ${sel}: ${from}`);
    return fresh.slice(0, at) + block.replace(from, to) + fresh.slice(end);
  };
  const append = (css) => `${fresh}\n${css}\n`;

  arm("the freshly written file checks clean", checkText(fresh).findings.length === 0);
  arm("a CRLF copy of it checks the same as LF", checkText(fresh.replace(/\n/g, "\r\n")).findings.length === 0);
  arm("a hand-typed number in the block FAILS", has(fresh.replace(/(\n {3}text-1\s+)(\d)/, (m, a, d) => a + (d === "9" ? "8" : "9")), /stale or typed/));
  arm("a missing block FAILS", has(fresh.replace(BEGIN, "BEGIN something-else").replace(END, "END something-else"), /no computed-contrast block/));
  arm("a missing light mood FAILS by name", has(fresh.replace(/\nhtml\.hq\.hq-light\{/, "\nhtml.hq.hq-dim{"), /missing selector html\.hq\.hq-light/));
  arm("a light --text-3 under 4.5:1 FAILS", has(inBlock("html.hq.hq-light", "--text-3: #636b77", "--text-3: #c9cdd3"), /light: --text-3 on --bg-\d is \d\.\d\d:1, under 4\.5:1/));
  arm("a -rgb triple that disagrees with its hex FAILS", has(inBlock("html.hq", "--blue-rgb: 88, 166, 255", "--blue-rgb: 8, 9, 7"), /dark: --blue-rgb .* disagrees with --blue/));
  arm("council repointed at violet FAILS the law", has(inBlock("html.hq", "--kind-council: var(--accent-dim)", "--kind-council: var(--violet)"), /LAW council is var\(--accent-dim\)/));
  arm("council one step off violet FAILS the hue law", has(inBlock("html.hq", "--accent-dim: rgba(var(--accent-rgb), 0.74)", "--accent-dim: #a78bfb"), /LAW council sits in the accent's hue/));
  arm("live repointed at green FAILS the law", has(inBlock("html.hq", "--mode-live: var(--accent)", "--mode-live: var(--green)"), /LAW live is var\(--accent\)/));
  arm("a missing --blue FAILS by name", has(fresh.replace(/--blue:/g, "--bleu:"), /missing token --blue\b/));
  arm("a token re-declared under a reordered mood selector FAILS", has(append("html.hq-light.hq{ --text-3: #c9cdd3; }"), /--text-3 is declared in "html\.hq-light\.hq", where no mood is read/));
  arm("a token re-declared inside @supports FAILS", has(append("@supports (color: red){ html.hq.hq-light{ --text-3: #c9cdd3; } }"), /where no mood is read/));
  arm("a token declared !important FAILS", has(append(":root{ --kind-council: var(--violet) !important; }"), /!important reorders the cascade/));
  arm("a /* inside an unquoted url() hides no declaration", has(inBlock("html.hq.hq-light", "--text-3: #636b77;", "--paper: url(https://x.example/a/*.png); --text-3: #c9cdd3; --paper-2: url(https://x.example/b*/c.png);"), /light: --text-3 on --bg-\d is/));
  arm("an rgb() mixing comma and space syntax is unreadable, not read", has(inBlock("html.hq.hq-light", "--on-fill: #ffffff", "--on-fill: rgb(255 255, 255)"), /--on-fill not a colour this gate can read/));
  arm("a legacy alias re-spelled as a literal under the floor FAILS", has(inBlock("html.hq.hq-light", "--text-3: #636b77;", "--text-3: #636b77; --faint: rgba(255, 255, 255, 0.46);"), /light: --faint on --bg-\d is/));
  arm("a colour token with no role FAILS", has(inBlock("html.hq", "--blue: #58a6ff;", "--blue: #58a6ff; --brand-pop: #ff00aa;"), /--brand-pop is a colour with no role/));
  arm("a translucent surface FAILS", has(inBlock("html.hq", "--bg-4: #20252b", "--bg-4: rgba(255, 255, 255, 0.075)"), /surface --bg-4 is translucent/));
  arm("every on-X fill is measured (on-red re-pointed at on-fill)", has(inBlock("html.hq", "--on-red: var(--bg-0)", "--on-red: var(--on-fill)"), /dark: on-red on red is \d\.\d\d:1/));
  // Both markers moved out of the header into a string value: each appears once, in order, and
  // outside any comment -- the writer must refuse it rather than produce a file it cannot read.
  const block = currentBlock(fresh);
  const markersInString = fresh.replace(block, "block moved").replace("--blue: #58a6ff;", `--blue: #58a6ff; --note: "${BEGIN} ${END}";`);
  arm("a marker outside a comment is refused whole", refusedWhole(markersInString));
  // One closing brace removed from the dark block: the rest of the file would be read as part of it.
  arm("an unbalanced file is refused, not half-read", refusedWhole(fresh.replace(/(\nhtml\.hq\{[^}]*)\}/, "$1")));
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
    const raw = readFileSync(opts.file, "utf8");
    if (opts.write) {
      const { text, analysis } = writeText(raw);
      if (text !== raw) writeFileSync(opts.file, text);
      console.log(`tokens-contrast: wrote the computed-contrast block (${analysis.findings.length} finding(s))`);
      for (const f of analysis.findings) console.log(`FAIL ${f}`);
      return analysis.findings.length ? 1 : 0;
    }
    const { analysis, findings } = checkText(raw);
    const pairs = analysis.moods.reduce((n, m) => n + Object.values(m.text).flat().filter((r) => r !== null).length
      + Object.values(m.chip).filter((r) => r !== null && r !== undefined).length * CHIP_SURFACES.length + m.fill.length + m.ui.length, 0);
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
