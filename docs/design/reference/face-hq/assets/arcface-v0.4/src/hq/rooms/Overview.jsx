// 00 · OVERVIEW — the daily screen: brief, KPIs, live timeline,
// approval inbox (j/k select · a approve · r reject), quick panels.
import { useEffect, useRef, useState } from 'react'
import { MONO, COLOR, Btn, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel, EventRow, ApprovalCard, ReceiptDrawer } from '../bits.jsx'
import { spine, recordDecision } from '../../spine/store.js'
import { kpis, briefLines, timeline, ladder, calibration, clockLabel } from '../../spine/derive.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'

export default function Overview() {
  useSpine()
  const k = kpis()
  const brief = briefLines()
  const evs = timeline(24)
  const [sel, setSel] = useState(0)
  const [receipt, setReceipt] = useState(null)
  const feedRef = useRef(null)
  const pending = spine.pendingApprovals

  // the promised expert path — j/k move, a approve, r reject
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (receipt && e.key === 'Escape') return setReceipt(null)
      if (!pending.length) return
      if (e.key === 'j') setSel((s) => Math.min(s + 1, pending.length - 1))
      else if (e.key === 'k') setSel((s) => Math.max(s - 1, 0))
      else if (e.key === 'a') {
        const ap = pending[Math.min(sel, pending.length - 1)]
        if (ap) recordDecision(ap.id, true, 'cleared via keyboard — evidence on the card', ap.actions[0]?.label)
        setSel((s) => Math.max(0, Math.min(s, pending.length - 2)))
      } else if (e.key === 'r') {
        const ap = pending[Math.min(sel, pending.length - 1)]
        if (ap) document.querySelector(`[data-approval="${ap.id}"] button`)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, sel, receipt])

  // keep the feed pinned to the latest event
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [evs.length])

  const decided = spine.events.filter((e) => e.kind === 'decision.recorded' && e.day === spine.dayIndex && e.decided).slice(-4)

  return (
    <>
      <RoomHead
        title={brief.greeting}
        hint="the whole company on one screen — every number derives from the event log"
        right={<SimBadge>{spine.source === 'real' ? 'real spine · read-only' : 'simulated future day · real vocabulary'}</SimBadge>}
      />

      {/* the brief — ≤40 lines by law; here it is 4 */}
      <HPanel title="arc brief" hint={`noise budget: whole day ≤ 40 lines · now ${clockLabel()}`}>
        <div className="space-y-1.5 text-[12.5px]" style={{ fontFamily: MONO }}>
          {brief.lines.map((l) => (
            <div key={l.tag} className="flex gap-3 items-baseline">
              <span className="w-[92px] shrink-0 text-[10.5px] uppercase tracking-[0.12em]" style={{ color: l.tone === 'amber' ? COLOR.amber : l.tone === 'green' ? COLOR.green : l.tone === 'cyan' ? COLOR.cyan : 'rgba(255,255,255,0.5)' }}>
                {l.tag}
              </span>
              <span className="text-white/80" style={{ fontWeight: 300 }}>{l.text}</span>
            </div>
          ))}
        </div>
      </HPanel>

      {/* KPI row — a number never shows a spinner (HQ brief rule) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {[
          { v: '₹0', l: 'real revenue — honest', tone: 'green' },
          { v: '₹' + k.simRev.toLocaleString('en-IN'), l: 'simulated · labeled', tone: 'default' },
          { v: '₹' + k.cost.toLocaleString('en-IN') + ' · ' + k.ret.toFixed(1) + '×', l: 'ai cost · return', tone: 'default' },
          { v: k.ideas, l: 'ideas captured', tone: 'default' },
          { v: k.phases + ' · ' + k.content, l: 'phases · content', tone: 'default' },
          { v: '~' + k.minutesNeeded + ' min', l: 'your time needed', tone: k.pending ? 'amber' : 'green' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border p-3.5" style={{ background: 'rgba(4,9,8,0.78)', borderColor: s.tone === 'amber' ? 'rgba(251,191,93,0.4)' : 'rgba(255,255,255,0.1)' }}>
            <div className="text-[19px] tracking-tight" style={{ fontWeight: 600, color: s.tone === 'amber' ? COLOR.amber : s.tone === 'green' ? COLOR.green : '#fff', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-white/45 mt-1" style={{ fontFamily: MONO }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        {/* live timeline */}
        <HPanel title="today — everything the company did" hint="live · every line is an event · ⌗ opens the receipt">
          <div ref={feedRef} className="max-h-[430px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {evs.length === 0 && (
              <div className="py-8 text-center text-[12px] text-white/45" style={{ fontWeight: 300 }}>
                The day hasn't started — press play in the top bar (⏸ → 10×) and the company wakes up.
              </div>
            )}
            {evs.map((e) => (
              <EventRow key={e.id} e={e} onReceipt={setReceipt} />
            ))}
          </div>
          <div className="mt-3 flex justify-between items-center flex-wrap gap-2">
            <span className="text-[9.5px] text-white/40 uppercase tracking-[0.14em]" style={{ fontFamily: MONO }}>
              full log + filters → the spine room
            </span>
            <Btn small onClick={() => uiBus.openRoom('spine')}>open the spine →</Btn>
          </div>
        </HPanel>

        {/* inbox + quick panels */}
        <div>
          <HPanel title={`approval inbox — ${pending.length} waiting`} hint="j/k move · a approve · r reject · reasons become calibration data" tone={pending.length ? 'amber' : undefined}>
            {pending.length === 0 && (
              <div className="py-6 text-center">
                <div className="text-[15px] text-white/85 mb-1" style={{ fontWeight: 500 }}>Inbox zero. The company runs itself.</div>
                <div className="text-[11px] text-white/48" style={{ fontWeight: 300 }}>New approvals will stream in as the day plays.</div>
              </div>
            )}
            {pending.map((ap, i) => (
              <ApprovalCard key={ap.id} ap={ap} selected={i === Math.min(sel, pending.length - 1)} onAct={(id, ok, reason, label) => recordDecision(id, ok, reason, label)} />
            ))}
            {decided.length > 0 && (
              <div className="border-t border-white/8 pt-3 mt-1">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/42 mb-2" style={{ fontFamily: MONO }}>done log — decision.recorded</div>
                {decided.map((d) => (
                  <div key={d.id} className="flex items-baseline gap-2.5 text-[10.5px] py-[3px] flex-wrap" style={{ fontFamily: MONO }}>
                    <span style={{ color: d.decided.approved ? COLOR.green : COLOR.red }}>{d.decided.approved ? d.decided.actionLabel || 'approved' : 'rejected'}</span>
                    <span className="text-white/62 truncate max-w-[240px]">{d.decided.title}</span>
                    <span style={{ color: 'rgba(0,255,209,0.5)' }}>⌗ {String(d.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>

          <HPanel title="autonomy — at a glance" hint="full ladder → autonomy room">
            <div className="space-y-1.5" style={{ fontFamily: MONO }}>
              {ladder().slice(0, 4).map((l) => (
                <div key={l.cap} className="flex items-center gap-2.5 text-[10.5px]">
                  <span className="w-8 text-center rounded px-1 py-[2px]" style={{ background: 'rgba(0,255,209,0.12)', color: COLOR.cyan, fontWeight: 700 }}>{l.level}</span>
                  <span className="text-white/78">{l.cap}</span>
                  <span className="text-white/40 truncate">{l.cap2}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end"><Btn small onClick={() => uiBus.openRoom('autonomy')}>ladder →</Btn></div>
          </HPanel>

          <HPanel title="learned this week" hint="calibration, not vibes">
            <div className="text-[11px] leading-[17px] text-white/68 space-y-1.5" style={{ fontWeight: 300 }}>
              {calibration().rules.slice(0, 2).map((r) => (
                <div key={r.id}><b className="text-white/90" style={{ fontWeight: 600 }}>{r.id}:</b> {r.text}</div>
              ))}
            </div>
            <div className="mt-3 flex justify-end"><Btn small onClick={() => uiBus.openRoom('learn')}>learn →</Btn></div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
