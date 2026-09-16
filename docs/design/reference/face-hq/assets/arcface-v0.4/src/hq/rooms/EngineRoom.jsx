// 10 · ENGINE ROOM — arc's "models are parts, not identities",
// live: plug ANY model in as the face's brain (Claude, ChatGPT,
// Gemini, OpenRouter, or any OpenAI-compatible endpoint), test
// it, and pick the data source. Keys never leave this machine.
import { useState } from 'react'
import { MONO, COLOR, Btn, StatusDot, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { loadEngine, saveEngine, clearEngine, engineReady, testEngine } from '../../brain/llm.js'
import { resetHistory } from '../../brain/brain.js'
import { spine, tryConnectRealSpine, useSimSource } from '../../spine/store.js'
import { DRIVERS } from '../../spine/derive.js'
import { useSpine } from '../useSpine.js'
import { ask } from '../../lib/voice.js'

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

  return (
    <>
      <RoomHead
        title="Engine room."
        hint="the model is a swappable part — the process, the receipts and the constitution are the identity"
        right={<SimBadge>{engineReady() ? `brain: ${saved.provider} · ${saved.model}` : 'brain: offline matcher'}</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div>
          <HPanel title="the face's brain — pick a driver" hint="any key works: the wire format adapts" tone="cyan">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {DRIVERS.map((d) => (
                <button key={d.id} onClick={() => pickProvider(d.id)} className="min-h-[38px] rounded-lg px-3.5 text-[10.5px] uppercase tracking-[0.1em] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ fontFamily: MONO, background: provider === d.id ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.04)', color: provider === d.id ? COLOR.cyan : 'rgba(255,255,255,0.62)', border: `1px solid ${provider === d.id ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.13)'}` }}>
                  {d.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/48 block mb-1.5" style={{ fontFamily: MONO }}>api key</span>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider === 'anthropic' ? 'sk-ant-…' : provider === 'gemini' ? 'AIza…' : 'sk-…'} className="w-full bg-transparent border border-white/16 rounded-lg px-3 min-h-[44px] text-[12px] text-white/88 placeholder-white/30 outline-none focus:border-[#00ffd1]/60" style={{ fontFamily: MONO }} />
              </label>
              <label className="block">
                <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/48 block mb-1.5" style={{ fontFamily: MONO }}>model id — editable</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="exact model id from your provider" className="w-full bg-transparent border border-white/16 rounded-lg px-3 min-h-[44px] text-[12px] text-white/88 placeholder-white/30 outline-none focus:border-[#00ffd1]/60" style={{ fontFamily: MONO }} />
              </label>
            </div>
            {provider === 'custom' && (
              <label className="block mb-3">
                <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/48 block mb-1.5" style={{ fontFamily: MONO }}>base url — OpenAI-compatible</span>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.z.ai/v1 · http://localhost:11434/v1 (ollama) · …" className="w-full bg-transparent border border-white/16 rounded-lg px-3 min-h-[44px] text-[12px] text-white/88 placeholder-white/30 outline-none focus:border-[#00ffd1]/60" style={{ fontFamily: MONO }} />
              </label>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <Btn tone="primary" onClick={save}>save + test driver</Btn>
              {engineReady() && (
                <Btn small tone="danger" onClick={() => { clearEngine(); resetHistory(); setStatus({ kind: 'ok', text: 'key removed — offline brain active' }) }}>
                  remove key
                </Btn>
              )}
              {engineReady() && <Btn small onClick={() => ask('introduce yourself in one line and tell me what needs me today')}>try the brain 🎙</Btn>}
            </div>
            {status && (
              <div className="mt-3 text-[11px] rounded-lg border px-3 py-2" style={{ fontFamily: MONO, color: status.kind === 'err' ? COLOR.red : COLOR.green, borderColor: status.kind === 'err' ? 'rgba(255,107,107,0.4)' : 'rgba(74,222,128,0.35)' }}>
                {status.text}
              </div>
            )}
            <div className="mt-3 text-[10px] leading-[15px] text-white/48" style={{ fontWeight: 300 }}>
              The key is stored only in this browser's localStorage on this machine, and calls go straight from your browser to the provider — no server, no middleman. With a brain attached, the face sees the LIVE state (inbox, KPIs, timeline), answers anything, and can operate HQ: open rooms, approve or reject with your voice — except money and kills, which stay yours (E2).
            </div>
          </HPanel>

          <HPanel title="data source — what the spine renders">
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <button onClick={useSimSource} className="min-h-[40px] rounded-lg px-4 text-[10.5px] uppercase tracking-[0.12em] cursor-pointer" style={{ fontFamily: MONO, background: spine.source === 'sim' ? 'rgba(251,191,93,0.14)' : 'rgba(255,255,255,0.04)', color: spine.source === 'sim' ? COLOR.amber : 'rgba(255,255,255,0.6)', border: `1px solid ${spine.source === 'sim' ? 'rgba(251,191,93,0.5)' : 'rgba(255,255,255,0.13)'}` }}>
                simulated day (default)
              </button>
              <button onClick={connectSpine} className="min-h-[40px] rounded-lg px-4 text-[10.5px] uppercase tracking-[0.12em] cursor-pointer" style={{ fontFamily: MONO, background: spine.source === 'real' ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.04)', color: spine.source === 'real' ? COLOR.green : 'rgba(255,255,255,0.6)', border: `1px solid ${spine.source === 'real' ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.13)'}` }}>
                connect REAL spine (read-only)
              </button>
            </div>
            {spineMsg && (
              <div className="text-[11px] rounded-lg border px-3 py-2 mb-3" style={{ fontFamily: MONO, color: spineMsg.kind === 'err' ? COLOR.red : spineMsg.kind === 'ok' ? COLOR.green : 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.14)' }}>
                {spineMsg.text}
              </div>
            )}
            <div className="text-[10.5px] leading-[16px] text-white/55" style={{ fontWeight: 300 }}>
              To render your real arc receipts: copy <span style={{ fontFamily: MONO }}>.env.example</span> → <span style={{ fontFamily: MONO }}>.env.local</span>, set <span style={{ fontFamily: MONO }}>ARC_SPINE_DIR</span> to your spine's JSONL folder, run <span style={{ fontFamily: MONO }}>npm run dev</span>, then connect. The dev server only ever READS the files — nothing is written to the repo, ever.
            </div>
          </HPanel>
        </div>

        <div>
          <HPanel title="why this room exists" tone="cyan">
            <p className="text-[11.5px] leading-[18px] text-white/68 mb-3" style={{ fontWeight: 300 }}>
              arc's engine plan — model-neutral process files, compiled adapters proven by byte-diff, drivers, a router, and bench scoring every model on every process — means a new model becomes a company-wide upgrade in a day, with receipts. This room is that idea running for real: swap the face's brain between vendors and nothing else changes.
            </p>
            <div className="space-y-1.5" style={{ fontFamily: MONO }}>
              {DRIVERS.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 text-[10.5px]">
                  <StatusDot state={engineReady() && saved.provider === d.id ? 'live' : 'sleeping'} />
                  <span className="text-white/78 w-[190px]">{d.name}</span>
                  <span className="text-white/42 truncate">{d.model || 'your endpoint, your model'}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="voice">
            <div className="text-[11px] leading-[16px] text-white/62 space-y-1.5" style={{ fontWeight: 300 }}>
              <div>· ears: browser speech recognition (Chrome/Edge, mic permission)</div>
              <div>· mouth: browser speech synthesis — streams sentence by sentence</div>
              <div>· no key: the offline matcher still answers about arc + live state</div>
              <div>· the face wakes whenever it listens or speaks, in any room</div>
            </div>
          </HPanel>

          <HPanel title="privacy — receipts style" tone="amber">
            <div className="text-[11px] leading-[16px] text-white/62 space-y-1.5" style={{ fontWeight: 300 }}>
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
