// SECTION 2 — PRODUCTS. My design: concept-matched dark/cyan system,
// six product cards straight from products/*/manifest.json knowledge.
import { ARC } from '../data/arcKnowledge.js'

const FONT = "'Anybody', sans-serif"
const MONO = "'JetBrains Mono', monospace"

export default function S2_Products() {
  return (
    <section id="products" className="relative w-full bg-[#000] text-white overflow-hidden" style={{ fontFamily: FONT }}>
      {/* faint separation line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/25 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div className="text-[11px] uppercase tracking-[0.32em] text-[#00ffd1]/70 mb-5">01 · the portfolio</div>
        <h2
          className="text-[38px] sm:text-[64px] md:text-[84px] leading-[1.02] tracking-tight mb-6"
          style={{ fontWeight: 600, textTransform: 'capitalize' }}
        >
          Six Products.
          <br />
          One Discipline.
        </h2>
        <p className="max-w-xl text-white/60 text-[15px] leading-[26px] mb-16" style={{ fontWeight: 300 }}>
          Each product installs on its own. Core is the only must-have — the deterministic layer that cannot forget.
          Everything else is opt-in muscle.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARC.products.map((p, i) => (
            <div
              key={p.id}
              className="group relative border border-white/10 rounded-xl p-6 bg-white/[0.02] hover:border-[#00ffd1]/50 hover:bg-[#00ffd1]/[0.03] transition-all duration-300"
            >
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[11px] text-white/30" style={{ fontFamily: MONO }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {p.status && (
                  <span className="text-[9px] uppercase tracking-[0.18em] text-[#00ffd1]/70 border border-[#00ffd1]/25 rounded-full px-2 py-[3px] whitespace-nowrap">
                    {p.status.split(/[,(]/)[0].trim().slice(0, 16)}
                  </span>
                )}
              </div>
              <h3
                className="text-[26px] mb-3 tracking-tight group-hover:text-[#00ffd1] transition-colors"
                style={{ fontWeight: 600, textTransform: 'lowercase' }}
              >
                {p.id}
                <span className="text-[#00ffd1]">.</span>
              </h3>
              <p className="text-white/55 text-[13px] leading-[21px] mb-5" style={{ fontWeight: 300 }}>
                {p.purpose}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(p.pieces || []).slice(0, 4).map((piece) => (
                  <span
                    key={piece}
                    className="text-[10px] text-white/40 border border-white/10 rounded px-2 py-[3px] group-hover:border-white/20 transition-colors"
                    style={{ fontFamily: MONO }}
                  >
                    {piece}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
