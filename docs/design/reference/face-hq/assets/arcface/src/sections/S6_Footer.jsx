// SECTION 6 — RECEIPTS / FOOTER. My design: the vision, the numbers,
// the closing quote from the strategy docs.
import { ARC } from '../data/arcKnowledge.js'

const FONT = "'Anybody', sans-serif"
const MONO = "'JetBrains Mono', monospace"

export default function S6_Footer() {
  return (
    <section id="receipts" className="relative w-full bg-[#000] text-white overflow-hidden" style={{ fontFamily: FONT }}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/25 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div className="text-[11px] uppercase tracking-[0.32em] text-[#00ffd1]/70 mb-5">05 · where this goes</div>

        <blockquote
          className="text-[26px] sm:text-[42px] md:text-[54px] leading-[1.12] tracking-tight max-w-4xl mb-8"
          style={{ fontWeight: 600, textTransform: 'none' }}
        >
          “The race is not <span className="text-[#00ffd1]">who has AI</span> — it's whose AI has been{' '}
          <span className="text-[#00ffd1]">keeping receipts</span> the longest.”
        </blockquote>
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/30 mb-20" style={{ fontFamily: MONO }}>
          — arc money-engine plan · "if it isn't an event, it didn't happen"
        </div>

        {/* vision cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {[
            ['Arc HQ', ARC.vision.hq],
            ['The money engine', ARC.vision.money],
            ['The roadmap', ARC.vision.roadmap],
          ].map(([title, body]) => (
            <div key={title} className="border border-white/10 rounded-xl p-6 bg-white/[0.02]">
              <div className="text-[13px] text-[#00ffd1] mb-3" style={{ fontWeight: 600 }}>
                {title}
              </div>
              <p className="text-[12.5px] text-white/50 leading-[21px]" style={{ fontWeight: 300 }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        {/* stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden mb-20 border border-white/10">
          {[
            ['06', 'products'],
            ['22', 'commands'],
            ['23', 'agents'],
            ['247', 'tests green · 3-OS CI'],
          ].map(([n, label]) => (
            <div key={label} className="bg-[#000] p-6 text-center">
              <div className="text-[34px] text-[#00ffd1] tracking-tight" style={{ fontWeight: 600, fontFamily: MONO }}>
                {n}
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* footer meta */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-8 border-t border-white/8">
          <div>
            <div className="text-[22px] tracking-tight" style={{ fontWeight: 600 }}>
              Arc<span className="text-[#00ffd1]">.</span>
            </div>
            <div className="text-[11px] text-white/35 mt-1" style={{ fontWeight: 300 }}>
              {ARC.identity.tagline} · v0.2.0 · built by Ashiq
            </div>
          </div>
          <div className="text-[10px] text-white/25 leading-relaxed sm:text-right" style={{ fontFamily: MONO }}>
            front-of-house design concept · face module ported from the
            <br className="hidden sm:block" /> "Human Synthesis" concept · voice runs fully in-browser · not in repo
          </div>
        </div>
      </div>
    </section>
  )
}
