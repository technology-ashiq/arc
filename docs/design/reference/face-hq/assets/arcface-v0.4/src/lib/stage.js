// ─────────────────────────────────────────────────────────────
// Shared stage store — how present the face is (0..1) and which
// chapter the viewer is in. Written by App's scroll tracker,
// read by FaceStage inside its animation loop. Deliberately a
// plain mutable object: the render loop samples it every frame,
// so no React state churn is needed.
// ─────────────────────────────────────────────────────────────
export const stage = {
  presence: 1, // 1 = hero/finale (face fully forward) · ~0.3 = reading chapters
  chapter: 0, // active chapter index 0..9
  // landing ⇄ HQ crossing: dir +1 = into the HQ (face flies past the
  // camera), -1 = back to the landing (face swoops back in). `id`
  // increments per crossing so FaceStage can detect each one.
  warp: { dir: 0, id: 0 },
  reducedMotion:
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
}

const listeners = new Set()
export function setStage(patch) {
  Object.assign(stage, patch)
  listeners.forEach((fn) => fn(stage))
}
export function onStage(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
