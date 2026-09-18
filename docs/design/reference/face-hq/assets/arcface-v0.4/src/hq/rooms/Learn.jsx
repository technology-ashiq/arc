// 07 · LEARN — retro rules with recall search, juror calibration,
// evolve (champion/challenger) and the sleeping-queue triggers.
import { useMemo, useState } from 'react'
import { MONO, COLOR, SimBadge, StatusDot } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { calibration } from '../../spine/derive.js'
import { spine } from '../../spine/store.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

export default function Learn() {
  useSpine()
  const cal = calibration()
  const [q, setQ] = useState('')
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
        <div>
          <HPanel title="playbook rules — the company's memory" hint="recall search — the memory module's job, previewed" tone="cyan">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="recall: distribution, titles, outreach…"
              className="w-full bg-transparent border border-white/14 rounded-lg px-3 min-h-[40px] text-[12px] text-white/85 placeholder-white/35 outline-none focus:border-[#00ffd1]/60 mb-3"
              style={{ fontFamily: MONO }}
            />
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="rounded-lg border border-white/9 px-3 py-2.5 text-[11.5px] leading-[17px] text-white/72" style={{ background: 'rgba(255,255,255,0.02)', fontWeight: 300 }}>
                  <b className="text-white/92" style={{ fontWeight: 600 }}>{r.id}:</b> {r.text}
                </div>
              ))}
              {rules.length === 0 && <div className="text-[11px] text-white/45 py-3 text-center">no rule matches — the memory module answers honestly</div>}
            </div>
            <div className="mt-3 text-[10px] text-white/45 leading-[15px]" style={{ fontWeight: 300 }}>
              memory module sleeps until recall pain is real (finding a lesson &gt; 2 min). Then: playbooks + full-text search for every process.
            </div>
          </HPanel>

          <HPanel title="evolve — the generalized retro" hint="sleeping · wakes at 4+ weeks of real metrics">
            <div className="rounded-lg border border-white/10 p-3.5 mb-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span className="text-[11px]" style={{ fontFamily: MONO, color: COLOR.cyan }}>experiment preview — video titles</span>
                <SimBadge>champion / challenger</SimBadge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]" style={{ fontFamily: MONO }}>
                <div className="rounded-md border border-white/10 p-2.5">
                  <div className="text-white/50 text-[9px] uppercase tracking-[0.14em] mb-1">champion</div>
                  <div className="text-white/80">plain titles · CTR 3.1%</div>
                </div>
                <div className="rounded-md border p-2.5" style={{ borderColor: 'rgba(74,222,128,0.4)' }}>
                  <div className="text-[9px] uppercase tracking-[0.14em] mb-1" style={{ color: COLOR.green }}>challenger — winning</div>
                  <div className="text-white/80">number-in-title · CTR 4.3% <span style={{ color: COLOR.green }}>+38%</span></div>
                </div>
              </div>
              <div className="mt-2.5 text-[10px] leading-[15px] text-white/55" style={{ fontWeight: 300 }}>
                sample floor met · holdout kept · winner lands as a reviewed diff to the canonical process file — propose-only, never self-merged (A6). Loser archived with data.
              </div>
            </div>
            <div className="text-[11px] leading-[16px] text-white/58" style={{ fontWeight: 300 }}>
              The loop for every module: measure (spine events) → scoreboard weekly → bounded experiments → promote via diff + owner OK → pin failures as eval fixtures. CI for prompts.
            </div>
          </HPanel>

          {retros.length > 0 && (
            <HPanel title="retro.completed — today" hint="the improvement loop, on the record">
              {retros.map((e) => (
                <div key={e.id} className="text-[11px] py-1.5 border-b border-white/6 last:border-0 text-white/72" style={{ fontFamily: MONO }}>
                  {e.text} <span style={{ color: 'rgba(0,255,209,0.5)' }}>⌗ {String(e.id).slice(-6)}</span>
                </div>
              ))}
            </HPanel>
          )}
        </div>

        <div>
          <HPanel title="juror calibration" hint="Brier-scored, weight-adjusted" tone="amber">
            <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
              <tbody>
                {cal.jurors.map((j) => (
                  <tr key={j.name} className="border-b border-white/6 last:border-0">
                    <td className="py-2 text-white/75">{j.name}</td>
                    <td className="text-white/60">{j.hit}%</td>
                    <td className="w-[86px]"><div className="h-[4px] rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: j.hit + '%', background: COLOR.violet }} /></div></td>
                    <td className="text-right" style={{ color: j.wt.startsWith('+') ? COLOR.green : j.wt.startsWith('−') ? COLOR.red : 'rgba(255,255,255,0.4)' }}>{j.wt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[10px] leading-[15px]" style={{ color: COLOR.amber, fontWeight: 300 }}>{cal.honest}</div>
          </HPanel>

          <HPanel title="the sleeping queue" hint="earn before build — A8. Every module has an alarm, not a deadline">
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {ARC.vision.sleeping.map((s) => (
                <div key={s.id} className="flex items-baseline gap-2.5 text-[10.5px] py-[3px]">
                  <StatusDot state="sleeping" />
                  <span className="w-[86px] shrink-0 text-white/80" style={{ fontFamily: MONO }}>{s.id}</span>
                  <span className="leading-[15px]" style={{ fontWeight: 300, color: 'rgba(251,191,93,0.8)' }}>{s.wakes}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
