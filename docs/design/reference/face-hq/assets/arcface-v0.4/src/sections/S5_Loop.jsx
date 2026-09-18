// SECTION 5 — THE LOOP. My design: the pipeline as a receipt tape,
// plus the gates and the L0–L4 autonomy ladder.
import { ARC } from '../data/arcKnowledge.js'

const FONT = "'Anybody', sans-serif"
const MONO = "'JetBrains Mono', monospace"

export default function S5_Loop() {
  return (
    <section id="loop" className="relative w-full bg-[#000] text-white" style={{ fontFamily: FONT }}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/25 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div className="text-[11px] uppercase tracking-[0.32em] text-[#00ffd1]/70 mb-5">04 · the loop</div>
        <h2
          className="text-[38px] sm:text-[58px] md:text-[72px] leading-[1.02] tracking-tight mb-6"
          style={{ fontWeight: 600, textTransform: 'capitalize' }}
        >
          Idea To Shipped,
          <br />
          With Receipts.
        </h2>
        <p className="max-w-xl text-white/60 text-[15px] leading-[26px] mb-16" style={{ fontWeight: 300 }}>
          {ARC.pipeline.summary}
        </p>

        {/* pipeline tape */}
        <div className="relative mb-24 -mx-6 sm:mx-0">
          <div className="overflow-x-auto pb-4 px-6 sm:px-0" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex gap-0 min-w-max items-stretch">
              {ARC.pipeline.stages.map((s, i) => (
                <div key={s.name} className="flex items-stretch">
                  <div className="w-[190px] border border-white/10 rounded-lg p-4 bg-white/[0.02] hover:border-[#00ffd1]/40 transition-colors">
                    <div className="text-[10px] text-white/30 mb-2" style={{ fontFamily: MONO }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-[14px] mb-1.5 text-white/90" style={{ fontWeight: 600 }}>
                      {s.name}
                    </div>
                    <div className="text-[11px] text-white/40 leading-snug" style={{ fontWeight: 300 }}>
                      {s.what}
                    </div>
                  </div>
                  {i < ARC.pipeline.stages.length - 1 && (
                    <div className="flex items-center px-1.5">
                      <span className="text-[#00ffd1]/50 text-[12px]">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
          {/* gates */}
          <div className="border border-white/10 rounded-xl p-7 bg-white/[0.02]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ffd1]/70 mb-4">block-by-default gates</div>
            <p className="text-white/60 text-[13.5px] leading-[23px] mb-6" style={{ fontWeight: 300 }}>
              {ARC.gates.summary}
            </p>
            <div className="flex flex-wrap gap-2" style={{ fontFamily: MONO }}>
              {['tests', 'coverage', 'docs-drift', 'scans', 'review-stamp'].map((g) => (
                <span key={g} className="text-[10.5px] text-white/50 border border-white/12 rounded px-2.5 py-1">
                  {g} <span className="text-[#00ffd1]">✓</span>
                </span>
              ))}
            </div>
          </div>

          {/* autonomy ladder */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ffd1]/70 mb-4">the autonomy ladder</div>
            <p className="text-white/60 text-[13.5px] leading-[23px] mb-6" style={{ fontWeight: 300 }}>
              {ARC.autonomy.summary}
            </p>
            <div className="space-y-2.5">
              {ARC.autonomy.levels.map((l, i) => (
                <div key={l.level} className="flex items-center gap-3">
                  <span
                    className="text-[11px] w-8 h-6 rounded flex items-center justify-center shrink-0"
                    style={{
                      fontFamily: MONO,
                      fontWeight: 700,
                      background: `rgba(0,255,209,${0.05 + i * 0.09})`,
                      color: i >= 3 ? '#001a14' : '#00ffd1',
                    }}
                  >
                    {l.level}
                  </span>
                  <div className="h-1 rounded-full bg-[#00ffd1]" style={{ width: `${8 + i * 12}%`, opacity: 0.25 + i * 0.18 }} />
                  <span className="text-[11.5px] text-white/45 leading-tight" style={{ fontWeight: 300 }}>
                    {l.meaning}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
