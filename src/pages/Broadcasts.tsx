import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Broadcast } from '@/types'
import { Send, Trash2, CheckCircle, AlertCircle, Radio, Loader2, X } from 'lucide-react'

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [userCount, setUserCount] = useState(0)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    const [bRes, uRes] = await Promise.all([
      supabase.from('broadcasts').select('*').order('created_at', { ascending: false }),
      supabase.from('bot_users').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('is_blocked', false),
    ])
    setBroadcasts(bRes.data ?? [])
    setUserCount(uRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function sendBroadcast() {
    if (!text.trim()) return
    setSending(true)

    const { data: newBroadcast } = await supabase
      .from('broadcasts')
      .insert({
        text: text.trim(),
        status: 'sending',
        target_count: userCount,
      })
      .select()
      .single()

    if (!newBroadcast) {
      setSending(false)
      return
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ broadcastId: newBroadcast.id, text: text.trim() }),
      })

      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      const result = await response.json()

      await supabase
        .from('broadcasts')
        .update({
          status: result.sent > 0 ? 'sent' : 'failed',
          sent_count: result.sent ?? 0,
          failed_count: result.failed ?? 0,
          sent_at: new Date().toISOString(),
        })
        .eq('id', newBroadcast.id)
    } catch {
      await supabase
        .from('broadcasts')
        .update({ status: 'failed', sent_at: new Date().toISOString() })
        .eq('id', newBroadcast.id)
    }

    setText('')
    setShowModal(false)
    setSending(false)
    load()
  }

  async function deleteBroadcast(b: Broadcast) {
    if (!confirm('Delete this broadcast record?')) return
    await supabase.from('broadcasts').delete().eq('id', b.id)
    load()
  }

  const statusBadge = (status: Broadcast['status']) => {
    const styles: Record<string, string> = {
      draft: 'bg-dark-700 text-dark-300',
      scheduled: 'bg-warning-500/10 text-warning-500',
      sending: 'bg-primary-500/10 text-primary-400',
      sent: 'bg-success-500/10 text-success-500',
      failed: 'bg-error-500/10 text-error-500',
    }
    return <span className={`badge ${styles[status] ?? styles.draft}`}>{status}</span>
  }

  return (
    <div className="space-y-6">
      {/* Compose card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">New Broadcast</h3>
            <p className="text-sm text-dark-400">Send a message to all {userCount} active users via Telegram</p>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your broadcast message here..."
          rows={4}
          className="input resize-none mb-3"
          maxLength={4096}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-400">{text.length} / 4096 characters</span>
          <button
            onClick={() => setShowModal(true)}
            disabled={!text.trim() || sending}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
            Send Broadcast
          </button>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-700">
          <h3 className="text-lg font-semibold text-white">Broadcast History</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-dark-400">
            <Radio className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No broadcasts sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {broadcasts.map((b) => (
              <div key={b.id} className="px-6 py-4 hover:bg-dark-900/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {b.status === 'sent' ? <CheckCircle className="w-4 h-4 text-success-500" /> : b.status === 'failed' ? <AlertCircle className="w-4 h-4 text-error-500" /> : b.status === 'sending' ? <Loader2 className="w-4 h-4 text-primary-400 animate-spin" /> : <Radio className="w-4 h-4 text-dark-400" />}
                      {statusBadge(b.status)}
                      <span className="text-xs text-dark-400">
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-dark-100 mb-1">{b.text}</p>
                    <div className="flex gap-4 text-xs text-dark-400">
                      <span>Target: {b.target_count}</span>
                      <span className="text-success-500">Delivered: {b.sent_count}</span>
                      {b.failed_count > 0 && <span className="text-error-500">Failed: {b.failed_count}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBroadcast(b)}
                    className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-error-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 max-w-md w-full mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Confirm Broadcast</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-dark-400 hover:bg-dark-700 hover:text-dark-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-lg bg-dark-900 border border-dark-700">
                <p className="text-xs text-dark-400 mb-1">Message</p>
                <p className="text-sm text-dark-100 whitespace-pre-wrap">{text}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-dark-300">
                <Send className="w-4 h-4 text-primary-500" />
                Will be sent to <span className="font-semibold text-white">{userCount}</span> active users via Telegram
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={sendBroadcast} disabled={sending} className="btn-primary">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
