// 01 · THE SPINE — the full log: filters, receipt drawers, the
// eight laws, and the real-spine connection status.
import { useMemo, useState } from 'react'
import { MONO, COLOR, Btn, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel, EventRow, ReceiptDrawer } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { FAMILY, familyKey } from '../../spine/kinds.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'

export default function SpineRoom() {
  useSpine()
  const [fam, setFam] = useState('all')
  const [day, setDay] = useState('today')
  const [receipt, setReceipt] = useState(null)

  const source = spine.source === 'real' && spine.realEvents ? spine.realEvents : spine.events
  const rows = useMemo(() => {
    let r = source
    if (spine.source !== 'real') {
      r = day === 'today' ? r.filter((e) => e.day === spine.dayIndex) : r.filter((e) => e.day !== spine.dayIndex)
    }
    if (fam !== 'all') r = r.filter((e) => familyKey(e.kind) === fam)
    return r.slice(-160).reverse()
  }, [source, fam, day, spine.events.length])

  return (
    <>
      <RoomHead
        title="If it isn't an event, it didn't happen."
        hint="append-only · canonical JSONL · closed 18-kind vocabulary · corrections supersede"
        right={<SimBadge>{spine.source === 'real' ? `real spine · ${spine.realMeta?.count ?? 0} events` : 'simulated feed · real vocabulary'}</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 items-start">
        <div>
          {/* filters */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3" style={{ fontFamily: MONO }}>
            {['all', ...Object.keys(FAMILY)].map((f) => (
              <button key={f} onClick={() => setFam(f)} className="min-h-[32px] rounded-full px-3 text-[9.5px] uppercase tracking-[0.14em] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ background: fam === f ? 'rgba(0,255,209,0.14)' : 'rgba(255,255,255,0.05)', color: fam === f ? COLOR.cyan : 'rgba(255,255,255,0.6)', border: `1px solid ${fam === f ? 'rgba(0,255,209,0.45)' : 'rgba(255,255,255,0.12)'}` }}>
                {f === 'all' ? 'all kinds' : FAMILY[f].label}
              </button>
            ))}
            {spine.source !== 'real' && (
              <span className="ml-auto flex gap-1.5">
                {['today', 'history'].map((d) => (
                  <button key={d} onClick={() => setDay(d)} className="min-h-[32px] rounded-full px-3 text-[9.5px] uppercase tracking-[0.14em] cursor-pointer" style={{ background: day === d ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: day === d ? '#fff' : 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {d}
                  </button>
                ))}
              </span>
            )}
          </div>

          <HPanel title={`the log — ${rows.length} events shown, newest first`} hint="click ⌗ for the receipt">
            <div className="max-h-[560px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {rows.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
              {rows.length === 0 && <div className="py-8 text-center text-[12px] text-white/45">No events under this filter yet.</div>}
            </div>
            {/* legend */}
            <div className="border-t border-white/8 mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1.5" style={{ fontFamily: MONO }}>
              <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">legend</span>
              {Object.entries(FAMILY).map(([k, f]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[9.5px] text-white/62">
                  <span className="w-[6px] h-[6px] rounded-full" style={{ background: f.color }} /> {f.label}
                </span>
              ))}
            </div>
          </HPanel>
        </div>

        <div>
          <HPanel title="the eight spine laws" hint="each one a written decision">
            <div className="grid grid-cols-1 gap-2">
              {ARC.spine.laws.map((law) => (
                <div key={law.adr} className="rounded-lg border border-white/9 p-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[9px]" style={{ fontFamily: MONO, color: COLOR.cyan }}>{law.adr}</span>
                    <span className="text-[12px] text-white/90" style={{ fontWeight: 600 }}>{law.name}</span>
                  </div>
                  <div className="text-[10.5px] leading-[16px] text-white/55" style={{ fontWeight: 300 }}>{law.what}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="integrity" hint="mechanics, not promises">
            <div className="space-y-2 text-[11px] leading-[17px] text-white/68" style={{ fontWeight: 300 }}>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Replay determinism</b> — delete every derived view, replay the log, byte-identical state. CI proves it on the real spine.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Quarantine</b> — invalid events never block work in hook mode; they quarantine and surface. Today: 0 quarantined.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Redaction</b> — fail-safe, stub-only: no field names, values, or lengths ever leak. 25 adversarial holes found and pinned before launch.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Revenue truth</b> — revenue.received is real-only; the sim feed uses revenue.simulated. The P&L cannot be polluted by wishes.</div>
            </div>
          </HPanel>

          <HPanel title="data source" hint="views rebuild from either — A5" tone="cyan">
            <div className="text-[11.5px] leading-[18px] text-white/70 mb-3" style={{ fontWeight: 300 }}>
              {spine.source === 'real'
                ? `Reading YOUR real spine (read-only): ${spine.realMeta?.files?.length || 0} day-files, ${spine.realMeta?.count || 0} events.`
                : 'Currently rendering the simulated feed. Connect your real arc spine (read-only) from the Engine room — set ARC_SPINE_DIR in .env.local and run the dev server.'}
            </div>
            <Btn small onClick={() => uiBus.openRoom('engine')}>engine room →</Btn>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
