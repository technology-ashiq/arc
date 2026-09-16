// The front door — the face at full presence, then ENTER HQ.
import { useEffect, useState } from 'react'
import { subscribe } from '../lib/voice.js'
import { FONT, MONO, StatusDot, Btn } from '../ui/kit.jsx'
import { uiBus } from '../lib/uiBus.js'

export default function Landing() {
  const [convo, setConvo] = useState(false)
  useEffect(() => subscribe((v) => setConvo(!!(v.started && (v.state !== 'idle' || v.reply || v.transcript)))), [])

  return (
    <section className="relative w-full h-screen overflow-hidden" style={{ fontFamily: FONT }}>
      <div className="h-16" />
      <div
        className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 lg:px-12 pb-52 sm:pb-44 pt-12 transition-opacity duration-500 bg-gradient-to-t from-black/85 via-black/40 to-transparent md:bg-none"
        style={{ opacity: convo ? 0.06 : 1 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-end w-full max-w-[1180px] mx-auto">
          <div>
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#00ffd1]/85 mb-5" style={{ fontFamily: MONO }}>
              a receipt-driven company operating system
            </div>
            <h1 className="text-[44px] sm:text-[72px] md:text-[88px] leading-[0.98] tracking-tight text-white whitespace-pre-line mb-8" style={{ fontWeight: 600 }}>
              Speak To{'\n'}The Company.
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Btn tone="primary" onClick={() => uiBus.enterHQ()} className="!min-h-[52px] !px-8 !text-[12.5px]">
                enter hq →
              </Btn>
              <Btn
                onClick={() => {
                  uiBus.enterHQ()
                  uiBus.openRoom('story')
                }}
                className="!min-h-[52px] !px-6"
              >
                read the story
              </Btn>
            </div>
          </div>

          <div className="max-w-sm md:pb-2">
            <p className="text-[14px] leading-[24px] text-white/78" style={{ fontWeight: 300 }}>
              This face is the company's voice — give it an engine key and it thinks with a real model, sees the live
              state, and can run the HQ for you. Inside: the spine, the inbox, the council, the money — everything as
              events, nothing static.
            </p>
            <div className="flex flex-wrap gap-2 mt-5" style={{ fontFamily: MONO }}>
              {[
                ['live', 'receipt spine · in-app'],
                ['building', 'cycle 3 · the designer'],
                ['ok', '389 tests · 3-OS CI'],
                ['live', 'venture #1 · LexOS'],
              ].map(([state, label]) => (
                <span key={label} className="inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.16em] text-white/72 border border-white/14 rounded-full px-3 py-[7px]" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <StatusDot state={state} />
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.26em] text-white/45" style={{ fontFamily: MONO }}>
              v0.4.0 · owner: Ashiq · concept — simulated data labeled
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
