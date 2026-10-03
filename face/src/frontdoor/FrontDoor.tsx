// FrontDoor.tsx -- the front door, option A of ADR-1349 (face v2 Phase 09, REQ-13): the hero and nothing under it.
//
// Ported from docs/design/reference/face-hq/assets/arcface/src/hq/Landing.jsx (v0.7) with declared deltas:
//   1. the hero only: the nav's section links, the stats band, the platform, loop, spine and ventures sections and the
//      chapters are option B, the faithful landing, and are not here until the owner asks for them;
//   2. one message line under the face, as ADR-1349 §2 has it (v0.7's hero is the face alone);
//   3. the ask dock sits under the hero (App renders it, Phase 10, ADR-1350): typed or spoken, the owner's model for
//      what arc's record cannot answer; the conversation fade is not ported;
//   4. a visible line when the stage cannot draw, the guard the debt ledger asked for.
// The face itself is App's, a sibling of this surface: it has to outlive the door for the warp into the workroom.
// Its colours are the door's one look in both moods, from neon.mjs, never a literal here (ADR-1349 §4).
import { EASE, FONT, MONO } from '../ui/kit'
import { NEON } from './neon.mjs'

export default function FrontDoor({ onEnter, stageFailed }: { onEnter: () => void; stageFailed: boolean }) {
  return (
    <main data-surface="front-door" className="relative z-10 min-h-[100dvh]" style={{ background: stageFailed ? NEON.ground : 'transparent' }}>
      <header className="fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between gap-6 px-5 sm:px-8 h-[68px] max-w-[1360px] mx-auto">
          <span className="flex items-baseline gap-2 shrink-0">
            <span className="text-[22px] tracking-tight leading-none" style={{ fontFamily: FONT, fontWeight: 600, color: NEON.text }}>arc</span>
            <span className="text-[9.5px] uppercase tracking-[0.3em]" style={{ fontFamily: MONO, color: NEON.accent }}>os</span>
          </span>
          <button
            type="button"
            data-enter-hq
            onClick={onEnter}
            className="group inline-flex items-center gap-3 rounded-full cursor-pointer transition-all duration-500 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 pl-5 pr-1.5 min-h-[44px] text-[11.5px]"
            style={{ fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase', transitionTimingFunction: EASE, color: NEON.ink, background: NEON.accent, border: `1px solid ${NEON.accent}`, fontWeight: 700, outlineColor: NEON.accent }}
          >
            enter hq
            <span
              aria-hidden="true"
              className="flex items-center justify-center rounded-full w-8 h-8 transition-transform duration-500 group-hover:translate-x-[2px] group-hover:-translate-y-[1px]"
              style={{ background: NEON.chip, transitionTimingFunction: EASE }}
            >
              ↗
            </span>
          </button>
        </div>
      </header>

      {/* the hero: the face alone owns it. The nav carries ENTER HQ. */}
      <section aria-label="arc — the face" className="relative min-h-[100dvh] overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-32">
          <div className="max-w-[1360px] mx-auto">
            <h1 className="text-[28px] sm:text-[40px] leading-[1.04] tracking-tight" style={{ fontFamily: FONT, fontWeight: 600, color: NEON.text }}>
              Speak to the company.
            </h1>
            {stageFailed && (
              <p data-stage-fallback role="status" className="mt-3 text-[13px] leading-[20px] max-w-[52ch]" style={{ fontFamily: MONO, color: NEON.muted }}>
                The face could not draw in this browser. The HQ works without it.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
