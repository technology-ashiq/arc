// Dock.tsx -- the ask dock, in the workroom's content column (face v2 Phase 02; voice and the owner's model since
// Phase 10, ADR-1350).
//
// v0.7's VoiceDock (docs/design/reference/face-hq/assets/arcface/src/chrome/VoiceDock.jsx) ported as its
// workroom form: a pill with a typed ask, suggestion chips while it has focus, and the answer in a
// caption panel above it. Declared deltas:
//   - voice is a setting, off until the owner turns it on in HQ's Settings (ADR-1350, which amends ADR-1315): a mic when
//     the browser can listen, the answer read aloud when it can speak; typing always works;
//   - a question the reader cannot reach goes to the model the owner added in HQ's Settings -- never configured from
//     here -- and the answer carries the label the DOOR wrote: from arc's record, general, or unverified;
//   - the brain is the door's `POST /api/ask` through the SAME read-only handle the Ask arc room uses
//     (ask.mjs readOnly + ASK_GRANTS): no provider key in the browser and no write tool (ADR-1325);
//   - the chips are ask.mjs's EXAMPLE_QUESTIONS, the questions the deterministic reader is known to
//     reach, not v0.7's room-keyed table -- a shell file names no room;
//   - the front door has its own bar in its own neon look (frontdoor/FrontDoorAsk.tsx); both run useAsk.
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Microphone, X } from '@phosphor-icons/react'
import { EXAMPLE_QUESTIONS } from '../lib/ask.mjs'
import { citationLine } from '../lib/registry.mjs'
import type { Door } from '../lib/door.mjs'
import { UI } from '../ui/kit'
import { useAsk } from './useAsk'

export default function Dock({ door, voiceOn }: { door: Door; voiceOn: boolean }) {
  const { draft, setDraft, state, ask, voice, press, micShown, close } = useAsk(door, voiceOn)
  const [focused, setFocused] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); void ask(draft) }
  const chipsVisible = focused && (state.phase === 'idle' || state.phase === 'blocked')
  const conversation = state.phase !== 'idle'

  return (
    <div data-ask-dock="workroom" className="fixed bottom-0 right-0 left-0 lg:left-[240px] z-40 pointer-events-none" style={{ fontFamily: UI }}>
      {conversation ? (
        <div className="flex justify-center px-5 mb-3">
          <div role="status" className="pointer-events-auto max-w-2xl w-full px-6 py-4 relative" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
            <button
              type="button"
              aria-label="Close the answer"
              onClick={close}
              className="absolute top-3 right-3 inline-flex items-center justify-center w-[26px] h-[26px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ color: 'var(--text-3)', borderRadius: 'var(--r-sm)' }}
            >
              <X size={14} aria-hidden="true" />
            </button>
            {state.phase === 'blocked' ? (
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>{state.why}</div>
            ) : null}
            {state.phase === 'asking' || state.phase === 'answered' || state.phase === 'refused' ? (
              <div className="text-[11px] uppercase tracking-[0.12em] mb-2.5 pr-8" style={{ fontWeight: 600, color: 'var(--text-3)' }}>
                you: {state.question}
              </div>
            ) : null}
            {state.phase === 'asking' ? (
              <div className="text-[13px] animate-pulse" style={{ color: 'var(--text-2)' }}>{voice === 'thinking' ? 'thinking…' : 'checking the receipts…'}</div>
            ) : null}
            {state.phase === 'answered' ? (
              <>
                <div className="text-[15px] sm:text-[17px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-1)' }}>{state.answer}</div>
                <div data-answer-tag={state.tone} className="mt-2.5 text-[11px] leading-[16px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: state.tone === 'warn' ? 'var(--red)' : state.tone === 'general' ? 'var(--accent)' : 'var(--text-3)' }}>
                  {state.tag}{state.model ? ` · ${state.model}` : ''}
                </div>
                <div className="mt-1 text-[11px] leading-[16px]" style={{ color: 'var(--text-3)' }}>
                  {citationLine(state.halfLabel, state.citations)}
                </div>
                {state.howTo ? <div data-needs-model className="mt-2 text-[12.5px] leading-[19px]" style={{ color: 'var(--text-2)' }}>{state.howTo}</div> : null}
              </>
            ) : null}
            {state.phase === 'refused' ? (
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                <span className="text-[11px] uppercase tracking-[0.08em] mr-2" style={{ fontWeight: 600, color: 'var(--red)' }}>{state.code}</span>
                {state.human}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pb-4 pt-8 px-4" style={{ background: 'linear-gradient(to top, var(--bg-0) 30%, transparent)' }}>
        <div className="flex flex-wrap justify-center gap-2 mb-3 transition-opacity duration-300" style={{ opacity: chipsVisible ? 1 : 0, pointerEvents: chipsVisible ? 'auto' : 'none' }}>
          {EXAMPLE_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              type="button"
              tabIndex={chipsVisible ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void ask(q)}
              className="text-[12px] h-[30px] px-3 rounded-full transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ fontWeight: 500, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <form onSubmit={onSubmit} className="pointer-events-auto flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }}>
            <label htmlFor="ask-arc-dock" className="sr-only">Ask arc a question</label>
            <input
              id="ask-arc-dock"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => { window.clearTimeout(blurTimer.current); setFocused(true) }}
              onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 200) }}
              placeholder={state.phase === 'asking' ? 'checking the receipts…' : 'ask the company anything'}
              className="bg-transparent outline-none text-[13.5px] w-[200px] sm:w-[320px] px-1 placeholder:text-(--text-3)"
              style={{ color: 'var(--text-1)' }}
            />
            {micShown ? (
              <button
                type="button"
                data-voice-mic={voice}
                aria-label={voice === 'listening' ? 'Stop listening' : voice === 'speaking' ? 'Stop speaking' : 'Ask by voice'}
                aria-pressed={voice !== 'idle'}
                onClick={press}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                style={{ border: `1px solid ${voice === 'idle' ? 'var(--line-2)' : 'var(--accent)'}`, color: voice === 'idle' ? 'var(--text-2)' : 'var(--accent)' }}
              >
                <Microphone size={15} aria-hidden="true" className={voice === 'listening' ? 'animate-pulse' : ''} />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Ask arc"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{ border: '1px solid var(--line-2)', color: 'var(--text-2)' }}
            >
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
