// FrontDoorAsk.tsx -- the ask bar on the front door (face v2 Phase 10, REQ-14, ADR-1350).
//
// The door's own look, not the workroom's: a slim glass pill over the face in the neon palette, the answer floating
// above it on a dark veil. No settings here -- models and voice are configured inside HQ (Header -> Settings); the bar
// only asks. The brain, the labels and voice are useAsk's, shared with the workroom's Dock. Colours are neon.mjs's.
import type { FormEvent } from 'react'
import { ArrowUpRight, Microphone, X } from '@phosphor-icons/react'
import type { Door } from '../lib/door.mjs'
import { EASE, FONT, MONO } from '../ui/kit'
import { useAsk } from '../shell/useAsk'
import { NEON } from './neon.mjs'

export default function FrontDoorAsk({ door, voiceOn }: { door: Door; voiceOn: boolean }) {
  const { draft, setDraft, state, ask, voice, press, micShown, close } = useAsk(door, voiceOn)
  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); void ask(draft) }
  const busy = state.phase === 'asking'
  const listening = voice === 'listening'

  return (
    <div data-ask-dock="door" className="fixed bottom-0 left-0 right-0 z-40 px-5 sm:px-8 pb-7 pointer-events-none">
      <div className="max-w-[640px] mx-auto flex flex-col gap-3">
        {state.phase !== 'idle' ? (
          <div role="status" className="pointer-events-auto relative px-5 py-4 rounded-2xl" style={{ background: NEON.veil, border: `1px solid ${NEON.line}`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <button type="button" aria-label="Close the answer" onClick={close} className="absolute top-2.5 right-2.5 w-7 h-7 inline-flex items-center justify-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: NEON.muted, outlineColor: NEON.accent }}>
              <X size={13} aria-hidden="true" />
            </button>
            {state.phase === 'asking' || state.phase === 'answered' || state.phase === 'refused' ? (
              <div className="text-[10.5px] uppercase tracking-[0.18em] mb-2 pr-8 truncate" style={{ fontFamily: MONO, color: NEON.muted }}>{state.question}</div>
            ) : null}
            {state.phase === 'blocked' ? <div className="text-[14px]" style={{ color: NEON.muted }}>{state.why}</div> : null}
            {state.phase === 'asking' ? <div className="text-[15px] animate-pulse" style={{ fontFamily: FONT, color: NEON.muted }}>thinking…</div> : null}
            {state.phase === 'answered' ? (
              <>
                <div className="text-[16px] sm:text-[18px] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: FONT, color: NEON.text }}>{state.answer}</div>
                <div data-answer-tag={state.tone} className="mt-2.5 text-[10.5px] uppercase tracking-[0.14em]" style={{ fontFamily: MONO, color: state.tone === 'warn' ? NEON.warn : state.tone === 'general' ? NEON.accent : NEON.muted }}>
                  {state.tag}{state.model ? ` · ${state.model}` : ''}
                </div>
                {state.howTo ? <div data-needs-model className="mt-2 text-[13px] leading-[19px]" style={{ color: NEON.muted }}>{state.howTo}</div> : null}
              </>
            ) : null}
            {state.phase === 'refused' ? (
              <div className="text-[14px]" style={{ color: NEON.muted }}>
                <span className="text-[10.5px] uppercase tracking-[0.14em] mr-2" style={{ fontFamily: MONO, color: NEON.warn }}>{state.code}</span>
                {state.human}
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="pointer-events-auto flex items-center gap-2 rounded-full pl-5 pr-1.5 h-[54px] transition-shadow duration-500"
          style={{ background: NEON.glass, border: `1px solid ${listening ? NEON.accent : NEON.line}`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', transitionTimingFunction: EASE }}
        >
          <label htmlFor="ask-arc-dock" className="sr-only">Ask arc anything</label>
          <input
            id="ask-arc-dock"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={listening ? 'listening…' : busy ? 'thinking…' : 'Ask arc anything'}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] tracking-tight"
            style={{ fontFamily: FONT, color: NEON.text, caretColor: NEON.accent }}
          />
          {micShown ? (
            <button
              type="button"
              data-voice-mic={voice}
              aria-label={listening ? 'Stop listening' : voice === 'speaking' ? 'Stop speaking' : 'Ask by voice'}
              aria-pressed={voice !== 'idle'}
              onClick={press}
              className="w-[40px] h-[40px] rounded-full inline-flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: voice === 'idle' ? NEON.muted : NEON.accent, outlineColor: NEON.accent }}
            >
              <Microphone size={18} weight={listening ? 'fill' : 'regular'} aria-hidden="true" className={listening ? 'animate-pulse' : ''} />
            </button>
          ) : null}
          <button
            type="submit"
            aria-label="Ask arc"
            disabled={busy}
            className="w-[40px] h-[40px] rounded-full inline-flex items-center justify-center cursor-pointer transition-transform duration-500 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: NEON.accent, color: NEON.ink, outlineColor: NEON.accent, transitionTimingFunction: EASE }}
          >
            <ArrowUpRight size={17} weight="bold" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  )
}
