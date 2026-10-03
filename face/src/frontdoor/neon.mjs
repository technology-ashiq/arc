// neon.mjs -- the front door's one look (face v2 Phase 09, ADR-1349 §4).
//
// The door keeps the ORIGINAL neon identity in both moods: the calm palette is the workroom's, and the light mood is a
// workroom mood only (v0.7 Landing.jsx: "the landing keeps the ORIGINAL neon identity"). These are the only colour
// literals the colour-literal lint allows under face/src/frontdoor, and it allows them in this file by name, so a second
// spelling of the door's colours anywhere else FAILs.
import { FACE_PALETTE } from "../lib/stage.mjs";

export const NEON = Object.freeze({
  /** the face's own accent: one spelling, shared with the stage */
  accent: FACE_PALETTE.accent,
  /** the button's ink on the neon fill (v0.7 PillBtn) */
  ink: "#031311",
  /** the door's ground, the same black the stage clears to */
  ground: FACE_PALETTE.ground,
  /** the display line */
  text: "#ffffff",
  /** the kicker and the fallback line */
  muted: "rgba(255, 255, 255, 0.62)",
  /** the arrow chip inside the button */
  chip: "rgba(0, 0, 0, 0.16)",
  /** the ask bar's glass over the face (Phase 10, ADR-1350): the ground shows through, never a white panel */
  glass: "rgba(255, 255, 255, 0.06)",
  /** the ask bar's hairline */
  line: "rgba(255, 255, 255, 0.14)",
  /** behind an answer, so it reads over the particles */
  veil: "rgba(0, 0, 0, 0.55)",
  /** an answer whose citation is not on arc's record */
  warn: "#ff8f7a",
});
