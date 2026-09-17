// 10 · ENGINE ROOM — arc's "models are parts, not identities",
// live: plug ANY model in as the face's brain (Claude, ChatGPT,
// Gemini, OpenRouter, or any OpenAI-compatible endpoint), test
// it, and pick the data source. Keys never leave this machine.
import { useState } from 'react'
import { UI, MONO, COLOR, Btn, StatusDot, SimBadge, Field, PickRow, INPUT_CLASS, INPUT_STYLE } from '../../ui/kit.jsx'
import { RoomHead, HPanel, SectionLabel } from '../bits.jsx'
import { loadEngine, saveEngine, clearEngine, engineReady, testEngine } from '../../brain/llm.js'
import { resetHistory } from '../../brain/brain.js'
import { spine, tryConnectRealSpine, useSimSource as pickSimSource } from '../../spine/store.js'
import { DRIVERS } from '../../spine/derive.js'
import { wsCount, wsReset, wsExportText, wsImportText } from '../../spine/workspace.js'
import { useSpine } from '../useSpine.js'
import { ask } from '../../lib/voice.js'

const MONO_INPUT = { ...INPUT_STYLE, fontFamily: MONO }
const PROSE = { fontFamily: UI, color: 'var(--text-2)' }
const NOTE = { fontFamily: UI, color: 'var(--text-3)' }

export default function EngineRoom() {
  useSpine()
  const saved = loadEngine() || {}
  const [provider, setProvider] = useState(saved.provider || 'anthropic')
  const [apiKey, setApiKey] = useState(saved.apiKey || '')
  const [model, setModel] = useState(saved.model || DRIVERS.find((d) => d.id === (saved.provider || 'anthropic'))?.model || '')
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl || '')
  const [status, setStatus] = useState(null)
  const [spineMsg, setSpineMsg] = useState(null)

  const pickProvider = (id) => {
    setProvider(id)
    const d = DRIVERS.find((x) => x.id === id)
    if (d && d.model) setModel(d.model)
    setStatus(null)
  }

  const save = () => {
    saveEngine({ provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() })
    resetHistory()
    setStatus({ kind: 'saved', text: 'engine saved — testing…' })
    testEngine()
      .then((r) => setStatus({ kind: 'ok', text: `driver live · ${r.ms} ms round-trip · reply “${r.out}”` }))
      .catch((e) => setStatus({ kind: 'err', text: `driver error — ${String(e.message || e)}` }))
  }

  const connectSpine = async () => {
    setSpineMsg({ kind: 'wait', text: 'reading /api/spine…' })
    const r = await tryConnectRealSpine()
    if (r.ok) setSpineMsg({ kind: 'ok', text: `connected — ${r.count} real events (read-only)` })
    else setSpineMsg({ kind: 'err', text: r.reason === 'not-configured' ? 'dev server reachable, but ARC_SPINE_DIR is not set in .env.local' : 'dev API not reachable — run `npm run dev` (dist/file mode has no API)' })
  }

  const pickSource = (v) => {
    if (v === 'sim') pickSimSource()
    else connectSpine()
  }

  return (
    <>
      <RoomHead
        title="Engine room."
        hint="the model is a swappable part — the process, the receipts and the constitution are the identity"
        right={<SimBadge>{engineReady() ? `brain: ${saved.provider} · ${saved.model}` : 'brain: offline matcher'}</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The face's brain — pick a driver" hint="any key works: the wire format adapts">
            <div className="mb-4">
              <PickRow options={DRIVERS.map((d) => ({ value: d.id, label: d.name }))} value={provider} onPick={pickProvider} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="API key">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'anthropic' ? 'sk-ant-…' : provider === 'gemini' ? 'AIza…' : 'sk-…'}
                  className={`${INPUT_CLASS} placeholder:text-(--text-3)`}
                  style={MONO_INPUT}
                />
              </Field>
              <Field label="Model id" hint="editable">
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="exact model id from your provider"
                  className={`${INPUT_CLASS} placeholder:text-(--text-3)`}
                  style={MONO_INPUT}
                />
              </Field>
            </div>
            {provider === 'custom' && (
              <Field label="Base url" hint="OpenAI-compatible" className="mb-3">
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.z.ai/v1 · http://localhost:11434/v1 (ollama) · …"
                  className={`${INPUT_CLASS} placeholder:text-(--text-3)`}
                  style={MONO_INPUT}
                />
              </Field>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Btn tone="primary" onClick={save}>Save + test driver</Btn>
              {engineReady() && (
                <Btn small tone="danger" onClick={() => { clearEngine(); resetHistory(); setStatus({ kind: 'ok', text: 'key removed — offline brain active' }) }}>
                  Remove key
                </Btn>
              )}
              {engineReady() && <Btn small onClick={() => ask('introduce yourself in one line and tell me what needs me today')}>Try the brain 🎙</Btn>}
            </div>
            {status && (
              <div className="mt-3 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: status.kind === 'err' ? COLOR.red : status.kind === 'ok' ? COLOR.green : 'var(--text-2)' }}>
                {status.text}
              </div>
            )}
            <p className="mt-4 pt-4 text-[12.5px] leading-[19px]" style={{ ...PROSE, borderTop: '1px solid var(--line-1)' }}>
              The key is stored only in this browser's localStorage on this machine, and calls go straight from your browser to the provider — no server, no middleman. With a brain attached, the face sees the LIVE state (inbox, KPIs, timeline), answers anything, and can operate HQ: open rooms, approve or reject with your voice — except money and kills, which stay yours (E2).
            </p>
          </HPanel>

          <HPanel title="Data source — what the spine renders">
            <div className="mb-3">
              <PickRow
                options={[
                  { value: 'sim', label: 'simulated day (default)' },
                  { value: 'real', label: 'connect REAL spine (read-only)' },
                ]}
                value={spine.source}
                onPick={pickSource}
              />
            </div>
            {spineMsg && (
              <div className="text-[12.5px] leading-[19px] mb-3 break-words" style={{ fontFamily: UI, color: spineMsg.kind === 'err' ? COLOR.red : spineMsg.kind === 'ok' ? COLOR.green : 'var(--text-2)' }}>
                {spineMsg.text}
              </div>
            )}
            <p className="text-[12.5px] leading-[19px]" style={PROSE}>
              To render your real arc receipts: copy <span style={{ fontFamily: MONO }}>.env.example</span> → <span style={{ fontFamily: MONO }}>.env.local</span>, set <span style={{ fontFamily: MONO }}>ARC_SPINE_DIR</span> to your spine's JSONL folder, run <span style={{ fontFamily: MONO }}>npm run dev</span>, then connect. The dev server only ever READS the files — nothing is written to the repo, ever.
            </p>
            <div className="mt-4 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--line-1)' }}>
              <span className="text-[12px]" style={NOTE}>
                your workspace: <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{wsCount()}</span> persisted receipts
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Btn
                  small
                  onClick={() => {
                    const blob = new Blob([wsExportText()], { type: 'application/x-ndjson' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `arc-workspace-${new Date().toISOString().slice(0, 10)}.jsonl`
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                >
                  Export · jsonl
                </Btn>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".jsonl,.txt,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0]
                      if (!f) return
                      f.text().then((t) => {
                        const r = wsImportText(t)
                        alert(`Import: ${r.added} events merged, ${r.bad} unreadable lines skipped, ${r.total} total on your log. Reloading to replay.`)
                        window.location.reload()
                      })
                    }}
                  />
                  <Btn small onClick={(e) => e.currentTarget.parentElement.querySelector('input').click()}>Import · merge</Btn>
                </label>
                <Btn
                  small
                  tone="danger"
                  onClick={() => {
                    if (window.confirm('Wipe YOUR workspace log? Every model, hire, skill, lead and decision you added is deleted. The sim is untouched. This cannot be undone — the honest opposite of append-only. Export first if in doubt.')) {
                      wsReset()
                      window.location.reload()
                    }
                  }}
                >
                  Reset
                </Btn>
              </div>
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Why this room exists">
            <p className="text-[12.5px] leading-[19px] mb-4" style={PROSE}>
              arc's engine plan — model-neutral process files, compiled adapters proven by byte-diff, drivers, a router, and bench scoring every model on every process — means a new model becomes a company-wide upgrade in a day, with receipts. This room is that idea running for real: swap the face's brain between vendors and nothing else changes.
            </p>
            <SectionLabel>Drivers</SectionLabel>
            <div className="-mx-2">
              {DRIVERS.map((d) => (
                <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2.5 px-2 py-[7px] rounded-md transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <StatusDot state={engineReady() && saved.provider === d.id ? 'live' : 'sleeping'} />
                  <span className="text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{d.name}</span>
                  <span className="text-[11.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{d.model || 'your endpoint, your model'}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Voice">
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={PROSE}>
              <div>· ears: browser speech recognition (Chrome/Edge, mic permission)</div>
              <div>· mouth: browser speech synthesis — streams sentence by sentence</div>
              <div>· no key: the offline matcher still answers about arc + live state</div>
              <div>· the face wakes whenever it listens or speaks, in any room</div>
            </div>
          </HPanel>

          <HPanel title="Privacy — receipts style">
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={PROSE}>
              <div>· api key → localStorage on this machine only</div>
              <div>· prompts → your chosen provider, direct from the browser</div>
              <div>· real-spine mode → local dev server, read-only, never leaves localhost</div>
              <div>· this app has no backend, no analytics, no tracking</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
