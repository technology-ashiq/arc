// 05 · AUTONOMY — the ladder, live: promote with evidence, demote
// on incident, forever-human list. Changes are events.
import { MONO, COLOR, Btn, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { ladder } from '../../spine/derive.js'
import { spine, changeAutonomy } from '../../spine/store.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

const L_STYLE = {
  L0: { bg: 'rgba(255,255,255,0.08)', c: 'rgba(255,255,255,0.55)' },
  L1: { bg: 'rgba(0,255,209,0.08)', c: 'rgba(0,255,209,0.75)' },
  L2: { bg: 'rgba(0,255,209,0.16)', c: '#00ffd1' },
  L3: { bg: '#00ffd1', c: '#00221b' },
}

export default function Autonomy() {
  useSpine()
  const rows = ladder()
  const changes = spine.events.filter((e) => e.kind === 'autonomy.changed').slice(-6).reverse()

  return (
    <>
      <RoomHead
        title="Trust is earned. Never assumed."
        hint="every capability climbs on trial-ledger evidence; any incident demotes automatically; some things stay human forever"
        right={<SimBadge>ladder demo — changes append autonomy.changed</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div>
          <HPanel title="the ladder — per capability" hint="L0 observe · L1 draft · L2 act in caps · L3 act + weekly digest">
            {rows.map((row) => {
              const canPromote = /proposed|promotion/.test(row.note) && row.level !== 'L3' && row.cap !== 'trading.real-money' && row.cap !== 'pricing.change'
              const canDemote = row.level !== 'L0' && row.level !== 'L1'
              const st = L_STYLE[row.level] || L_STYLE.L1
              return (
                <div key={row.cap} className="flex items-center gap-3 py-2.5 border-b border-white/6 last:border-0 flex-wrap">
                  <span className="w-9 text-center rounded-md px-1 py-[3px] text-[11px]" style={{ fontFamily: MONO, fontWeight: 700, background: st.bg, color: st.c }}>{row.level}</span>
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-[12.5px] text-white/88" style={{ fontFamily: MONO }}>{row.cap}</div>
                    <div className="text-[10.5px] text-white/50" style={{ fontWeight: 300 }}>{row.note}</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.1em] text-white/42" style={{ fontFamily: MONO }}>{row.cap2}</span>
                  {canPromote && (
                    <Btn small tone="green" onClick={() => changeAutonomy(row.cap, row.level, 'L' + (parseInt(row.level.slice(1)) + 1), 'trial-ledger evidence verified — promoted by owner')}>
                      promote
                    </Btn>
                  )}
                  {canDemote && (
                    <Btn small tone="danger" onClick={() => changeAutonomy(row.cap, row.level, 'L1', 'incident drill — auto-demote demonstrated (A4)')}>
                      demote
                    </Btn>
                  )}
                </div>
              )
            })}
          </HPanel>

          {changes.length > 0 && (
            <HPanel title="autonomy.changed — the trail" hint="every rung climbed or lost is a receipt">
              {changes.map((e) => (
                <div key={e.id} className="text-[11px] py-1.5 border-b border-white/6 last:border-0 text-white/72" style={{ fontFamily: MONO }}>
                  {e.text} <span style={{ color: 'rgba(0,255,209,0.5)' }}>⌗ {String(e.id).slice(-6)}</span>
                </div>
              ))}
            </HPanel>
          )}
        </div>

        <div>
          <HPanel title="forever human — at any level" tone="amber">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ARC.autonomy.foreverHuman.map((f) => (
                <span key={f} className="text-[10px] text-white/75 border rounded-lg px-2 py-[5px]" style={{ fontFamily: MONO, borderColor: 'rgba(255,107,107,0.4)' }}>{f}</span>
              ))}
            </div>
            <p className="text-[11px] leading-[17px] text-white/58" style={{ fontWeight: 300 }}>
              Eternal Article Two — Human Sovereignty. No trial-ledger streak, no model upgrade, no autonomy level ever touches these. The machine runs the company; the human owns it.
            </p>
          </HPanel>

          <HPanel title="how promotion works">
            <div className="space-y-2 text-[11.5px] leading-[17px] text-white/68" style={{ fontWeight: 300 }}>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Evidence, not vibes</b> — e.g. twenty consecutive drafts approved unedited. The trial ledger holds the streak; the promotion card cites it.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Incidents demote automatically</b> — one bad publish and content.publish drops a rung. Trust is re-earned, never argued back (A4).</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Caps stay at every level</b> — outreach 20/day, budgets per run, deploy behind gates. L3 means less asking, never fewer guardrails.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Policy engine (sleeping)</b> — per-action capability vectors, deny-by-default. Wakes at three kinds running L2 — before any scheduler.</div>
            </div>
          </HPanel>

          <HPanel title="the levels">
            <div className="space-y-1.5" style={{ fontFamily: MONO }}>
              {ARC.autonomy.levels.map((l) => (
                <div key={l.level} className="flex items-baseline gap-3 text-[11px]">
                  <span className="w-8 shrink-0" style={{ color: COLOR.cyan, fontWeight: 700 }}>{l.level}</span>
                  <span className="text-white/65" style={{ fontWeight: 300, fontFamily: 'inherit' }}>{l.meaning}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
