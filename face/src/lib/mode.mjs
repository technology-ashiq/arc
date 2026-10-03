// mode.mjs -- which surface the address bar asks for: the front door or the workroom (face v2 Phase 09, REQ-13, ADR-1349).
//
// Dependency-free ESM like every lib module: CI never runs `npm install`, so a routing branch inside a .tsx is one no
// test holds. The design (v0.7 App.jsx) has two surfaces over one address bar: the front door at `/` with the face at
// full presence, and the workroom at `#hq`, "a clean room, the face belongs to the front door". The workroom's own
// addresses are `#/<room>` (shell.mjs), so any room in the fragment is the workroom too: every link the product and the
// harness already print keeps opening the room it named.

/** The workroom with no room named: the served registry's home room (registry.mjs homeRoom). */
export const HQ_PART = "hq";

/**
 * How long the stage stays mounted after ENTER HQ: the warp's fly-through (1.6 s) plus a beat, as the design has it
 * (v0.7 App.jsx, 1750 ms). After it the workroom holds no stage node at all.
 */
export const STAGE_UNMOUNT_MS = 1750;

/** The warp's length each way, in seconds (v0.7 FaceStage.jsx): in is the longer fly-past, out the swoop back. */
export const WARP_IN_S = 1.6;
export const WARP_OUT_S = 1.4;

/**
 * The fragment's parts, or null when it cannot be read. A malformed escape (`%E0`) throws inside
 * `decodeURIComponent`, and an address bar that throws is a blank page -- so a fragment nobody can read is the
 * front door, never an error.
 * @param {unknown} hash
 * @returns {{ room: string | null, hq: boolean, token: string | null } | null}
 */
function readParts(hash) {
  if (typeof hash !== "string") return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  let room = null;
  let hq = false;
  let token = null;
  try {
    for (const part of raw.split("&")) {
      if (!part) continue;
      if (part === HQ_PART) { hq = true; continue; }
      if (part.startsWith("/")) {
        const id = decodeURIComponent(part.slice(1)).trim();
        if (id) room = id;
        continue;
      }
      const eq = part.indexOf("=");
      if (eq !== -1 && part.slice(0, eq) === "token") {
        const v = decodeURIComponent(part.slice(eq + 1));
        if (v) token = v;
      }
    }
  } catch {
    return null;
  }
  return { room, hq, token };
}

/**
 * The surface a fragment asks for. `door` unless it names the workroom (`hq`) or a room in it (`/<room>`); an empty,
 * token-only, unknown or unreadable fragment is the front door.
 * @param {unknown} hash
 * @returns {"door" | "hq"}
 */
export function modeOf(hash) {
  const p = readParts(hash);
  if (!p) return "door";
  return p.hq || p.room !== null ? "hq" : "door";
}

/**
 * The fragment ENTER HQ writes: the workroom, with the door's token carried through so the rooms can still read.
 * @param {unknown} hash  the current fragment
 * @returns {string}
 */
export function enterHash(hash) {
  const p = readParts(hash);
  const token = p ? p.token : null;
  return token ? `#${HQ_PART}&token=${encodeURIComponent(token)}` : `#${HQ_PART}`;
}

/**
 * The fragment leaving the workroom writes: the front door, token kept. The empty fragment is `#`, never "", because
 * assigning "" to `location.hash` leaves the old fragment on some engines and fires no hashchange.
 * @param {unknown} hash
 * @returns {string}
 */
export function exitHash(hash) {
  const p = readParts(hash);
  const token = p ? p.token : null;
  return token ? `#token=${encodeURIComponent(token)}` : "#";
}

/**
 * Which way the warp runs when the surface changes: 1 into the workroom (the face flies past the camera), -1 back out
 * (it swoops in from beyond the lens), 0 when nothing was crossed.
 * @param {"door" | "hq"} prev @param {"door" | "hq"} next
 * @returns {1 | -1 | 0}
 */
export function warpDir(prev, next) {
  if (prev === next) return 0;
  return next === "hq" ? 1 : -1;
}

/**
 * Whether the stage is mounted. On the door, always. In the workroom only while the warp that brought you in is still
 * flying: a workroom opened straight from its address never mounts it, which is the Phase 02 "clean room" ruling.
 * @param {"door" | "hq"} mode @param {boolean} warping  a crossing into the workroom younger than STAGE_UNMOUNT_MS
 * @returns {boolean}
 */
export function stageOn(mode, warping) {
  return mode === "door" || warping === true;
}

/**
 * The warp's targets at `t` (0..1 of the pass), exactly v0.7 FaceStage.jsx's timeline. The render loop smooths toward
 * them, so a warp restarted mid-flight glides rather than jumps. `done` ends the pass; after it every target is at rest.
 * @param {number} dir  1 in, -1 out, anything else no warp
 * @param {number} t
 * @returns {{ scale: number, opacity: number, flash: number, spread: number, done: boolean }}
 */
export function warpTargets(dir, t) {
  const rest = { scale: 1, opacity: 1, flash: 0, spread: 0, done: true };
  if ((dir !== 1 && dir !== -1) || !Number.isFinite(t) || t >= 1) return rest;
  const u = Math.max(0, t);
  const arc = Math.sin(Math.PI * u);
  if (dir === 1) {
    // into the HQ: accelerate toward the camera and fade as it passes
    const e = u * u * u;
    return { scale: 1 + e * 2.8, opacity: u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.25), flash: arc * 0.28, spread: arc * 1.1, done: false };
  }
  // back to the door: swoop in from beyond the lens
  const e = (1 - u) * (1 - u) * (1 - u);
  return { scale: 1 + e * 2.8, opacity: u < 0.2 ? 0 : Math.min(1, (u - 0.2) / 0.4), flash: arc * 0.16, spread: arc * 0.6, done: false };
}
