// View.tsx -- command/map: v0.7's MapRoom, placing what fold() computed and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: stations and lanes come from the served registry and the
// contract, not a bundled room list; "live today" is folded from the door's day of receipts by the kinds
// each room homes; the in-flight dot is not ported (it animated v0.7's simulated tape); hovering a
// station is a pick the fold reads, so the panel beside the map is decided in fold.mjs.
import { Crosshair } from '@phosphor-icons/react'
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Chip, FONT, MONO, UI, YoursBadge } from '../../../ui/kit'
import { Empty, HPanel, KpiStrip, RoomHead } from '../../../ui/bits'
export { MapTrifold as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <HPanel title="The map" hint="click a station to open it · hover for what homed there today">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <svg viewBox={f.viewBox} width="100%" style={{ minWidth: 820, display: 'block', fontFamily: UI }} role="img" aria-label="Map of every served room, by ring">
            {f.rows.map((row) => (
              <g key={row.ring}>
                <text x={14} y={row.labelY} fontSize={10} fontWeight={600} letterSpacing={0.8} fill="var(--text-3)" style={{ textTransform: 'uppercase' }}>
                  {row.ring}
                </text>
                <line x1={row.x0} y1={row.y} x2={row.x1} y2={row.y} stroke={row.ink} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
                {row.stations.map((s) => (
                  <g
                    key={s.id}
                    data-station={s.id}
                    className="cursor-pointer"
                    onClick={() => ctx.onOpen(s.id)}
                    onMouseEnter={() => ctx.onPick('station', s.id)}
                    onMouseLeave={() => ctx.onPick('station', '')}
                  >
                    <circle cx={s.x} cy={s.y} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.dash} />
                    {s.hasToday && (
                      <text x={s.x} y={s.countY} fontSize={8.5} textAnchor="middle" fill="var(--on-fill)" fontWeight={700}>
                        {s.todayLabel}
                      </text>
                    )}
                    <text x={s.x} y={s.nameY} fontSize={10.5} fontWeight={500} textAnchor="middle" fill={s.labelInk}>
                      {s.name}
                    </text>
                    <text x={s.x} y={s.stateY} fontSize={8.5} textAnchor="middle" fill={s.stateInk}>
                      {s.stateLabel}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          {f.legend.map((l) => (
            <span key={l.key} data-legend={l.key} className="inline-flex items-center gap-1.5">
              {l.label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{f.feedNote}</p>
      </HPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <HPanel className="min-w-0" title="Lanes" hint={f.lanesHint}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {f.lanes.map((l) => (
              <button
                key={l.lane}
                type="button"
                disabled={!l.canOpen}
                onClick={() => ctx.onOpen(l.room)}
                className="flex items-center gap-3 text-left min-w-0 px-2 py-[7px] cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) disabled:cursor-default"
                style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}
              >
                <span className="w-[92px] shrink-0 text-[12px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{l.lane}</span>
                <span aria-hidden="true" className="flex-1 h-px" style={{ background: 'var(--line-2)' }} />
                <span className="text-[12px] truncate" style={{ fontFamily: UI, color: l.ink }}>{l.name}</span>
                <span className="w-[78px] shrink-0 text-right text-[11px] truncate" style={{ fontFamily: UI, color: l.stateInk }}>{l.state}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.lanesFoot}</p>
        </HPanel>

        <div className="min-w-0">
          <HPanel title={f.hovered.title} hint="hover the map" actions={f.hovered.isShown && <Chip>{f.hovered.ring}</Chip>}>
            {!f.hovered.isShown && <Empty icon={Crosshair} title="Hover a station" hint="Its sentence, its counts and the last receipt that homed there today appear here." />}
            {f.hovered.isShown && (
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{f.hovered.sentence}</div>
                  <div className="text-[12.5px] leading-[18px] mt-1 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.hovered.lede}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                    <div className="text-[22px] leading-[26px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{f.hovered.today}</div>
                    <div className="text-[12px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>Receipts today</div>
                  </div>
                  <div className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                    <div className="text-[22px] leading-[26px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{f.hovered.ever}</div>
                    <div className="text-[12px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>Receipts ever</div>
                  </div>
                </div>
                {f.hovered.hasLast ? (
                  <div className="text-[12px] leading-[18px] pt-3 break-words" style={{ fontFamily: UI, color: 'var(--text-2)', borderTop: '1px solid var(--line-1)' }}>{f.hovered.last}</div>
                ) : (
                  <div className="text-[12px] leading-[18px] pt-3" style={{ fontFamily: UI, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>{f.hovered.note}</div>
                )}
              </div>
            )}
          </HPanel>

          <HPanel title="The map's law">
            <div className="space-y-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>A room exists in exactly one place, the registry; the rail, the palette and this map read it.</div>
              <div>A new lane lands its room in the same change, or face-coverage fails (the birth rule).</div>
              <div>Liveness is a fold over receipts: nobody marks a station live by hand.</div>
              <div>Dotted means unborn; dashed means born but silent; both are honest states, never hidden.</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
