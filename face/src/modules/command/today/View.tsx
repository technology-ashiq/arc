// View.tsx -- command/today: v0.7's Overview, drawing what fold() returned and deciding nothing
// (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the approval list is read here and decided in the inbox module
// (v0.7's one-key approve had no reason, and a stamp without one is not a stamp); the policy ladder and
// "learned this week" are NOT SERVED panels (ADR-1324); the tape is the door's day, newest at the foot.
import { Pulse, Tray } from '@phosphor-icons/react'
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, Chip, MONO, SimBadge, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, Empty, EventRow, HPanel, KpiStrip, NotServed, Reading, ReceiptDrawer, RoomHead, SectionLabel } from '../../../ui/bits'
export { SunHorizon as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead
        title={f.sentence}
        hint={f.lede}
        right={f.isSim ? <SimBadge>{f.modeLabel}</SimBadge> : <YoursBadge>{f.modeLabel}</YoursBadge>}
      />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Brief" hint={f.brief.hint}>
            {f.brief.isReading && <Reading what="the brief" />}
            {f.brief.isRefused && <DoorRefusal code={f.brief.refusal.code} human={f.brief.refusal.human} />}
            {f.brief.isQuiet && <Empty icon={Pulse} title="The brief came back with no groups" hint="That is the door's answer, not an empty screen standing in for one." />}
            {f.brief.isShown && (
              <div className="-mx-2">
                {f.brief.lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-[110px_1fr] gap-3 items-baseline px-2 py-[7px] rounded-md transition-colors duration-200 hover:bg-(--bg-3)">
                    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: l.ink }}>
                      <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: l.ink }} />
                      {l.tag}
                    </span>
                    <span className="text-[13.5px] leading-[21px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{l.text}</span>
                  </div>
                ))}
                <p className="mt-2 px-2 text-[11.5px] leading-[17px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{f.brief.foot}</p>
              </div>
            )}
          </HPanel>

          <HPanel
            title="Today"
            hint={f.feed.hint}
            actions={f.canOpenSpine && <Btn small onClick={() => ctx.onOpen(f.spineRoom)}>Open the spine</Btn>}
          >
            {f.feed.isReading && <Reading what="today's receipts" />}
            {f.feed.isRefused && <DoorRefusal code={f.feed.refusal.code} human={f.feed.refusal.human} />}
            {f.feed.isEmpty && (
              <Empty
                icon={Pulse}
                title="The day hasn't started"
                hint="No receipt has landed today yet. The log is readable and this day is empty, which is a different fact from a day that could not be read."
              />
            )}
            {f.feed.hasRows && (
              <div className="max-h-[520px] overflow-y-auto -mx-2 flex flex-col-reverse" style={{ scrollbarWidth: 'thin' }}>
                {f.feed.rows.map((row) => (
                  <EventRow key={row.id} row={row} onReceipt={(id) => ctx.onPick('receipt', id)} />
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel
            title="Approval inbox"
            hint="decided in the inbox, with a typed reason"
            tone={f.inbox.tone}
            actions={<Chip tone={f.inbox.tone}>{f.inbox.chip}</Chip>}
          >
            {f.inbox.isReading && <Reading what="the inbox" />}
            {f.inbox.isRefused && <DoorRefusal code={f.inbox.refusal.code} human={f.inbox.refusal.human} />}
            {f.inbox.isZero && (
              <Empty icon={Tray} title="Inbox zero. The company runs itself." hint="Every approval raised has been decided. A new one lands here the moment a lane asks." />
            )}
            {f.inbox.cards.map((c) => (
              <div
                key={c.id}
                data-approval={c.id}
                className="relative p-4 pl-5 mb-3 overflow-hidden"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}
              >
                <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--amber)' }} />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{c.title}</b>
                  <Chip tone="amber">{c.tag}</Chip>
                </div>
                <dl className="mb-3 space-y-[5px]">
                  {c.facts.map((fact) => (
                    <div key={fact.k} className="grid grid-cols-[76px_1fr] gap-2 items-baseline">
                      <dt className="text-[10.5px] uppercase tracking-[0.06em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{fact.k}</dt>
                      <dd className="text-[12.5px] leading-[18px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{fact.v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{c.age}</span>
                  {f.canOpenInbox && (
                    <Btn small tone="amber" onClick={() => ctx.onOpen(f.inboxRoom)}>
                      Decide in the inbox
                    </Btn>
                  )}
                </div>
              </div>
            ))}
            {f.inbox.hasDecided && (
              <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--line-1)' }}>
                <SectionLabel>Decided today</SectionLabel>
                {f.inbox.decided.map((d) => (
                  <div key={d.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2.5 text-[12px] py-[4px]">
                    <span className="shrink-0" style={{ fontFamily: UI, fontWeight: 600, color: d.ink }}>{d.label}</span>
                    <span className="truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{d.title}</span>
                    <button type="button" onClick={() => ctx.onPick('receipt', d.id)} className="text-[11px] cursor-pointer hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
                      ⌗ {d.short}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </HPanel>

          <HPanel title="Policy" hint="the ladder at a glance">
            <NotServed item={f.policy} />
          </HPanel>

          <HPanel title="Learned this week" hint="calibration, not vibes">
            <NotServed item={f.learned} />
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
