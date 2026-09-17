// SECTION 3 — COMMANDS. My design: a terminal wall listing all 22 real
// slash commands from .claude/commands/, monospace, scanline feel.
import { useState } from 'react'
import { ARC } from '../data/arcKnowledge.js'

const FONT = "'Anybody', sans-serif"
const MONO = "'JetBrains Mono', monospace"

export default function S3_Commands() {
  const [active, setActive] = useState(ARC.commands.find((c) => c.name === '/arc-kickoff') || ARC.commands[0])

  return (
    <section id="commands" className="relative w-full bg-[#000] text-white" style={{ fontFamily: FONT }}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/25 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
          {/* left: heading + detail panel */}
          <div className="lg:sticky lg:top-16">
            <div className="text-[11px] uppercase tracking-[0.32em] text-[#00ffd1]/70 mb-5">02 · the keyboard</div>
            <h2
              className="text-[38px] sm:text-[58px] md:text-[72px] leading-[1.02] tracking-tight mb-6"
              style={{ fontWeight: 600, textTransform: 'capitalize' }}
            >
              Twenty-Two
              <br />
              Commands.
            </h2>
            <p className="max-w-md text-white/60 text-[15px] leading-[26px] mb-10" style={{ fontWeight: 300 }}>
              Every ritual of the factory is one slash command away. Hover the wall — the terminal explains itself.
            </p>

            {/* detail terminal */}
            <div className="border border-white/12 rounded-xl overflow-hidden bg-[#050807]">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ffd1]/50" />
                <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-white/30" style={{ fontFamily: MONO }}>
                  arc · command detail
                </span>
              </div>
              <div className="p-5" style={{ fontFamily: MONO }}>
                <div className="text-[15px] text-[#00ffd1] mb-2">
                  <span className="text-white/30">$ </span>
                  {active.name}
                </div>
                <div className="text-[12px] text-white/80 mb-3">{active.short}</div>
                <p className="text-[11.5px] leading-[19px] text-white/45">{active.detail}</p>
                {active.product && (
                  <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/30">
                    owned by <span className="text-[#00ffd1]/70">{active.product}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* right: the wall */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" style={{ fontFamily: MONO }}>
            {ARC.commands.map((c) => (
              <button
                key={c.name}
                onMouseEnter={() => setActive(c)}
                onFocus={() => setActive(c)}
                onClick={() => setActive(c)}
                className={`text-left border rounded-lg px-4 py-3 transition-all duration-200 cursor-pointer ${
                  active.name === c.name
                    ? 'border-[#00ffd1]/60 bg-[#00ffd1]/[0.05]'
                    : 'border-white/8 bg-white/[0.015] hover:border-white/25'
                }`}
              >
                <div className={`text-[13px] mb-1 ${active.name === c.name ? 'text-[#00ffd1]' : 'text-white/85'}`}>
                  {c.name}
                </div>
                <div className="text-[10.5px] text-white/35 leading-snug">{c.short}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
