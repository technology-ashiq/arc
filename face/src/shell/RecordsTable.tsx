// RecordsTable.tsx -- the Records tab's one shared table (face v3 Cycle 17 P01; REQ-02, ADR-1365).
//
// Every collection a fold declares is drawn here, the same way in every room: 8 rows, "show all N" up to 200, a
// literal search over the declared fields, an empty state that names the collection and a failed read beside its
// retry. What is kept and how many rows are drawn is lib/records.mjs; this file only draws it.
import { useState } from 'react'
import { recordsMatch, recordsShapeProblems, recordsWindow, cellText } from '../lib/records.mjs'
import type { RecordCollection } from '../lib/records.mjs'
import { Btn, MONO, TextInput, UI } from '../ui/kit'
import { DoorRefusal, HPanel, Reading } from '../ui/bits'

export default function RecordsTable({ c, onRetry }: { c: RecordCollection; onRetry: () => void }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const shape = recordsShapeProblems(c)
  const kept = recordsMatch(c.rows ?? [], query, c.search ?? [])
  const win = recordsWindow(kept, c.cap, showAll)
  const total = (c.rows ?? []).length
  return (
    <HPanel title={c.title} hint={`${total} record${total === 1 ? '' : 's'}`}>
      <div data-records={c.key}>
        {c.isReading ? <Reading what={c.title.toLowerCase()} /> : null}
        {c.isRefused ? (
          <div className="flex items-start gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <DoorRefusal code={c.refusal.code} human={c.refusal.human} />
            </div>
            <Btn small onClick={onRetry}>Retry</Btn>
          </div>
        ) : null}
        {shape.length > 0 ? (
          <p data-records-shape={shape.length} className="text-[12px] leading-[18px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
            {shape.join(' · ')}
          </p>
        ) : null}
        {!c.isReading && !c.isRefused && shape.length === 0 ? (
          <>
            {(c.search ?? []).length > 0 && total > 0 ? (
              <div className="mb-2 max-w-[360px]" data-records-search={c.key}>
                <TextInput value={query} onChange={setQuery} placeholder={`search ${c.search.join(', ')}`} />
              </div>
            ) : null}
            {total === 0 ? (
              <p data-records-empty={c.key} className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                No {c.title.toLowerCase()} yet.
              </p>
            ) : kept.length === 0 ? (
              <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                No {c.title.toLowerCase()} match “{query}”.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] leading-[19px]" style={{ fontFamily: UI, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {c.columns.map((col) => (
                        <th key={col.key} scope="col" className="text-left px-2 pb-1.5 text-[10.5px] uppercase tracking-[0.06em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {win.rows.map((r, i) => (
                      <tr key={i} data-records-row={c.key} data-record-tone={c.toneKey ? cellText(r[c.toneKey]) || undefined : undefined} style={{ borderBottom: '1px solid var(--line-1)' }}>
                        {c.columns.map((col, j) => (
                          <td key={col.key} className="px-2 py-[7px] align-top [overflow-wrap:anywhere]" style={{ fontFamily: j === 0 ? MONO : UI, color: j === 0 ? 'var(--text-1)' : 'var(--text-2)' }}>
                            {cellText(r[col.key]) || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {win.more ? (
              showAll ? (
                <p data-records-more={c.key} className="mt-2 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{win.more}</p>
              ) : (
                <div className="mt-2" data-records-all={c.key}>
                  <Btn small onClick={() => setShowAll(true)}>{win.more}</Btn>
                </div>
              )
            ) : null}
          </>
        ) : null}
      </div>
    </HPanel>
  )
}
