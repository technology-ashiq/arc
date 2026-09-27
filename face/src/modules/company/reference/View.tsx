// View.tsx -- company/reference: renders what fold() returned, and decides nothing (ADR-1320, ADR-1346). Every choice
// -- which page, which facts, which link resolves, whether the narrative exists -- is fold's; a click only sets the
// one pick (`at`) or opens a live room.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Block, Folded, Span } from './fold.mjs'
import { DoorRefusal, Empty, HPanel, Reading, RoomHead, SectionLabel } from '../../../ui/bits'
import { Btn, MONO, UI } from '../../../ui/kit'
import { BadBlock, Figure, Gloss, GroupLabel, Lede, PageMast, PageNav, PagePanel, PageSection, PageTable, StatGrid, StepPipe } from '../../../ui/page'
export { BookOpenText as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <div>
      <RoomHead title={f.title} hint={f.lede} />
      <nav aria-label="Reference" className="flex flex-wrap items-center gap-1.5 mb-4 text-[12.5px]" style={{ fontFamily: UI }}>
        {f.crumbs.map((c) => (
          <span key={c.at} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>›</span>
            {c.isCurrent && <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.label}</span>}
            {!c.isCurrent && (
              <button type="button" onClick={() => ctx.onPick('at', c.at)} className="cursor-pointer hover:text-(--accent)" style={{ color: 'var(--text-2)' }}>{c.label}</button>
            )}
          </span>
        ))}
      </nav>

      {f.isReading && <Reading what="the reference" />}
      {f.isRefused && <DoorRefusal code={f.refusal.code} human={f.refusal.human} />}

      {f.isLost && (
        <HPanel title="Not in the reference">
          <Empty title="Nothing by that name" hint={f.lost} action={<Btn small onClick={() => ctx.onPick('at', '')}>Back to the index</Btn>} />
        </HPanel>
      )}

      {f.isIndex && (
        <HPanel title="Reference" hint={f.debt}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {f.types.map((t) => (
              <button key={t.key} type="button" onClick={() => ctx.onPick('at', t.at)} className="text-left rounded-lg px-3 py-2.5 cursor-pointer hover:border-(--accent)" style={{ border: '1px solid var(--line-2)', background: 'var(--bg-2)' }}>
                <span className="block text-[20px] leading-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-1)' }}>{t.count}</span>
                <span className="block text-[12.5px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{t.title}</span>
                <span className="block text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{t.note}</span>
              </button>
            ))}
          </div>
        </HPanel>
      )}

      {f.isType && (
        <HPanel title={f.typeList.title}>
          {f.typeList.isEmpty && <Empty title="None" hint="The extract holds no entity of this type." />}
          <ul className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
            {f.typeList.rows.map((r) => (
              <li key={r.at} className="py-2 flex flex-wrap items-baseline gap-x-3">
                <button type="button" onClick={() => ctx.onPick('at', r.at)} className="cursor-pointer hover:text-(--accent) text-[13px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.name}</button>
                <span className="text-[12.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{r.summary}</span>
              </li>
            ))}
          </ul>
        </HPanel>
      )}

      {f.isShaped && (
        <article>
          <PageMast crumb={f.shape.crumb} name={f.shape.name} version={f.shape.version}
            tagline={f.shape.hasTagline && <Spans spans={f.shape.tagline} onPick={(at) => ctx.onPick('at', at)} />}
            chips={f.shape.chips}
            action={f.entity.faceRoom.canOpen && <Btn small onClick={() => ctx.onOpen(f.entity.faceRoom.room)}>{f.entity.faceRoom.label}</Btn>} />
          {f.shape.showPending && <p className="text-[13px] italic mb-6" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.shape.pending}</p>}
          <div className="grid gap-x-11 xl:grid-cols-[225px_minmax(0,1fr)]">
            <PageNav groups={f.shape.nav} />
            <main className="min-w-0">
              {f.shape.groups.map((g) => (
                <div key={g.key}>
                  <GroupLabel>{g.title}</GroupLabel>
                  {g.sections.map((s) => (
                    <PageSection key={s.id} id={s.id} generated={s.isGenerated} title={s.hasTitle && <Spans spans={s.title} onPick={(at) => ctx.onPick('at', at)} />}>
                      <Blocks blocks={s.blocks} onPick={(at) => ctx.onPick('at', at)} />
                    </PageSection>
                  ))}
                </div>
              ))}
            </main>
          </div>
        </article>
      )}

      {f.isPlainEntity && (
        <div className="grid gap-4">
          <HPanel title={f.entity.heading} hint={f.entity.kind}>
            <SectionLabel>Start here</SectionLabel>
            {f.entity.hasStartHere && <Blocks blocks={f.entity.startBlocks} onPick={(at) => ctx.onPick('at', at)} />}
            {f.entity.hasMissing && (
              <p className="text-[12px] mt-1 mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>Not explained on this page yet: <span style={{ fontFamily: MONO }}>{f.entity.missing}</span></p>
            )}
            {f.entity.isUnexplained && (
              <p className="text-[12px] mt-1 mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>No narrative explains this yet -- it counts in the explanation debt (ADR-1513).</p>
            )}
            {!f.entity.hasStartHere && (
              <p className="text-[12.5px] italic" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.entity.pending}</p>
            )}
            <SectionLabel className="mt-4">The bigger loop</SectionLabel>
            {f.entity.hasLoop && <Blocks blocks={f.entity.loopBlocks} onPick={(at) => ctx.onPick('at', at)} />}
            {!f.entity.hasLoop && (
              <p className="text-[12.5px] italic" style={{ fontFamily: UI, color: 'var(--text-3)' }}>Narrative pending.</p>
            )}
            {f.entity.showWithheld && (
              <p className="text-[11.5px] mt-2" style={{ fontFamily: UI, color: 'var(--warn)' }}>{f.entity.withheld}</p>
            )}
          </HPanel>

          <HPanel title="Reference" hint="the facts its source file declares, and the pages they link to">
            <dl className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: 'minmax(120px, max-content) 1fr' }}>
              {f.entity.facts.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{row.label}</dt>
                  <dd className="text-[12.5px] min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                    {row.value}
                    {row.hasRefs && row.refs.map((r) => (
                      <span key={r.at} className="mr-2 inline-block">
                        {r.isLink && <button type="button" onClick={() => ctx.onPick('at', r.at)} className="cursor-pointer underline decoration-dotted hover:text-(--accent)" style={{ fontFamily: MONO }}>{r.text}</button>}
                        {!r.isLink && <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.text}</span>}
                      </span>
                    ))}
                    {row.isList && row.items.map((x) => (
                      <span key={x} className="block text-[11.5px] break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{x}</span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            {f.entity.faceRoom.canOpen && (
              <div className="mt-3"><Btn small onClick={() => ctx.onOpen(f.entity.faceRoom.room)}>{f.entity.faceRoom.label}</Btn></div>
            )}
          </HPanel>

          <HPanel title="Evidence" hint="where these facts are read from, and the decisions this owns">
            <p className="text-[12px] mb-2 break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f.entity.source}</p>
            {f.entity.hasAdrs && (
              <ul className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
                {f.entity.adrs.map((a) => (
                  <li key={a.key} className="py-1.5 flex flex-wrap gap-x-3 text-[12.5px]" style={{ fontFamily: UI }}>
                    <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>ADR {a.number}</span>
                    <span style={{ color: 'var(--text-1)' }}>{a.title}</span>
                    <span style={{ color: 'var(--text-3)' }}>{a.status} · {a.date}</span>
                  </li>
                ))}
              </ul>
            )}
            {!f.entity.hasAdrs && <p className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>No decision names this as its product.</p>}
          </HPanel>

          <HPanel title="Meta" hint="build-time facts only -- live numbers stay in the live rooms (ADR-1509)">
            <p className="text-[12px] break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f.entity.page}</p>
          </HPanel>
        </div>
      )}

      {f.showNotes && <p className="text-[11.5px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.notes}</p>}
    </div>
  )
}

// The narrative as the fold parsed it (ADR-1347 section 2): every choice -- which kind of block, which kind of span -- is a
// boolean the fold set; this only draws it. Text is React-escaped, so a tag in the prose shows and never runs.
function Spans({ spans, onPick }: { spans: Span[]; onPick: (at: string) => void }) {
  return (
    <>
      {spans.map((s, i) => (
        <span key={i}>
          {s.isPick && <button type="button" onClick={() => onPick(s.at)} className="cursor-pointer underline decoration-dotted hover:text-(--accent) whitespace-nowrap" style={{ fontFamily: MONO, fontSize: '0.92em' }}>{s.text}</button>}
          {s.isText && s.text}
          {s.isStrong && <strong style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.text}</strong>}
          {s.isEm && <em>{s.text}</em>}
          {s.isLink && <span style={{ color: 'var(--text-1)', textDecoration: 'underline dotted' }}>{s.text}</span>}
          {s.isCode && <code className="text-[12px] px-1 rounded" style={{ fontFamily: MONO, background: 'var(--bg-2)' }}>{s.text}</code>}
        </span>
      ))}
    </>
  )
}

function Blocks({ blocks, onPick }: { blocks: Block[]; onPick: (at: string) => void }) {
  return (
    <div className="text-[15px] leading-[1.65]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
      {blocks.map((b, i) => (
        <div key={i} className="mb-3 max-w-[76ch] [&:has(figure,table,.grid)]:max-w-none">
          {b.isLede && <Lede>{<Spans spans={b.spans} onPick={onPick} />}</Lede>}
          {b.isSteps && <StepPipe steps={b.steps.map((s) => ({ n: s.n, t: <Spans spans={s.t} onPick={onPick} />, plain: s.hasPlain && <Spans spans={s.plain} onPick={onPick} />, d: s.hasD && <Spans spans={s.d} onPick={onPick} />, f: s.hasF && <Spans spans={s.f} onPick={onPick} /> }))} />}
          {b.isFigure && <Figure g={b.figure} />}
          {b.isPanel && <PagePanel title={b.panelTitle} warn={b.isWarn} big={b.isBig}><Blocks blocks={b.inner} onPick={onPick} /></PagePanel>}
          {b.isStats && <StatGrid stats={b.stats} />}
          {b.isRosetta && <PageTable rosetta head={b.head.map((c) => <Spans spans={c.spans} onPick={onPick} />)} rows={b.rows.map((r) => r.cells.map((c) => <Spans spans={c.spans} onPick={onPick} />))} />}
          {b.isGloss && <Gloss items={b.gloss.map((g) => ({ term: g.term, def: <Spans spans={g.def} onPick={onPick} /> }))} />}
          {b.isBad && <BadBlock why={b.bad} source={b.text} />}
          {b.isH2 && <h3 className="text-[15px] font-semibold mt-4 mb-1" style={{ fontFamily: 'var(--font-display)' }}><Spans spans={b.spans} onPick={onPick} /></h3>}
          {b.isH3 && <h4 className="text-[13.5px] font-semibold mt-3 mb-1"><Spans spans={b.spans} onPick={onPick} /></h4>}
          {b.isH4 && <h5 className="text-[12.5px] font-semibold mt-2 mb-0.5" style={{ color: 'var(--text-2)' }}><Spans spans={b.spans} onPick={onPick} /></h5>}
          {b.isPara && <p><Spans spans={b.spans} onPick={onPick} /></p>}
          {b.isQuote && <blockquote className="pl-3 italic" style={{ borderLeft: '2px solid var(--line-2)', color: 'var(--text-2)' }}><Spans spans={b.spans} onPick={onPick} /></blockquote>}
          {b.isList && !b.isOrdered && (
            <ul className="list-disc pl-5 grid gap-1">{b.items.map((it, j) => <li key={j}><Spans spans={it.spans} onPick={onPick} /></li>)}</ul>
          )}
          {b.isOrdered && (
            <ol className="list-decimal pl-5 grid gap-1">{b.items.map((it, j) => <li key={j}><Spans spans={it.spans} onPick={onPick} /></li>)}</ol>
          )}
          {b.isTable && <PageTable head={b.head.map((c) => <Spans spans={c.spans} onPick={onPick} />)} rows={b.rows.map((r) => r.cells.map((c) => <Spans spans={c.spans} onPick={onPick} />))} />}
          {b.isCode && <pre className="text-[12px] p-2.5 rounded overflow-x-auto" style={{ fontFamily: MONO, background: 'var(--bg-2)' }}>{b.text}</pre>}
        </div>
      ))}
    </div>
  )
}
