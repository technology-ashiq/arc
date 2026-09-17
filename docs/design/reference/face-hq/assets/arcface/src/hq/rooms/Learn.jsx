// 07 · LEARN — retro rules with recall search, juror calibration,
// evolve (champion/challenger) and the sleeping-queue triggers.
import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { MONO, COLOR, SimBadge, StatusDot, TextInput, Meter } from '../../ui/kit.jsx'
import { RoomHead, HPanel, SectionLabel, Empty, EventRow, ReceiptDrawer } from '../bits.jsx'
import { calibration } from '../../spine/derive.js'
import { spine } from '../../spine/store.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

export default function Learn() {
  useSpine()
  const cal = calibration()
  const [q, setQ] = useState('')
  const [receipt, setReceipt] = useState(null)
  const retros = spine.events.filter((e) => e.kind === 'retro.completed').slice(-5).reverse()

  const rules = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return cal.rules
    return cal.rules.filter((r) => (r.id + ' ' + r.text).toLowerCase().includes(n))
  }, [q, cal.rules])

  return (
    <>
      <RoomHead
        title="Correct it twice, it becomes impossible."
        hint="retro turns repeated corrections into permanent upgrades; evolve generalizes it into scoreboards and experiments"
        right={<SimBadge>calibration numbers simulated · real ledger holds 0 scored</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Playbook rules" hint="the company's memory · recall search, the memory module's job, previewed">
            <div className="mb-3">
              <TextInput value={q} onChange={setQ} placeholder="recall: distribution, titles, outreach…" />
            </div>
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="px-3 py-2.5 text-[13px] leading-[20px] break-words" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', color: 'var(--text-2)' }}>
                  <span className="mr-1.5" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.id}</span>
                  {r.text}
                </div>
              ))}
              {rules.length === 0 && <Empty icon={MagnifyingGlass} title="No rule matches" hint="the memory module answers honestly" />}
            </div>
            <div className="mt-3 text-[12px] leading-[18px]" style={{ color: 'var(--text-3)' }}>
              memory module sleeps until recall pain is real (finding a lesson &gt; 2 min). Then: playbooks + full-text search for every process.
            </div>
          </HPanel>

          <HPanel title="Evolve" hint="the generalized retro · sleeping, wakes at 4+ weeks of real metrics">
            <div className="p-3.5 mb-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="text-[13px]" style={{ fontWeight: 600, color: 'var(--text-1)' }}>experiment preview — video titles</span>
                <SimBadge>champion / challenger</SimBadge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2.5 min-w-0" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <SectionLabel className="!mb-1">champion</SectionLabel>
                  <div className="text-[13px] tnum" style={{ color: 'var(--text-2)' }}>plain titles · CTR 3.1%</div>
                </div>
                <div className="p-2.5 min-w-0" style={{ background: 'var(--bg-2)', border: `1px solid ${COLOR.green}`, borderRadius: 'var(--r-sm)' }}>
                  <div className="text-[11px] uppercase tracking-[0.08em] mb-1" style={{ fontWeight: 600, color: COLOR.green }}>challenger — winning</div>
                  <div className="text-[13px] tnum" style={{ color: 'var(--text-1)' }}>
                    number-in-title · CTR 4.3% <span style={{ fontWeight: 600, color: COLOR.green }}>+38%</span>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-[12px] leading-[18px]" style={{ color: 'var(--text-3)' }}>
                sample floor met · holdout kept · winner lands as a reviewed diff to the canonical process file — propose-only, never self-merged (A6). Loser archived with data.
              </div>
            </div>
            <div className="text-[13px] leading-[20px]" style={{ color: 'var(--text-2)' }}>
              The loop for every module: measure (spine events) → scoreboard weekly → bounded experiments → promote via diff + owner OK → pin failures as eval fixtures. CI for prompts.
            </div>
          </HPanel>

          {retros.length > 0 && (
            <HPanel title="Retros today" hint="retro.completed · the improvement loop, on the record">
              <div className="-mx-2">
                {retros.map((e) => (
                  <EventRow key={e.id} e={e} onReceipt={setReceipt} />
                ))}
              </div>
            </HPanel>
          )}
        </div>

        <div className="min-w-0">
          <HPanel title="Juror calibration" hint="Brier-scored, weight-adjusted">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className="text-left pb-2 text-[11px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>juror</th>
                  <th className="text-right pb-2 text-[11px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>hit</th>
                  <th className="pb-2 w-[86px]" aria-label="hit rate" />
                  <th className="text-right pb-2 text-[11px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>weight</th>
                </tr>
              </thead>
              <tbody>
                {cal.jurors.map((j) => (
                  <tr key={j.name} className="transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <td className="py-2 pr-2" style={{ color: 'var(--text-1)' }}>{j.name}</td>
                    <td className="py-2 text-right tnum pr-3" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{j.hit}%</td>
                    <td className="py-2 w-[86px]"><Meter value={j.hit / 100} tone="violet" height={4} /></td>
                    <td className="py-2 text-right tnum pl-3" style={{ fontFamily: MONO, fontWeight: 600, color: j.wt.startsWith('−') ? COLOR.red : 'var(--text-1)' }}>{j.wt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-[12px] leading-[18px]" style={{ color: COLOR.violet }}>{cal.honest}</div>
          </HPanel>

          <HPanel title="The sleeping queue" hint="earn before build — A8. Every module has an alarm, not a deadline">
            <div className="max-h-[380px] overflow-y-auto -mx-2" style={{ scrollbarWidth: 'thin' }}>
              {ARC.vision.sleeping.map((s) => (
                <div key={s.id} className="grid grid-cols-[auto_86px_1fr] items-baseline gap-2.5 px-2 py-[6px] text-[12.5px] leading-[18px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <StatusDot state="sleeping" />
                  <span className="truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{s.id}</span>
                  <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{s.wakes}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
