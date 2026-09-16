// 01 · THE SPINE — the full log: filters, receipt drawers, the
// eight laws, and the real-spine connection status.
import { useMemo, useState } from 'react'
import { Pulse } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, SimBadge, PickRow } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, Empty, EventRow, ReceiptDrawer } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { FAMILY, familyKey } from '../../spine/kinds.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'

const FAM_OPTIONS = [{ value: 'all', label: 'all kinds' }, ...Object.keys(FAMILY).map((k) => ({ value: k, label: FAMILY[k].label }))]

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
        hint="Append-only, canonical JSONL, a closed 18-kind vocabulary. Corrections supersede, never edit."
        right={<SimBadge>{spine.source === 'real' ? `real spine · ${spine.realMeta?.count ?? 0} events` : 'simulated feed · real vocabulary'}</SimBadge>}
      />

      {/* the instrument strip — the log by the numbers */}
      <KpiStrip
        items={[
          { v: rows.length, l: 'Events shown', sub: 'newest first, under this filter' },
          { v: source.length, l: 'Events on the spine', sub: spine.source === 'real' ? 'your real spine, read-only' : 'simulated feed, every day' },
          { v: Object.keys(FAMILY).length, l: 'Kind families', sub: 'closed vocabulary' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="The log"
            hint="newest first · ⌗ opens the receipt"
            actions={spine.source !== 'real' ? <PickRow small options={['today', 'history']} value={day} onPick={setDay} /> : undefined}
          >
            <div className="mb-3">
              <PickRow small options={FAM_OPTIONS} value={fam} onPick={setFam} />
            </div>
            <div className="max-h-[560px] overflow-y-auto -mx-2" style={{ scrollbarWidth: 'thin' }}>
              {rows.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
              {rows.length === 0 && <Empty icon={Pulse} title="No events under this filter yet" hint="Widen the filter, or press play and let the day run. Every line that lands here is a receipt." />}
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
              <SectionLabel>Legend</SectionLabel>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(FAMILY).map(([k, f]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                    <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full" style={{ background: f.color }} /> {f.label}
                  </span>
                ))}
              </div>
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The eight spine laws" hint="each one a written decision">
            <div className="grid grid-cols-1 gap-2">
              {ARC.spine.laws.map((law) => (
                <div key={law.adr} className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: COLOR.cyan }}>{law.adr}</span>
                    <span className="text-[13px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{law.name}</span>
                  </div>
                  <div className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{law.what}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Integrity" hint="mechanics, not promises">
            <div className="space-y-2.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Replay determinism</b> — delete every derived view, replay the log, byte-identical state. CI proves it on the real spine.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Quarantine</b> — invalid events never block work in hook mode; they quarantine and surface. Today: 0 quarantined.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Redaction</b> — fail-safe, stub-only: no field names, values, or lengths ever leak. 25 adversarial holes found and pinned before launch.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Revenue truth</b> — revenue.received is real-only; the sim feed uses revenue.simulated. The P&L cannot be polluted by wishes.</div>
            </div>
          </HPanel>

          <HPanel title="Data source" hint="views rebuild from either · A5" actions={<Btn small onClick={() => uiBus.openRoom('engine')}>Engine room →</Btn>}>
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {spine.source === 'real'
                ? `Reading YOUR real spine (read-only): ${spine.realMeta?.files?.length || 0} day-files, ${spine.realMeta?.count || 0} events.`
                : 'Currently rendering the simulated feed. Connect your real arc spine (read-only) from the Engine room — set ARC_SPINE_DIR in .env.local and run the dev server.'}
            </p>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
