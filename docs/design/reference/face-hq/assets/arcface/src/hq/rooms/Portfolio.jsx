// 04 · PORTFOLIO — idea → money pipeline, venture cards with
// kill-distance meters, and the honest portfolio rules.
import { MONO, COLOR, Meter, SimBadge, StatusDot } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { pipeline, portfolio } from '../../spine/derive.js'
import { useSpine } from '../useSpine.js'

export default function Portfolio() {
  useSpine()
  const pipe = pipeline()
  const folio = portfolio()

  return (
    <>
      <RoomHead
        title="The factory is not the product."
        hint="ventures live in their own repos, own money, own kill criteria — arc synced inside. The venture track wins every tie."
        right={<SimBadge>mixed: real repo facts + simulated projections, labeled per card</SimBadge>}
      />

      {/* pipeline — the factory floor, live */}
      <HPanel title="pipeline — idea → money" hint="counts derive from today's events" tone="cyan">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
          {pipe.map((s, i) => (
            <div key={s.name} className="rounded-lg border border-white/10 p-3 min-h-[86px]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/45 mb-1" style={{ fontFamily: MONO }}>{i + 1} · {s.name}</div>
              <div className="text-[22px] tracking-tight text-white" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.n}</div>
              <div className="text-[9.5px] text-white/50 mt-0.5 leading-[13px]" style={{ fontFamily: MONO }}>{s.note}</div>
            </div>
          ))}
        </div>
      </HPanel>

      {/* venture cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
        {folio.map((v) => (
          <div key={v.id} className="rounded-xl border p-4" style={{ background: 'rgba(4,9,8,0.8)', borderColor: v.tone === 'critical' ? 'rgba(255,107,107,0.4)' : v.real ? 'rgba(0,255,209,0.25)' : 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-2.5 mb-2">
              <StatusDot state={v.tone === 'critical' ? 'sleeping' : v.real ? 'live' : 'building'} />
              <b className="text-[14px] text-white/92" style={{ fontWeight: 600 }}>{v.name}</b>
              <span className="ml-auto text-[8.5px] uppercase tracking-[0.12em] text-white/45 border border-white/12 rounded px-1.5 py-[2px]" style={{ fontFamily: MONO }}>{v.stage}</span>
            </div>
            <div className="text-[20px] tracking-tight mb-0.5" style={{ fontWeight: 700, color: v.tone === 'critical' ? COLOR.red : '#fff', fontVariantNumeric: 'tabular-nums' }}>{v.big}</div>
            <div className="text-[10.5px] text-white/55 mb-3" style={{ fontFamily: MONO }}>{v.sub}</div>
            <Meter value={v.meter} tone={v.tone} />
            <div className="mt-2 text-[10.5px] leading-[15px] text-white/58" style={{ fontWeight: 300 }}>
              <span style={{ color: v.tone === 'critical' ? COLOR.red : v.tone === 'warn' ? COLOR.amber : COLOR.green }}>●</span> {v.note}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HPanel title="1 in 4" hint="the base rate, planned for">
          <p className="text-[11.5px] leading-[17px] text-white/62" style={{ fontWeight: 300 }}>
            One in four ventures is expected to live — written before the first launch, so a death is a data point, not a surprise. Kill-distance meters exist because the criteria were set at kickoff, in writing.
          </p>
        </HPanel>
        <HPanel title="ship WITH distribution">
          <p className="text-[11.5px] leading-[17px] text-white/62" style={{ fontWeight: 300 }}>
            A venture without a distribution plan does not ship. Launch week is a written playbook — one channel per day, personal, honest. Growth wakes as a module only when a live venture pulls it.
          </p>
        </HPanel>
        <HPanel title="kill honestly" hint="constitution A10">
          <p className="text-[11.5px] leading-[17px] text-white/62" style={{ fontWeight: 300 }}>
            Fail the written criteria → attic'd with a retro, components harvested, the lesson pinned. Never deleted. The PromptVault card above is the kill flow demo — its decision card lands in the inbox.
          </p>
        </HPanel>
      </div>
    </>
  )
}
