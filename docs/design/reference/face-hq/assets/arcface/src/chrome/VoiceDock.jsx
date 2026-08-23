// The voice dock — arc's mouth and ears, persistent across landing
// and every HQ room. Mic + typed ask + streaming captions, with
// suggestion chips that follow where you are. Engine badge shows
// which brain answered (offline matcher vs the configured model).
import { useEffect, useRef, useState } from 'react'
import { bus, subscribe, listen, ask } from '../lib/voice.js'
import { FONT, MONO } from '../ui/kit.jsx'
import { uiBus } from '../lib/uiBus.js'
import { useSpine } from '../hq/useSpine.js'
import { engineReady, loadEngine } from '../brain/llm.js'

const CHIPS = {
  landing: ['What is arc?', 'What needs me today?'],
  overview: ['What needs me today?', 'Approve the first one', 'Read me the brief'],
  spine: ['What is the spine?', 'What happened in the last hour?'],
  factory: ['How does a phase close?', 'What does /arc-kickoff do?'],
  council: ['Run the council on billing', 'What happened in session 001?'],
  portfolio: ['Tell me about LexOS', 'What is the portfolio math?'],
  autonomy: ['What stays human forever?', 'How does promotion work?'],
  money: ['How much did we make today?', 'When is the first real rupee?'],
  learn: ['What did the company learn?', 'What is evolve?'],
  law: ['What is the truth law?', 'How is the constitution amended?'],
  story: ['Tell me your story', 'What are the five laws?'],
  engine: ['Which brain are you using?', 'What can you do with a real brain?'],
}

let _focusAsk = null
export function focusAsk() {
  if (_focusAsk) _focusAsk()
}

export default function VoiceDock() {
  useSpine()
  const [voice, setVoice] = useState({ ...bus })
  const [typed, setTyped] = useState('')
  const [focused, setFocused] = useState(false)
  const blurTimer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => subscribe((v) => setVoice(v)), [])
  useEffect(() => {
    _focusAsk = () => inputRef.current?.focus()
    return () => {
      _focusAsk = null
    }
  }, [])

  const onFocus = () => {
    clearTimeout(blurTimer.current)
    setFocused(true)
  }
  const onBlur = () => {
    blurTimer.current = setTimeout(() => setFocused(false), 300)
  }

  const submitTyped = (e) => {
    e.preventDefault()
    if (typed.trim()) {
      ask(typed.trim())
      setTyped('')
    }
  }

  const context = uiBus.mode === 'landing' ? 'landing' : uiBus.room || 'overview'
  const conversationActive = voice.started && (voice.state !== 'idle' || voice.reply || voice.transcript)
  const stateLabel =
    voice.state === 'listening' ? 'listening…' : voice.state === 'thinking' ? 'thinking…' : voice.state === 'speaking' ? 'speaking' : 'ask the company anything'
  const chips = CHIPS[context] || CHIPS.landing
  const chipsVisible = voice.state === 'idle' && (context === 'landing' || focused)
  const eng = engineReady() ? loadEngine() : null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" style={{ fontFamily: FONT }}>
      {conversationActive && (
        <div className="flex justify-center px-5 mb-3">
          <div className="max-w-2xl w-full text-center rounded-2xl px-6 py-4 border border-white/10" style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            {voice.transcript && (
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/55 mb-2.5" style={{ fontFamily: MONO }}>
                you — {voice.transcript}
              </div>
            )}
            {voice.reply && (
              <div className={`text-[15px] sm:text-[18px] md:text-[20px] leading-relaxed text-white transition-opacity duration-300 ${voice.state === 'speaking' ? 'opacity-100' : 'opacity-85'}`} style={{ fontWeight: 300 }}>
                {voice.reply}
              </div>
            )}
            {voice.state === 'listening' && !voice.transcript && <div className="text-[14px] text-[#00ffd1] animate-pulse">I'm listening…</div>}
            {voice.state === 'thinking' && <div className="text-[13px] text-white/60 animate-pulse">{engineReady() ? 'thinking with the engine…' : 'checking the receipts…'}</div>}
          </div>
        </div>
      )}

      <div className="pb-4 pt-8 px-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
        <div className="flex flex-wrap justify-center gap-2 mb-3 transition-opacity duration-300" style={{ opacity: chipsVisible ? 1 : 0, pointerEvents: chipsVisible ? 'auto' : 'none' }}>
          {chips.map((c) => (
            <button key={c} onClick={() => ask(c)} className="text-[10px] sm:text-[10.5px] uppercase tracking-[0.12em] text-white/72 border border-white/16 rounded-full px-4 min-h-[38px] hover:text-[#00ffd1] hover:border-[#00ffd1]/60 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontFamily: MONO }}>
              {c}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full pl-2 pr-2 py-2 border border-white/14 shadow-[0_0_44px_rgba(0,255,209,0.10)]" style={{ background: 'rgba(0,0,0,0.66)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <button
              onClick={listen}
              aria-label={voice.state === 'listening' ? 'Stop listening' : 'Talk to arc'}
              className="relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1]"
              style={{
                background: voice.state === 'listening' ? 'rgba(0,255,209,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${voice.state === 'listening' ? '#00ffd1' : 'rgba(255,255,255,0.28)'}`,
                boxShadow: voice.state === 'listening' ? '0 0 24px rgba(0,255,209,0.45)' : 'none',
              }}
            >
              {voice.state === 'listening' && <span className="absolute inset-0 rounded-full border border-[#00ffd1]/60 animate-ping" />}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={voice.state === 'listening' ? '#00ffd1' : '#ffffff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </button>

            <form onSubmit={submitTyped} className="flex items-center gap-2">
              <label htmlFor="ask-arc" className="sr-only">Ask arc a question</label>
              <input id="ask-arc" ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder={stateLabel} className="bg-transparent outline-none text-white/90 placeholder-white/45 text-[13.5px] w-[170px] sm:w-[280px] px-1" style={{ fontFamily: FONT, fontWeight: 300 }} />
              <button type="submit" aria-label="Ask arc" className="w-11 h-11 rounded-full border border-white/22 flex items-center justify-center hover:border-[#00ffd1] hover:text-[#00ffd1] text-white/75 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        <div className="text-center mt-2.5 text-[9px] uppercase tracking-[0.24em]" style={{ fontFamily: MONO, color: eng ? 'rgba(74,222,128,0.75)' : 'rgba(255,255,255,0.4)' }}>
          {eng ? `engine: ${eng.provider} · ${eng.model} · key stays on this machine` : 'offline brain · add a key in the engine room for the full mind'}
        </div>
      </div>
    </div>
  )
}
