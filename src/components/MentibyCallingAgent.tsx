'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

const AGENTS: Array<{ id: string; label: string }> = [
  { id: 'agent_7501k2n3bppsewksqv1v8tq9b6mz', label: 'MentiBY — Class Joining Reminder (9 PM)' },
  { id: 'agent_1201k2rx6d8kfcnbr70gbmevpdre', label: 'MentiBY — Soft Skill Practice (Introduce Yourself)' },
  { id: 'agent_2901k2rxe217e7ma72tephbx45g3', label: 'MentiBY — Attendance Check (Low Attendance)' },
  { id: 'agent_6101k2rxr8jzfv9tpgtfqav5apgz', label: 'MentiBY — XP Progress Check' },
];
const AGENT_PHONE_ID_FIXED = 'phnum_01jxhr4pntebv842765ren9t7m';
const FIXED_SCHEDULED_TIME = 10;

type WorkspaceItem = {
  id: string
  name: string
  status: string
  created_at_unix?: number
  total_calls_dispatched?: number
  total_calls_scheduled?: number
}

type BatchDetail = {
  id: string
  name: string
  status: string
  created_at_unix?: number
  scheduled_time_unix?: number
  total_calls_dispatched?: number
  total_calls_scheduled?: number
  recipients?: Array<{
    id: string
    phone_number: string
    status: string
    conversation_id?: string | null
  }>
}

type ConversationDetail = {
  status: string
  transcript?: Array<{ role: 'agent' | 'user'; message: string | null }>
  metadata?: {
    call_duration_secs?: number
    termination_reason?: string
  }
}

function toIST(unix?: number) {
  if (!unix) return '-'
  const d = new Date(unix * 1000)
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function maskPhone(p: string) {
  const m = (p || '').replace(/\s|-/g, '')
  const last4 = m.slice(-4) || '----'
  return `+91******${last4}`
}

function normalizePhones(raw: string) {
  // returns { valid: string[], invalid: string[] }
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (let line of lines) {
    let s = line.replace(/[()\s-]/g, '')
    if (/^\+91\d{10}$/.test(s)) {
      valid.push(s)
    } else if (/^91\d{10}$/.test(s)) {
      valid.push(`+${s}`)
    } else if (/^\d{10}$/.test(s)) {
      valid.push(`+91${s}`)
    } else {
      invalid.push(line)
    }
  }
  return { valid, invalid }
}

export default function MentibyCallingAgent() {
  const [mode, setMode] = useState<'idle'|'view'|'start'>('idle')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // workspace list
  const [workspace, setWorkspace] = useState<WorkspaceItem[] | null>(null)

  // batch detail
  const [openBatchId, setOpenBatchId] = useState<string | null>(null)
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null)

  // conversation
  const [openConvId, setOpenConvId] = useState<string | null>(null)
  const [convDetail, setConvDetail] = useState<ConversationDetail | null>(null)
  const [parentRecipientStatus, setParentRecipientStatus] = useState<string>('')

  // form state
  const [callName, setCallName] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState(AGENTS[0].id)
  const [recipients, setRecipients] = useState('')
  const [invalidLines, setInvalidLines] = useState<string[]>([])

  async function loadWorkspace() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/eleven?op=eleven_workspace', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load')
      // Expect either { items: [...] } or just an array — support both
      const items: WorkspaceItem[] = Array.isArray(data) ? data : (data.items || data)
      setWorkspace(items)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function openBatch(batchId: string) {
    setOpenBatchId(batchId)
    setBatchDetail(null)
    setConvDetail(null)
    setOpenConvId(null)
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/eleven?op=eleven_batch&batch_id=${encodeURIComponent(batchId)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load batch')
      setBatchDetail(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function openConversation(conversationId?: string | null, recipientStatus?: string) {
    if (!conversationId) {
      setOpenConvId(null)
      setConvDetail(null)
      setError('No conversation found.')
      return
    }
    setParentRecipientStatus(recipientStatus || '')
    setOpenConvId(conversationId)
    setConvDetail(null)
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/eleven?op=eleven_conv&conversation_id=${encodeURIComponent(conversationId)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load conversation')
      setConvDetail(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitBatch() {
    setError(null); setToast(null)

    // validate recipients
    const { valid, invalid } = normalizePhones(recipients)
    setInvalidLines(invalid)
    if (!valid.length || invalid.length) {
      setError(invalid.length ? `Invalid numbers: ${invalid.join(', ')}` : 'Add at least one valid number.')
      return
    }

    const payload = {
      call_name: callName.trim(),
      agent_id: selectedAgentId,
      agent_phone_number_id: AGENT_PHONE_ID_FIXED,
      scheduled_time_unix: FIXED_SCHEDULED_TIME,
      recipients: valid.map(v => ({ phone_number: v })),
    }

    if (!payload.call_name || !payload.agent_id || !payload.agent_phone_number_id) {
      setError('All fields are required.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/eleven?op=eleven_submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Submit failed')
      setToast(`Batch created${data?.id ? `: ${data.id}` : ''}`)
      // reset + switch to view
      setMode('view')
      await loadWorkspace()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
      <div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text">Mentiby Calling (Batch)</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Drive ElevenLabs ConvAI batch calls. No storage — everything is fetched live.
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={async () => { setMode('view'); await loadWorkspace() }}
            className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
              mode==='view'
                ? "gradient-purple text-white shadow-lg glow-purple"
                : "bg-muted/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            View Batch Calls
          </button>
          <button
            onClick={() => setMode('start')}
            className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
              mode==='start'
                ? "gradient-green text-white shadow-lg glow-green"
                : "bg-muted/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            Start New Batch
          </button>
        </div>

        {(toast || error) && (
          <div className="mt-3 space-y-2">
            {toast && <div className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">{toast}</div>}
            {error && <div className="px-4 py-2 rounded-lg bg-red-500/10 text-red-900 border border-red-500/30">{error}</div>}
          </div>
        )}
      </div>

      {/* START NEW BATCH */}
      {mode === 'start' && (
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold gradient-text">Start New Batch</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Call Name</label>
              <input
                className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={callName} onChange={e=>setCallName(e.target.value)} placeholder="Mentiby Class Reminder Demo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Calling Agent</label>
              <select
                className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={selectedAgentId}
                onChange={e => setSelectedAgentId(e.target.value)}
              >
                {AGENTS.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{selectedAgentId}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Recipients (one phone per line)</label>
              <textarea
                className="w-full min-h-[140px] px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder={`9876543210\n+919876543210\n91XXXXXXXXXX`}
                value={recipients} onChange={e=>setRecipients(e.target.value)}
              />
              {invalidLines.length > 0 && (
                <p className="text-sm text-red-600 mt-2">Invalid: {invalidLines.join(', ')}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Accepted: 10 digits → +91…, 91XXXXXXXXXX → +91…, +91XXXXXXXXXX. Agent/phone/time are fixed.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={submitBatch}
              disabled={loading}
              className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 gradient-green text-white shadow-lg glow-green hover:scale-[1.02]"
            >
              {loading ? 'Submitting…' : 'Submit Batch'}
            </button>
            <button
              onClick={()=>setMode('idle')}
              className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-muted/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* VIEW BATCH CALLS */}
      {mode === 'view' && (
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-lg font-semibold gradient-text">Workspace Batch Calls</h3>
            <button onClick={loadWorkspace} className="px-3 py-2 rounded-lg text-sm bg-muted/50 hover:bg-muted/70">Refresh</button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}

          {!loading && (!workspace || workspace.length === 0) && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-4" />
              No batch calls found.
            </div>
          )}

          {!loading && workspace && workspace.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full table-auto">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Batch ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Dispatched / Scheduled</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {workspace.map(item => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm">{item.name}</td>
                      <td className="px-4 py-3 text-sm font-mono">{item.id}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'completed' ? 'bg-emerald-500/15 text-emerald-800' : 'bg-amber-500/15 text-amber-800'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{toIST(item.created_at_unix)}</td>
                      <td className="px-4 py-3 text-sm">{(item.total_calls_dispatched ?? 0)} / {(item.total_calls_scheduled ?? 0)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button onClick={()=>openBatch(item.id)} className="px-3 py-1 rounded bg-muted/60 hover:bg-muted/80">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch detail panel */}
          {batchDetail && (
            <div className="border-t border-border/50">
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Batch</div>
                  <div className="text-lg font-semibold">{batchDetail.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Created: {toIST(batchDetail.created_at_unix)} • Status:{' '}
                    <span className={`px-2 py-1 rounded text-xs ${batchDetail.status === 'completed' ? 'bg-emerald-500/15 text-emerald-800' : 'bg-amber-500/15 text-amber-800'}`}>
                      {batchDetail.status}
                    </span>
                  </div>
                </div>
                <button onClick={()=>{ setBatchDetail(null); setOpenBatchId(null); setConvDetail(null); setOpenConvId(null) }} className="px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted/70">Close</button>
              </div>

              <div className="overflow-auto">
                <table className="w-full table-auto">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Recipient ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Recipient Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Conversation ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {batchDetail.recipients?.map(r => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm">{maskPhone(r.phone_number)}</td>
                        <td className="px-4 py-3 text-sm font-mono">{r.id}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'completed' ? 'bg-emerald-500/15 text-emerald-800' : 'bg-rose-500/15 text-rose-800'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{r.conversation_id || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={()=>openConversation(r.conversation_id, r.status)}
                            className="px-3 py-1 rounded bg-muted/60 hover:bg-muted/80"
                          >
                            View Transcript
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!batchDetail.recipients?.length && (
                      <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No recipients</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Conversation drawer */}
              {openConvId && convDetail && (
                <div className="border-t border-border/50">
                  <div className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Conversation</div>
                      <div className="text-lg font-semibold">{openConvId}</div>
                      <div className="text-sm">
                        {(() => {
                          const ok = convDetail.status === 'done' && parentRecipientStatus === 'completed'
                          return (
                            <span className={`px-2 py-1 rounded text-xs ${ok ? 'bg-emerald-500/15 text-emerald-800' : 'bg-rose-500/15 text-rose-800'}`}>
                              {ok ? 'Successful' : 'Not Successful'}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Duration: {convDetail.metadata?.call_duration_secs ?? '-'}s • End: {convDetail.metadata?.termination_reason || '-'}
                      </div>
                    </div>
                    <button onClick={()=>{ setOpenConvId(null); setConvDetail(null) }} className="px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted/70">Close</button>
                  </div>

                  <div className="p-4 space-y-3 max-h-[50vh] overflow-auto">
                    {(convDetail.transcript || []).filter(t => (t.message || '').trim() !== '...').map((t, i) => (
                      <div key={i} className={`rounded-xl p-3 ${t.role === 'agent' ? 'bg-muted/40' : 'bg-primary/10'}`}>
                        <div className="text-xs font-semibold mb-1">{t.role === 'agent' ? 'Agent' : 'User'}</div>
                        <div className="whitespace-pre-wrap text-sm">{t.message || '(no content)'}</div>
                      </div>
                    ))}
                    {(!convDetail.transcript || convDetail.transcript.length === 0) && (
                      <div className="text-sm text-muted-foreground">No transcript available.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'idle' && (
        <div className="bg-muted/10 border border-border/50 rounded-xl p-8 text-muted-foreground text-sm">
          Choose an action above to get started.
        </div>
      )}
    </div>
  )
}