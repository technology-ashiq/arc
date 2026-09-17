// mood.mjs -- which mood the workroom is in, and what that means for <html> (face v2 Phase 01,
// ADR-1331). Dependency-free, so tests/face/l3-logic.mjs holds every rule here with no install.
//
// Two moods, both real token sets in docs/design/system/tokens.css: `html.hq` is the dark
// workroom and `html.hq.hq-light` is paper. The choice is the owner's and lives in this browser
// under v0.7's own key, so a v0.7 habit carries over; it is a preference, never a receipt, and
// the spine never hears about it.

/** v0.7's storage key (src/hq/HQ.jsx). face/scripts/smoke.mjs writes the same key to pick a mood. */
export const MOOD_KEY = "arc-hq-theme";

/** @typedef {"dark" | "light"} Mood */
export const MOODS = /** @type {const} */ (["dark", "light"]);

/**
 * A stored value as a mood. Anything that is not exactly "light" is dark -- the mood the
 * workroom opens in when nothing was chosen, or when what was stored is not a mood at all.
 * @param {unknown} stored
 * @returns {Mood}
 */
export function moodFrom(stored) {
  return stored === "light" ? "light" : "dark";
}

/** @param {Mood} mood @returns {Mood} */
export function nextMood(mood) {
  return mood === "light" ? "dark" : "light";
}

/**
 * The mood this browser stored, or dark when storage is absent or refuses to be read (a private
 * window, a disabled storage policy). Never throws: a mood is not worth a blank screen.
 * @param {{ getItem(key: string): string | null } | null | undefined} storage
 * @returns {Mood}
 */
export function readMood(storage) {
  try {
    return moodFrom(storage ? storage.getItem(MOOD_KEY) : null);
  } catch {
    return "dark";
  }
}

/**
 * Remember the mood. Returns whether it was stored; a refusal leaves the mood working for this
 * visit only, which is the honest outcome.
 * @param {{ setItem(key: string, value: string): void } | null | undefined} storage
 * @param {Mood} mood
 */
export function storeMood(storage, mood) {
  try {
    if (!storage) return false;
    storage.setItem(MOOD_KEY, moodFrom(mood));
    return true;
  } catch {
    return false;
  }
}

/**
 * Put the workroom's classes on an element's class list: `hq` always, `hq-light` exactly in the
 * light mood. Takes the classList itself so a fake one proves it without a DOM.
 * @param {{ add(c: string): void, remove(c: string): void }} classList
 * @param {Mood} mood
 */
export function applyMood(classList, mood) {
  classList.add("hq");
  if (moodFrom(mood) === "light") classList.add("hq-light");
  else classList.remove("hq-light");
}

/**
 * The words a toggle carries: what pressing it will do, not what the mood is.
 * @param {unknown} mood
 */
export function moodToggleLabel(mood) {
  return moodFrom(mood) === "light" ? "Switch to the dark mood" : "Switch to the light mood";
}
